from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
import uuid

from app.database.base import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.notification import Notification, ActivityLog, NotificationType
from app.schemas.notification import NotificationResponse, NotificationMarkRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    unread_only: bool = False,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(Notification).where(Notification.user_id == current_user.id)

    if unread_only:
        query = query.where(Notification.is_read == False)

    query = query.order_by(Notification.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        )
    )
    return {"count": result.scalar() or 0}


@router.put("/mark-read", response_model=dict)
async def mark_notifications_read(
    data: NotificationMarkRead,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id.in_(data.notification_ids),
            Notification.user_id == current_user.id
        )
    )
    notifications = result.scalars().all()

    for notification in notifications:
        notification.is_read = True
        notification.read_at = datetime.utcnow()

    await db.commit()
    return {"message": f"Marked {len(notifications)} notifications as read"}


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await db.commit()
    await db.refresh(notification)
    return notification


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    await db.delete(notification)
    await db.commit()


# Activity Logs
@router.get("/activity", response_model=List[dict])
async def get_activity_log(
    project_id: Optional[uuid.UUID] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    query = select(ActivityLog).options(selectinload(ActivityLog.user))

    if project_id:
        query = query.where(ActivityLog.project_id == project_id)
    else:
        # Get user's projects
        from app.models.project import Project, ProjectMember
        project_ids = await db.execute(
            select(Project.id).where(Project.owner_id == current_user.id)
        )
        project_ids = [p[0] for p in project_ids.all()]

        member_projects = await db.execute(
            select(ProjectMember.project_id).where(ProjectMember.user_id == current_user.id)
        )
        project_ids.extend([p[0] for p in member_projects.all()])

        if project_ids:
            query = query.where(ActivityLog.project_id.in_(project_ids))
        else:
            query = query.where(ActivityLog.user_id == current_user.id)

    query = query.order_by(ActivityLog.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


from datetime import datetime
from typing import Optional