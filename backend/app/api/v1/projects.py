from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from app.database.base import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.project import Project, ProjectMember, ProjectStatus, ProjectPriority
from app.models.team import TeamMember, TeamRole
from app.models.task import Task, TaskStatus
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectWithStats, ProjectMemberCreate, ProjectMemberUpdate, ProjectMemberResponse

router = APIRouter(prefix="/projects", tags=["projects"])


async def check_project_access(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    """Check if user has access to project"""
    result = await db.execute(
        select(Project)
        .options(selectinload(Project.owner), selectinload(Project.team))
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


async def check_project_admin(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    """Check if user is project admin (owner or project manager)"""
    project = await check_project_access(db, project_id, user_id)

    if project.owner_id == user_id:
        return project

    if project.team_id:
        team_member = await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == project.team_id,
                TeamMember.user_id == user_id,
                TeamMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
            )
        )
        if team_member.scalar_one_or_none():
            return project

    project_member = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
            ProjectMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN, TeamRole.MEMBER])  # In project, member can manage
        )
    )
    if project_member.scalar_one_or_none():
        return project

    raise HTTPException(status_code=403, detail="Not authorized to manage this project")


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify team access if provided
    if project_data.team_id:
        team_member = await db.execute(
            select(TeamMember).where(TeamMember.team_id == project_data.team_id, TeamMember.user_id == current_user.id)
        )
        if not team_member.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not a member of this team")

    project = Project(**project_data.model_dump(), owner_id=current_user.id)
    db.add(project)
    await db.flush()

    # Add creator as project member
    member = ProjectMember(project_id=project.id, user_id=current_user.id, role=TeamRole.OWNER)
    db.add(member)
    await db.commit()
    await db.refresh(project)

    return project


@router.get("", response_model=List[ProjectResponse])
async def list_projects(
    status: Optional[ProjectStatus] = None,
    team_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Project).options(selectinload(Project.owner), selectinload(Project.team))

    # Build access filter
    access_conditions = [
        Project.owner_id == current_user.id,
    ]

    if team_id:
        access_conditions.append(Project.team_id == team_id)
    else:
        # Get all teams user is member of
        team_ids = await db.execute(
            select(TeamMember.team_id).where(TeamMember.user_id == current_user.id)
        )
        team_ids = [t[0] for t in team_ids.all()]
        if team_ids:
            access_conditions.append(Project.team_id.in_(team_ids))

    # Also include projects where user is directly a member
    project_member_ids = await db.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
    )
    project_member_ids = [p[0] for p in project_member_ids.all()]
    if project_member_ids:
        access_conditions.append(Project.id.in_(project_member_ids))

    query = query.where(or_(*access_conditions))

    if status:
        query = query.where(Project.status == status)

    query = query.where(Project.is_active == True).order_by(Project.updated_at.desc())

    result = await db.execute(query)
    projects = result.scalars().all()

    # Add task counts
    for project in projects:
        task_count = await db.execute(
            select(func.count(Task.id)).where(Task.project_id == project.id)
        )
        project.task_count = task_count.scalar() or 0

        completed_count = await db.execute(
            select(func.count(Task.id)).where(Task.project_id == project.id, Task.status == TaskStatus.DONE)
        )
        project.completed_task_count = completed_count.scalar() or 0

    return projects


@router.get("/{project_id}", response_model=ProjectWithStats)
async def get_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project = await check_project_access(db, project_id, current_user.id)

    # Get task counts
    task_count = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == project.id)
    )
    project.task_count = task_count.scalar() or 0

    completed_count = await db.execute(
        select(func.count(Task.id)).where(Task.project_id == project.id, Task.status == TaskStatus.DONE)
    )
    project.completed_task_count = completed_count.scalar() or 0

    # Get sprint count
    from app.models.sprint import Sprint
    sprint_count = await db.execute(
        select(func.count(Sprint.id)).where(Sprint.project_id == project.id)
    )
    project.sprint_count = sprint_count.scalar() or 0

    # Get active sprint
    active_sprint = await db.execute(
        select(Sprint).where(Sprint.project_id == project.id, Sprint.status == SprintStatus.ACTIVE)
    )
    project.active_sprint = active_sprint.scalar_one_or_none()

    return project


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    project_update: ProjectUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project = await check_project_admin(db, project_id, current_user.id)

    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project = await check_project_admin(db, project_id, current_user.id)

    # Only owner or team owner/admin can delete
    if project.owner_id != current_user.id:
        if project.team_id:
            team_member = await db.execute(
                select(TeamMember).where(
                    TeamMember.team_id == project.team_id,
                    TeamMember.user_id == current_user.id,
                    TeamMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
                )
            )
            if not team_member.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Only project owner or team admin can delete project")
        else:
            raise HTTPException(status_code=403, detail="Only project owner can delete project")

    await db.delete(project)
    await db.commit()


# Project Members
@router.post("/{project_id}/members", response_model=ProjectMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: uuid.UUID,
    member_data: ProjectMemberCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project = await check_project_admin(db, project_id, current_user.id)

    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == member_data.user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    existing = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == member_data.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member")

    member = ProjectMember(**member_data.model_dump(), project_id=project_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.get("/{project_id}/members", response_model=List[ProjectMemberResponse])
async def list_project_members(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project = await check_project_access(db, project_id, current_user.id)

    result = await db.execute(
        select(ProjectMember)
        .options(selectinload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id)
    )
    return result.scalars().all()


@router.put("/{project_id}/members/{user_id}", response_model=ProjectMemberResponse)
async def update_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    member_update: ProjectMemberUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project = await check_project_admin(db, project_id, current_user.id)

    result = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member_update.role:
        member.role = member_update.role

    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project = await check_project_admin(db, project_id, current_user.id)

    result = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Can't remove project owner
    if member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove project owner")

    await db.delete(member)
    await db.commit()