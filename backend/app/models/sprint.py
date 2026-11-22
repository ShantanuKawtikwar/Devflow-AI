from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Text, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.database.base import Base


class SprintStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Sprint(Base):
    __tablename__ = "sprints"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    goal = Column(Text)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(SprintStatus), default=SprintStatus.PLANNING, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="sprints")
    tasks = relationship("Task", back_populates="sprint")

    __table_args__ = (
        Index('ix_sprints_project_status', 'project_id', 'status'),
        Index('ix_sprints_dates', 'start_date', 'end_date'),
    )

    def __repr__(self):
        return f"<Sprint(id={self.id}, name={self.name}, status={self.status})>"