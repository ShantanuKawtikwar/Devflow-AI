from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.task import TaskStatus, TaskPriority


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    project_id: uuid.UUID
    sprint_id: Optional[uuid.UUID] = None
    assignee_id: Optional[uuid.UUID] = None
    status: TaskStatus = TaskStatus.BACKLOG
    priority: TaskPriority = TaskPriority.MEDIUM
    order: int = 0
    story_points: Optional[int] = Field(None, ge=0)
    due_date: Optional[datetime] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    sprint_id: Optional[uuid.UUID] = None
    assignee_id: Optional[uuid.UUID] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    order: Optional[int] = None
    story_points: Optional[int] = Field(None, ge=0)
    due_date: Optional[datetime] = None


class TaskMove(BaseModel):
    status: TaskStatus
    order: int


class TaskLabelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    color: str = Field(default="#6366f1", pattern=r'^#[0-9a-fA-F]{6}$')


class TaskLabelCreate(TaskLabelBase):
    pass


class TaskLabelResponse(TaskLabelBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID


class TaskCommentBase(BaseModel):
    content: str = Field(..., min_length=1)


class TaskCommentCreate(TaskCommentBase):
    pass


class TaskCommentUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1)


class TaskCommentResponse(TaskCommentBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    author: Optional["UserResponse"] = None


class TaskResponse(TaskBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    creator_id: Optional[uuid.UUID]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    assignee: Optional["UserResponse"] = None
    creator: Optional["UserResponse"] = None
    labels: List[TaskLabelResponse] = []
    comments_count: int = 0


class TaskWithDetails(TaskResponse):
    comments: List[TaskCommentResponse] = []


from app.schemas.user import UserResponse
TaskCommentResponse.model_rebuild()
TaskResponse.model_rebuild()
TaskWithDetails.model_rebuild()