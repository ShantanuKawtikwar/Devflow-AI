from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.sprint import SprintStatus


class SprintBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    goal: Optional[str] = None
    project_id: uuid.UUID
    start_date: datetime
    end_date: datetime


class SprintCreate(SprintBase):
    pass


class SprintUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    goal: Optional[str] = None
    status: Optional[SprintStatus] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class SprintResponse(SprintBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: SprintStatus
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    project: Optional["ProjectResponse"] = None
    task_count: int = 0
    completed_task_count: int = 0
    total_story_points: int = 0
    completed_story_points: int = 0


class SprintWithTasks(SprintResponse):
    tasks: List["TaskResponse"] = []


from app.schemas.project import ProjectResponse
from app.schemas.task import TaskResponse
SprintResponse.model_rebuild()
SprintWithTasks.model_rebuild()