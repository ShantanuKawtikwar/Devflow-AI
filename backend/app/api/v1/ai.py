from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database.base import get_db
from app.core.deps import get_current_active_user
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.github import GitHubRepository
from app.services.ai_service import ai_service
from app.schemas.ai import (
    TaskGenerationRequest, TaskGenerationResponse,
    TaskSummarizationRequest, TaskSummarizationResponse,
    SprintPlanningRequest, SprintPlanningResponse,
    ProjectInsightsRequest, ProjectInsightsResponse,
    GitHubActivitySummaryRequest, GitHubActivitySummaryResponse,
    DevelopmentSuggestionsRequest, DevelopmentSuggestionsResponse,
    ProjectDocumentationRequest, ProjectDocumentationResponse
)

router = APIRouter(prefix="/ai", tags=["ai"])


async def check_project_access(db: AsyncSession, project_id: uuid.UUID, user_id: uuid.UUID) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check if user is owner, team member, or project member
    if project.owner_id == user_id:
        return project

    if project.team_id:
        from app.models.team import TeamMember
        team_member = await db.execute(
            select(TeamMember).where(TeamMember.team_id == project.team_id, TeamMember.user_id == user_id)
        )
        if team_member.scalar_one_or_none():
            return project

    from app.models.project import ProjectMember
    project_member = await db.execute(
        select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id)
    )
    if project_member.scalar_one_or_none():
        return project

    raise HTTPException(status_code=403, detail="Not authorized to access this project")


@router.post("/generate-tasks", response_model=TaskGenerationResponse)
async def generate_tasks(
    request: TaskGenerationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_project_access(db, request.project_id, current_user.id)
    return await ai_service.generate_tasks(request)


@router.post("/summarize-task", response_model=TaskSummarizationResponse)
async def summarize_task(
    request: TaskSummarizationRequest,
    current_user: User = Depends(get_current_active_user)
):
    return await ai_service.summarize_task(request)


@router.post("/plan-sprints", response_model=SprintPlanningResponse)
async def plan_sprints(
    request: SprintPlanningRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_project_access(db, request.project_id, current_user.id)
    return await ai_service.plan_sprints(request)


@router.post("/project-insights", response_model=ProjectInsightsResponse)
async def project_insights(
    request: ProjectInsightsRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_project_access(db, request.project_id, current_user.id)
    return await ai_service.get_project_insights(request)


@router.post("/github-summary", response_model=GitHubActivitySummaryResponse)
async def github_summary(
    request: GitHubActivitySummaryRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify repository access
    result = await db.execute(select(GitHubRepository).where(GitHubRepository.id == request.repository_id))
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    from app.models.github import GitHubAccount
    account_result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.id == repo.account_id, GitHubAccount.user_id == current_user.id)
    )
    if not account_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    return await ai_service.summarize_github_activity(request)


@router.post("/development-suggestions", response_model=DevelopmentSuggestionsResponse)
async def development_suggestions(
    request: DevelopmentSuggestionsRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if request.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only get suggestions for yourself")

    await check_project_access(db, request.project_id, current_user.id)
    return await ai_service.get_development_suggestions(request)


@router.post("/generate-documentation", response_model=ProjectDocumentationResponse)
async def generate_documentation(
    request: ProjectDocumentationRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    await check_project_access(db, request.project_id, current_user.id)
    return await ai_service.generate_documentation(request)