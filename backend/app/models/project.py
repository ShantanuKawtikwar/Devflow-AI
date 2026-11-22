from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Text, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.database.base import Base
from app.models.team import TeamRole


class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"


class ProjectPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), index=True, nullable=False)
    description = Column(Text)
    key = Column(String(10), unique=True, index=True, nullable=False)  # e.g., "DF", "PROJ"
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.PLANNING, nullable=False)
    priority = Column(SQLEnum(ProjectPriority), default=ProjectPriority.MEDIUM, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"))
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    owner = relationship("User", back_populates="owned_projects")
    team = relationship("Team", back_populates="projects")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project")
    sprints = relationship("Sprint", back_populates="project")
    github_repos = relationship("GitHubRepository", back_populates="project")

    __table_args__ = (
        Index('ix_projects_owner_team', 'owner_id', 'team_id'),
    )

    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, key={self.key})>"


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(SQLEnum(TeamRole), default=TeamRole.MEMBER, nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships")

    __table_args__ = (
        Index('ix_project_members_project_user', 'project_id', 'user_id', unique=True),
    )

    def __repr__(self):
        return f"<ProjectMember(project_id={self.project_id}, user_id={self.user_id})>"