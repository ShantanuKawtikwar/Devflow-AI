from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.project import ProjectStatus, ProjectPriority
from app.models.team import TeamRole


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    key: str = Field(..., min_length=2, max_length=10, pattern=r'^[A-Z][A-Z0-9]*$')
    status: ProjectStatus = ProjectStatus.PLANNING
    priority: ProjectPriority = ProjectPriority.MEDIUM
    team_id: Optional[uuid.UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    key: Optional[str] = Field(None, min_length=2, max_length=10, pattern=r'^[A-Z][A-Z0-9]*$')
    status: Optional[ProjectStatus] = None
    priority: Optional[ProjectPriority] = None
    team_id: Optional[uuid.UUID] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_active: Optional[bool] = None


class ProjectMemberBase(BaseModel):
    user_id: uuid.UUID
    role: TeamRole = TeamRole.MEMBER


class ProjectMemberCreate(ProjectMemberBase):
    pass


class ProjectMemberUpdate(BaseModel):
    role: Optional[TeamRole] = None


class ProjectMemberResponse(ProjectMemberBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    joined_at: datetime
    user: Optional["UserResponse"] = None


class ProjectResponse(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: Optional[uuid.UUID]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    owner: Optional["UserResponse"] = None
    team: Optional["TeamResponse"] = None
    members: List[ProjectMemberResponse] = []
    task_count: int = 0
    completed_task_count: int = 0


class ProjectWithStats(ProjectResponse):
    task_count: int
    completed_task_count: int
    sprint_count: int
    active_sprint: Optional["SprintResponse"] = None


from app.schemas.user import UserResponse
from app.schemas.team import TeamResponse
from app.schemas.sprint import SprintResponse
ProjectMemberResponse.model_rebuild()
ProjectResponse.model_rebuild()
ProjectWithStats.model_rebuild()