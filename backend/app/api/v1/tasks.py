from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime
import uuid

from app.database.base import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.project import Project, ProjectMember
from app.models.team import TeamMember, TeamRole
from app.models.task import Task, TaskComment, TaskLabel, TaskStatus, TaskPriority
from app.schemas.task import TaskCreate, TaskUpdate, TaskMove, TaskResponse, TaskWithDetails, TaskCommentCreate, TaskCommentUpdate, TaskCommentResponse, TaskLabelCreate, TaskLabelResponse

router = APIRouter(prefix="/tasks", tags=["tasks"])


async def check_task_access(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    """Check if user has access to project"""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if user is owner, team member, or project member
    if project.owner_id == user_id:
        return project

    if project.team_id:
        team_member = await db.execute(
            select(TeamMember).where(TeamMember.team_id == project.team_id, TeamMember.user_id == user_id)
        )
        if team_member.scalar_one_or_none():
            return project

    project_member = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    if project_member.scalar_one_or_none():
        return project

    raise HTTPException(status_code=403, detail="Not authorized to access this project")


async def check_task_edit_access(db: AsyncSession, task: Task, user_id: uuid.UUID) -> bool:
    """Check if user can edit task"""
    project = await check_task_access(db, task.project_id, user_id)

    # Owner, assignee, creator, or project admin can edit
    if project.owner_id == user_id:
        return True
    if task.assignee_id == user_id:
        return True
    if task.creator_id == user_id:
        return True

    if project.team_id:
        team_member = await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == project.team_id,
                TeamMember.user_id == user_id,
                TeamMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
            )
        )
        if team_member.scalar_one_or_none():
            return True

    project_member = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user_id,
            ProjectMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
        )
    )
    if project_member.scalar_one_or_none():
        return True

    return False


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_task_access(db, task_data.project_id, current_user.id)

    # Get max order for the status
    max_order_result = await db.execute(
        select(func.max(Task.order)).where(
            Task.project_id == task_data.project_id,
            Task.status == task_data.status
        )
    )
    max_order = max_order_result.scalar() or 0

    task = Task(
        **task_data.model_dump(),
        creator_id=current_user.id,
        order=max_order + 1
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.get("", response_model=List[TaskResponse])
async def list_tasks(
    project_id: uuid.UUID,
    status: Optional[TaskStatus] = None,
    assignee_id: Optional[uuid.UUID] = None,
    sprint_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_task_access(db, project_id, current_user.id)

    query = select(Task).options(
        selectinload(Task.assignee),
        selectinload(Task.creator),
        selectinload(Task.labels)
    ).where(Task.project_id == project_id)

    if status:
        query = query.where(Task.status == status)
    if assignee_id:
        query = query.where(Task.assignee_id == assignee_id)
    if sprint_id:
        query = query.where(Task.sprint_id == sprint_id)

    query = query.order_by(Task.status, Task.order)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{task_id}", response_model=TaskWithDetails)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.creator),
            selectinload(Task.labels),
            selectinload(Task.comments).selectinload(TaskComment.author)
        )
        .where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await check_task_access(db, task.project_id, current_user.id)
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    task_update: TaskUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not await check_task_edit_access(db, task, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to edit this task")

    update_data = task_update.model_dump(exclude_unset=True)

    # Handle status change - update timestamps
    if "status" in update_data:
        old_status = task.status
        new_status = update_data["status"]
        if old_status != TaskStatus.IN_PROGRESS and new_status == TaskStatus.IN_PROGRESS:
            task.started_at = datetime.utcnow()
        if old_status != TaskStatus.DONE and new_status == TaskStatus.DONE:
            task.completed_at = datetime.utcnow()

    for field, value in update_data.items():
        setattr(task, field, value)

    await db.commit()
    await db.refresh(task)
    return task


@router.put("/{task_id}/move", response_model=TaskResponse)
async def move_task(
    task_id: uuid.UUID,
    move_data: TaskMove,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not await check_task_edit_access(db, task, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to move this task")

    old_status = task.status
    old_order = task.order
    new_status = move_data.status
    new_order = move_data.order

    # If moving within same status, reorder
    if old_status == new_status:
        # Shift other tasks
        if new_order > old_order:
            # Moving down - shift tasks up
            await db.execute(
                Task.__table__.update()
                .where(
                    Task.project_id == task.project_id,
                    Task.status == new_status,
                    Task.order > old_order,
                    Task.order <= new_order
                )
                .values(order=Task.order - 1)
            )
        else:
            # Moving up - shift tasks down
            await db.execute(
                Task.__table__.update()
                .where(
                    Task.project_id == task.project_id,
                    Task.status == new_status,
                    Task.order >= new_order,
                    Task.order < old_order
                )
                .values(order=Task.order + 1)
            )
    else:
        # Moving to different status
        # Remove from old position
        await db.execute(
            Task.__table__.update()
            .where(
                Task.project_id == task.project_id,
                Task.status == old_status,
                Task.order > old_order
            )
            .values(order=Task.order - 1)
        )
        # Make room in new status
        await db.execute(
            Task.__table__.update()
            .where(
                Task.project_id == task.project_id,
                Task.status == new_status,
                Task.order >= new_order
            )
            .values(order=Task.order + 1)
        )

    # Update task
    task.status = new_status
    task.order = new_order

    if old_status != TaskStatus.IN_PROGRESS and new_status == TaskStatus.IN_PROGRESS:
        task.started_at = datetime.utcnow()
    if old_status != TaskStatus.DONE and new_status == TaskStatus.DONE:
        task.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not await check_task_edit_access(db, task, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")

    # Reorder remaining tasks
    await db.execute(
        Task.__table__.update()
        .where(
            Task.project_id == task.project_id,
            Task.status == task.status,
            Task.order > task.order
        )
        .values(order=Task.order - 1)
    )

    await db.delete(task)
    await db.commit()


# Task Comments
@router.post("/{task_id}/comments", response_model=TaskCommentResponse, status_code=status.HTTP_201_CREATED)
async def create_task_comment(
    task_id: uuid.UUID,
    comment_data: TaskCommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await check_task_access(db, task.project_id, current_user.id)

    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        content=comment_data.content
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)
    return comment


@router.get("/{task_id}/comments", response_model=List[TaskCommentResponse])
async def list_task_comments(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await check_task_access(db, task.project_id, current_user.id)

    result = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.author))
        .where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at)
    )
    return result.scalars().all()


@router.put("/comments/{comment_id}", response_model=TaskCommentResponse)
async def update_task_comment(
    comment_id: uuid.UUID,
    comment_update: TaskCommentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TaskComment).where(TaskComment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this comment")

    if comment_update.content is not None:
        comment.content = comment_update.content

    await db.commit()
    await db.refresh(comment)
    return comment


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_comment(
    comment_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TaskComment).where(TaskComment.id == comment_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

    await db.delete(comment)
    await db.commit()


# Task Labels
@router.post("/{task_id}/labels", response_model=TaskLabelResponse, status_code=status.HTTP_201_CREATED)
async def add_task_label(
    task_id: uuid.UUID,
    label_data: TaskLabelCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not await check_task_edit_access(db, task, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to add labels")

    label = TaskLabel(task_id=task_id, **label_data.model_dump())
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return label


@router.delete("/{task_id}/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_task_label(
    task_id: uuid.UUID,
    label_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Task).where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if not await check_task_edit_access(db, task, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorized to remove labels")

    result = await db.execute(
        select(TaskLabel).where(TaskLabel.id == label_id, TaskLabel.task_id == task_id)
    )
    label = result.scalar_one_or_none()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")

    await db.delete(label)
    await db.commit()


from datetime import datetime