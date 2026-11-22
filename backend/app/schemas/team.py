from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.team import TeamRole


class TeamBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r'^[a-z0-9-]+$')
    description: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=100, pattern=r'^[a-z0-9-]+$')
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


class TeamMemberBase(BaseModel):
    user_id: uuid.UUID
    role: TeamRole = TeamRole.MEMBER


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberUpdate(BaseModel):
    role: Optional[TeamRole] = None


class TeamMemberResponse(TeamMemberBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID
    joined_at: datetime
    user: Optional["UserResponse"] = None


class TeamResponse(TeamBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    avatar_url: Optional[str]
    created_at: datetime
    updated_at: datetime
    members: List[TeamMemberResponse] = []


class TeamWithMembers(TeamResponse):
    members: List[TeamMemberResponse]


from app.schemas.user import UserResponse
TeamMemberResponse.model_rebuild()