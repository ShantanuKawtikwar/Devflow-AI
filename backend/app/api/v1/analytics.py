from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
from datetime import datetime, timedelta
from collections import defaultdict

from app.database.base import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.project import Project, ProjectMember, ProjectStatus
from app.models.team import TeamMember
from app.models.task import Task, TaskStatus, TaskPriority
from app.models.sprint import Sprint, SprintStatus

router = APIRouter(prefix="/analytics", tags=["analytics"])


async def get_user_projects(db: AsyncSession, user_id: uuid.UUID) -> List[uuid.UUID]:
    """Get all project IDs user has access to"""
    # Owned projects
    owned = await db.execute(select(Project.id).where(Project.owner_id == user_id))
    project_ids = [p[0] for p in owned.all()]

    # Team projects
    team_ids = await db.execute(select(TeamMember.team_id).where(TeamMember.user_id == user_id))
    team_ids = [t[0] for t in team_ids.all()]
    if team_ids:
        team_projects = await db.execute(select(Project.id).where(Project.team_id.in_(team_ids)))
        project_ids.extend([p[0] for p in team_projects.all()])

    # Direct project membership
    member_projects = await db.execute(select(ProjectMember.project_id).where(ProjectMember.user_id == user_id))
    project_ids.extend([p[0] for p in member_projects.all()])

    return list(set(project_ids))


@router.get("/dashboard")
async def get_dashboard_analytics(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project_ids = await get_user_projects(db, current_user.id)

    if not project_ids:
        return {
            "total_projects": 0,
            "active_projects": 0,
            "completed_tasks": 0,
            "pending_tasks": 0,
            "overdue_tasks": 0,
            "current_sprint_progress": 0,
            "recent_activity": [],
            "upcoming_deadlines": [],
            "task_status_distribution": {},
            "priority_distribution": {}
        }

    # Total projects
    total_projects = len(project_ids)

    # Active projects
    active_result = await db.execute(
        select(func.count(Project.id)).where(
            Project.id.in_(project_ids),
            Project.status == ProjectStatus.ACTIVE
        )
    )
    active_projects = active_result.scalar() or 0

    # Task counts
    completed_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id.in_(project_ids),
            Task.status == TaskStatus.DONE
        )
    )
    completed_tasks = completed_result.scalar() or 0

    pending_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id.in_(project_ids),
            Task.status != TaskStatus.DONE
        )
    )
    pending_tasks = pending_result.scalar() or 0

    # Overdue tasks
    now = datetime.utcnow()
    overdue_result = await db.execute(
        select(func.count(Task.id)).where(
            Task.project_id.in_(project_ids),
            Task.status != TaskStatus.DONE,
            Task.due_date < now
        )
    )
    overdue_tasks = overdue_result.scalar() or 0

    # Current sprint progress
    active_sprint = await db.execute(
        select(Sprint).where(
            Sprint.project_id.in_(project_ids),
            Sprint.status == SprintStatus.ACTIVE
        ).limit(1)
    )
    sprint = active_sprint.scalar_one_or_none()
    current_sprint_progress = 0
    if sprint:
        total = await db.execute(
            select(func.count(Task.id)).where(Task.sprint_id == sprint.id)
        )
        total_count = total.scalar() or 0
        if total_count > 0:
            done = await db.execute(
                select(func.count(Task.id)).where(
                    Task.sprint_id == sprint.id,
                    Task.status == TaskStatus.DONE
                )
            )
            current_sprint_progress = (done.scalar() or 0) / total_count * 100

    # Recent activity
    from app.models.notification import ActivityLog
    recent_activity = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.project_id.in_(project_ids))
        .order_by(ActivityLog.created_at.desc())
        .limit(10)
    )
    recent_activity = recent_activity.scalars().all()

    # Upcoming deadlines
    upcoming = await db.execute(
        select(Task)
        .where(
            Task.project_id.in_(project_ids),
            Task.status != TaskStatus.DONE,
            Task.due_date >= now,
            Task.due_date <= now + timedelta(days=7)
        )
        .order_by(Task.due_date)
        .limit(10)
    )
    upcoming_deadlines = upcoming.scalars().all()

    # Task status distribution
    status_dist = await db.execute(
        select(Task.status, func.count(Task.id))
        .where(Task.project_id.in_(project_ids))
        .group_by(Task.status)
    )
    task_status_distribution = {str(s): c for s, c in status_dist.all()}

    # Priority distribution
    priority_dist = await db.execute(
        select(Task.priority, func.count(Task.id))
        .where(Task.project_id.in_(project_ids))
        .group_by(Task.priority)
    )
    priority_distribution = {str(p): c for p, c in priority_dist.all()}

    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "completed_tasks": completed_tasks,
        "pending_tasks": pending_tasks,
        "overdue_tasks": overdue_tasks,
        "current_sprint_progress": round(current_sprint_progress, 1),
        "recent_activity": [
            {
                "id": str(a.id),
                "action": a.action,
                "entity_type": a.entity_type,
                "entity_name": a.entity_name,
                "created_at": a.created_at.isoformat(),
                "user_name": a.user.full_name if a.user else "Unknown"
            }
            for a in recent_activity
        ],
        "upcoming_deadlines": [
            {
                "id": str(t.id),
                "title": t.title,
                "due_date": t.due_date.isoformat() if t.due_date else None,
                "project_id": str(t.project_id)
            }
            for t in upcoming_deadlines
        ],
        "task_status_distribution": task_status_distribution,
        "priority_distribution": priority_distribution
    }


