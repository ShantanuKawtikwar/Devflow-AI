from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid


class TaskGenerationRequest(BaseModel):
    project_description: str = Field(..., min_length=10)
    project_id: uuid.UUID
    max_tasks: int = Field(default=10, ge=1, le=50)


class TaskGenerationResponse(BaseModel):
    tasks: List["GeneratedTask"]


class GeneratedTask(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = Field(default="medium", pattern=r'^(low|medium|high|urgent)$')
    story_points: Optional[int] = Field(None, ge=0, le=100)
    labels: List[str] = []


class TaskSummarizationRequest(BaseModel):
    content: str = Field(..., min_length=10)
    max_length: int = Field(default=200, ge=50, le=1000)


class TaskSummarizationResponse(BaseModel):
    summary: str
    key_points: List[str] = []


class SprintPlanningRequest(BaseModel):
    project_id: uuid.UUID
    sprint_duration_days: int = Field(default=14, ge=7, le=30)
    team_size: int = Field(default=1, ge=1, le=20)


class SprintPlanningResponse(BaseModel):
    suggested_sprints: List["SuggestedSprint"]


class SuggestedSprint(BaseModel):
    name: str
    goal: str
    start_date: datetime
    end_date: datetime
    task_ids: List[uuid.UUID]
    total_story_points: int


class ProjectInsightsRequest(BaseModel):
    project_id: uuid.UUID


class ProjectInsightsResponse(BaseModel):
    progress_percentage: float
    velocity: float
    estimated_completion: Optional[datetime] = None
    risks: List[str] = []
    recommendations: List[str] = []
    blocked_tasks: int = 0
    overdue_tasks: int = 0


class GitHubActivitySummaryRequest(BaseModel):
    repository_id: uuid.UUID
    days: int = Field(default=7, ge=1, le=90)


class GitHubActivitySummaryResponse(BaseModel):
    commits_count: int
    pull_requests_count: int
    issues_count: int
    contributors: List[str] = []
    summary: str


class DevelopmentSuggestionsRequest(BaseModel):
    project_id: uuid.UUID
    user_id: uuid.UUID


class DevelopmentSuggestionsResponse(BaseModel):
    suggestions: List["Suggestion"]


class Suggestion(BaseModel):
    type: str  # priority, blocked, review, etc.
    title: str
    description: str
    related_task_id: Optional[uuid.UUID] = None
    priority: int = Field(default=1, ge=1, le=5)


class ProjectDocumentationRequest(BaseModel):
    project_id: uuid.UUID
    include_tasks: bool = True
    include_github: bool = True


class ProjectDocumentationResponse(BaseModel):
    readme: str
    api_docs: Optional[str] = None
    contributing: Optional[str] = None