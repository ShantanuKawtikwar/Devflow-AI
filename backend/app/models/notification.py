from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.database.base import Base


class NotificationType(str, enum.Enum):
    TASK_ASSIGNED = "task_assigned"
    TASK_UPDATED = "task_updated"
    TASK_COMMENT = "task_comment"
    DEADLINE_REMINDER = "deadline_reminder"
    PROJECT_UPDATE = "project_update"
    SPRINT_UPDATE = "sprint_update"
    GITHUB_ACTIVITY = "github_activity"
    MENTION = "mention"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    reference_type = Column(String(50))  # task, project, sprint, github_pr, etc.
    reference_id = Column(UUID(as_uuid=True))
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications")

    __table_args__ = (
        Index('ix_notifications_user_read', 'user_id', 'is_read'),
        Index('ix_notifications_created', 'created_at'),
    )

    def __repr__(self):
        return f"<Notification(id={self.id}, type={self.type}, is_read={self.is_read})>"


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    action = Column(String(100), nullable=False)  # created, updated, deleted, commented, etc.
    entity_type = Column(String(50), nullable=False)  # task, project, sprint, comment, etc.
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    entity_name = Column(String(255))  # For display purposes
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"))
    details = Column(Text)  # JSON string of changes
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="activity_logs")

    __table_args__ = (
        Index('ix_activity_logs_user_created', 'user_id', 'created_at'),
        Index('ix_activity_logs_entity', 'entity_type', 'entity_id'),
        Index('ix_activity_logs_project_created', 'project_id', 'created_at'),
    )

    def __repr__(self):
        return f"<ActivityLog(action={self.action}, entity={self.entity_type})>"