@router.get("/tasks-over-time")
async def get_tasks_over_time(
    days: int = 30,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project_ids = await get_user_projects(db, current_user.id)
    if not project_ids:
        return {"data": []}

    since = datetime.utcnow() - timedelta(days=days)

    # Created tasks over time
    created = await db.execute(
        select(
            func.date(Task.created_at).label("date"),
            func.count(Task.id).label("count")
        )
        .where(
            Task.project_id.in_(project_ids),
            Task.created_at >= since
        )
        .group_by(func.date(Task.created_at))
        .order_by(func.date(Task.created_at))
    )

    # Completed tasks over time
    completed = await db.execute(
        select(
            func.date(Task.completed_at).label("date"),
            func.count(Task.id).label("count")
        )
        .where(
            Task.project_id.in_(project_ids),
            Task.completed_at >= since,
            Task.status == TaskStatus.DONE
        )
        .group_by(func.date(Task.completed_at))
        .order_by(func.date(Task.completed_at))
    )

    created_data = {str(row.date): row.count for row in created.all()}
    completed_data = {str(row.date): row.count for row in completed.all()}

    # Fill in all dates
    all_dates = []
    current = since.date()
    end = datetime.utcnow().date()
    while current <= end:
        all_dates.append(str(current))
        current += timedelta(days=1)

    return {
        "data": [
            {
                "date": d,
                "created": created_data.get(d, 0),
                "completed": completed_data.get(d, 0)
            }
            for d in all_dates
        ]
    }


@router.get("/sprint-velocity")
async def get_sprint_velocity(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify access
    from app.models.project import Project
    project = await db.execute(select(Project).where(Project.id == project_id))
    project = project.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check access
    if project.owner_id != current_user.id:
        if project.team_id:
            team_member = await db.execute(
                select(TeamMember).where(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id)
            )
            if not team_member.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Not authorized")
        else:
            member = await db.execute(
                select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id)
            )
            if not member.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Not authorized")

    # Get completed sprints
    sprints = await db.execute(
        select(Sprint)
        .where(Sprint.project_id == project_id, Sprint.status == SprintStatus.COMPLETED)
        .order_by(Sprint.end_date)
    )
    sprints = sprints.scalars().all()

    velocity_data = []
    for sprint in sprints:
        completed_points = await db.execute(
            select(func.sum(Task.story_points)).where(
                Task.sprint_id == sprint.id,
                Task.status == TaskStatus.DONE
            )
        )
        velocity_data.append({
            "sprint_id": str(sprint.id),
            "sprint_name": sprint.name,
            "end_date": sprint.end_date.isoformat() if sprint.end_date else None,
            "completed_story_points": completed_points.scalar() or 0,
            "total_story_points": await get_total_story_points(db, sprint.id)
        })

    return {"velocity": velocity_data}


async def get_total_story_points(db: AsyncSession, sprint_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.sum(Task.story_points)).where(Task.sprint_id == sprint_id)
    )
    return result.scalar() or 0


