from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime
import uuid

from app.models.notification import NotificationType


class NotificationBase(BaseModel):
    type: NotificationType
    title: str = Field(..., min_length=1, max_length=255)
    message: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[uuid.UUID] = None


class NotificationCreate(NotificationBase):
    user_id: uuid.UUID


class NotificationResponse(NotificationBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    is_read: bool
    read_at: Optional[datetime]
    created_at: datetime


class NotificationMarkRead(BaseModel):
    notification_ids: List[uuid.UUID]


class ActivityLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    action: str
    entity_type: str
    entity_id: uuid.UUID
    entity_name: Optional[str]
    project_id: Optional[uuid.UUID]
    details: Optional[str]
    created_at: datetime
    user: Optional["UserResponse"] = None


from app.schemas.user import UserResponse
ActivityLogResponse.model_rebuild()