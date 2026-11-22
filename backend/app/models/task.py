from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Text, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.database.base import Base


class TaskStatus(str, enum.Enum):
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"


class TaskPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(500), nullable=False)
    description = Column(Text)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    sprint_id = Column(UUID(as_uuid=True), ForeignKey("sprints.id", ondelete="SET NULL"))
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.BACKLOG, nullable=False)
    priority = Column(SQLEnum(TaskPriority), default=TaskPriority.MEDIUM, nullable=False)
    order = Column(Integer, default=0)  # For Kanban ordering
    story_points = Column(Integer)
    due_date = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="tasks")
    sprint = relationship("Sprint", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assignee_id], back_populates="assigned_tasks")
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_tasks")
    comments = relationship("TaskComment", back_populates="task", cascade="all, delete-orphan")
    labels = relationship("TaskLabel", back_populates="task", cascade="all, delete-orphan")
    github_issues = relationship("GitHubLinkedIssue", back_populates="task")
    github_prs = relationship("GitHubPullRequest", back_populates="task")

    __table_args__ = (
        Index('ix_tasks_project_status', 'project_id', 'status'),
        Index('ix_tasks_assignee_status', 'assignee_id', 'status'),
        Index('ix_tasks_sprint', 'sprint_id'),
    )

    def __repr__(self):
        return f"<Task(id={self.id}, title={self.title}, status={self.status})>"


class TaskComment(Base):
    __tablename__ = "task_comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="comments")
    author = relationship("User", back_populates="comments")

    def __repr__(self):
        return f"<TaskComment(id={self.id}, task_id={self.task_id})>"


class TaskLabel(Base):
    __tablename__ = "task_labels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#6366f1")  # Hex color

    # Relationships
    task = relationship("Task", back_populates="labels")

    __table_args__ = (
        Index('ix_task_labels_task', 'task_id'),
    )

    def __repr__(self):
        return f"<TaskLabel(id={self.id}, name={self.name})>"