@router.get("/project-status-distribution")
async def get_project_status_distribution(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project_ids = await get_user_projects(db, current_user.id)
    if not project_ids:
        return {"data": []}

    result = await db.execute(
        select(Project.status, func.count(Project.id))
        .where(Project.id.in_(project_ids))
        .group_by(Project.status)
    )

    return {
        "data": [
            {"status": str(s), "count": c}
            for s, c in result.all()
        ]
    }


@router.get("/team-contribution")
async def get_team_contribution(
    project_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify access
    from app.models.project import Project
    project = await db.execute(select(Project).where(Project.id == project_id))
    project = project.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all project members
    from app.models.project import ProjectMember
    members = await db.execute(
        select(ProjectMember).options(selectinload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id)
    )
    members = members.scalars().all()

    contribution_data = []
    for member in members:
        # Tasks assigned
        assigned = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == project_id,
                Task.assignee_id == member.user_id
            )
        )
        assigned_count = assigned.scalar() or 0

        # Tasks completed
        completed = await db.execute(
            select(func.count(Task.id)).where(
                Task.project_id == project_id,
                Task.assignee_id == member.user_id,
                Task.status == TaskStatus.DONE
            )
        )
        completed_count = completed.scalar() or 0

        # Story points completed
        points = await db.execute(
            select(func.sum(Task.story_points)).where(
                Task.project_id == project_id,
                Task.assignee_id == member.user_id,
                Task.status == TaskStatus.DONE
            )
        )
        points_completed = points.scalar() or 0

        # Comments
        from app.models.task import TaskComment
        comments = await db.execute(
            select(func.count(TaskComment.id))
            .join(Task, TaskComment.task_id == Task.id)
            .where(Task.project_id == project_id, TaskComment.author_id == member.user_id)
        )
        comments_count = comments.scalar() or 0

        contribution_data.append({
            "user_id": str(member.user_id),
            "username": member.user.username,
            "full_name": member.user.full_name,
            "avatar_url": member.user.avatar_url,
            "role": member.role.value,
            "assigned_tasks": assigned_count,
            "completed_tasks": completed_count,
            "story_points_completed": points_completed,
            "comments": comments_count
        })

    return {"contributions": contribution_data}


@router.get("/overdue-statistics")
async def get_overdue_statistics(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    project_ids = await get_user_projects(db, current_user.id)
    if not project_ids:
        return {"overdue_by_project": [], "overdue_by_priority": {}, "overdue_by_assignee": []}

    now = datetime.utcnow()

    # Overdue by project
    overdue_projects = await db.execute(
        select(Project.name, func.count(Task.id))
        .join(Task, Task.project_id == Project.id)
        .where(
            Task.project_id.in_(project_ids),
            Task.status != TaskStatus.DONE,
            Task.due_date < now
        )
        .group_by(Project.id, Project.name)
    )

    # Overdue by priority
    overdue_priority = await db.execute(
        select(Task.priority, func.count(Task.id))
        .where(
            Task.project_id.in_(project_ids),
            Task.status != TaskStatus.DONE,
            Task.due_date < now
        )
        .group_by(Task.priority)
    )

    # Overdue by assignee
    overdue_assignee = await db.execute(
        select(User.username, User.full_name, func.count(Task.id))
        .join(Task, Task.assignee_id == User.id)
        .where(
            Task.project_id.in_(project_ids),
            Task.status != TaskStatus.DONE,
            Task.due_date < now,
            Task.assignee_id.isnot(None)
        )
        .group_by(User.id, User.username, User.full_name)
    )

    return {
        "overdue_by_project": [
            {"project": p, "count": c}
            for p, c in overdue_projects.all()
        ],
        "overdue_by_priority": {str(p): c for p, c in overdue_priority.all()},
        "overdue_by_assignee": [
            {"username": u, "full_name": f, "count": c}
            for u, f, c in overdue_assignee.all()
        ]
    }