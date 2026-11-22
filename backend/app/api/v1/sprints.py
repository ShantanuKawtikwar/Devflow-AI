from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
from datetime import datetime, timedelta

from app.database.base import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.project import Project, ProjectMember
from app.models.team import TeamMember, TeamRole
from app.models.task import Task, TaskStatus
from app.models.sprint import Sprint, SprintStatus
from app.schemas.sprint import SprintCreate, SprintUpdate, SprintResponse, SprintWithTasks

router = APIRouter(prefix="/sprints", tags=["sprints"])


async def check_sprint_access(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    """Check if user has access to project"""
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

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


@router.post("", response_model=SprintResponse, status_code=status.HTTP_201_CREATED)
async def create_sprint(
    sprint_data: SprintCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_sprint_access(db, sprint_data.project_id, current_user.id)

    sprint = Sprint(**sprint_data.model_dump())
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.get("", response_model=List[SprintResponse])
async def list_sprints(
    project_id: uuid.UUID,
    status: Optional[SprintStatus] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_sprint_access(db, project_id, current_user.id)

    query = select(Sprint).where(Sprint.project_id == project_id)

    if status:
        query = query.where(Sprint.status == status)

    query = query.order_by(Sprint.start_date.desc())
    result = await db.execute(query)
    sprints = result.scalars().all()

    # Add task counts
    for sprint in sprints:
        task_count = await db.execute(
            select(func.count(Task.id)).where(Task.sprint_id == sprint.id)
        )
        sprint.task_count = task_count.scalar() or 0

        completed_count = await db.execute(
            select(func.count(Task.id)).where(Task.sprint_id == sprint.id, Task.status == TaskStatus.DONE)
        )
        sprint.completed_task_count = completed_count.scalar() or 0

        total_points = await db.execute(
            select(func.sum(Task.story_points)).where(Task.sprint_id == sprint.id)
        )
        sprint.total_story_points = total_points.scalar() or 0

        completed_points = await db.execute(
            select(func.sum(Task.story_points)).where(Task.sprint_id == sprint.id, Task.status == TaskStatus.DONE)
        )
        sprint.completed_story_points = completed_points.scalar() or 0

    return sprints


@router.get("/{sprint_id}", response_model=SprintWithTasks)
async def get_sprint(
    sprint_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Sprint)
        .options(selectinload(Sprint.project))
        .where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    await check_sprint_access(db, sprint.project_id, current_user.id)

    # Get tasks
    result = await db.execute(
        select(Task)
        .options(
            selectinload(Task.assignee),
            selectinload(Task.labels)
        )
        .where(Task.sprint_id == sprint_id)
        .order_by(Task.status, Task.order)
    )
    sprint.tasks = result.scalars().all()

    # Add stats
    task_count = await db.execute(
        select(func.count(Task.id)).where(Task.sprint_id == sprint.id)
    )
    sprint.task_count = task_count.scalar() or 0

    completed_count = await db.execute(
        select(func.count(Task.id)).where(Task.sprint_id == sprint.id, Task.status == TaskStatus.DONE)
    )
    sprint.completed_task_count = completed_count.scalar() or 0

    total_points = await db.execute(
        select(func.sum(Task.story_points)).where(Task.sprint_id == sprint.id)
    )
    sprint.total_story_points = total_points.scalar() or 0

    completed_points = await db.execute(
        select(func.sum(Task.story_points)).where(Task.sprint_id == sprint.id, Task.status == TaskStatus.DONE)
    )
    sprint.completed_story_points = completed_points.scalar() or 0

    return sprint


@router.put("/{sprint_id}", response_model=SprintResponse)
async def update_sprint(
    sprint_id: uuid.UUID,
    sprint_update: SprintUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Sprint).where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    await check_sprint_access(db, sprint.project_id, current_user.id)

    update_data = sprint_update.model_dump(exclude_unset=True)

    # Handle status change
    if "status" in update_data:
        old_status = sprint.status
        new_status = update_data["status"]
        if old_status != SprintStatus.COMPLETED and new_status == SprintStatus.COMPLETED:
            sprint.completed_at = datetime.utcnow()

    for field, value in update_data.items():
        setattr(sprint, field, value)

    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint(
    sprint_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Sprint).where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    await check_sprint_access(db, sprint.project_id, current_user.id)

    # Only allow deletion if sprint is in planning
    if sprint.status != SprintStatus.PLANNING:
        raise HTTPException(status_code=400, detail="Can only delete sprints in planning status")

    await db.delete(sprint)
    await db.commit()


@router.post("/{sprint_id}/start", response_model=SprintResponse)
async def start_sprint(
    sprint_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Sprint).where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    await check_sprint_access(db, sprint.project_id, current_user.id)

    if sprint.status != SprintStatus.PLANNING:
        raise HTTPException(status_code=400, detail="Can only start sprints in planning status")

    # End any other active sprints in this project
    await db.execute(
        Sprint.__table__.update()
        .where(Sprint.project_id == sprint.project_id, Sprint.status == SprintStatus.ACTIVE)
        .values(status=SprintStatus.COMPLETED, completed_at=datetime.utcnow())
    )

    sprint.status = SprintStatus.ACTIVE
    await db.commit()
    await db.refresh(sprint)
    return sprint


@router.post("/{sprint_id}/complete", response_model=SprintResponse)
async def complete_sprint(
    sprint_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Sprint).where(Sprint.id == sprint_id)
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    await check_sprint_access(db, sprint.project_id, current_user.id)

    if sprint.status != SprintStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Can only complete active sprints")

    sprint.status = SprintStatus.COMPLETED
    sprint.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(sprint)
    return sprint