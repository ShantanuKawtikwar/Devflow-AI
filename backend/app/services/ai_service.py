import os
import json
from typing import Optional, List
from datetime import datetime, timedelta
import uuid

from openai import AsyncOpenAI
from anthropic import AsyncAnthropic

from app.core.config import settings
from app.schemas.ai import (
    TaskGenerationRequest, TaskGenerationResponse, GeneratedTask,
    TaskSummarizationRequest, TaskSummarizationResponse,
    SprintPlanningRequest, SprintPlanningResponse, SuggestedSprint,
    ProjectInsightsRequest, ProjectInsightsResponse,
    GitHubActivitySummaryRequest, GitHubActivitySummaryResponse,
    DevelopmentSuggestionsRequest, DevelopmentSuggestionsResponse, Suggestion,
    ProjectDocumentationRequest, ProjectDocumentationResponse
)


class AIService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self.openai_client = None
        self.anthropic_client = None

        if settings.OPENAI_API_KEY:
            self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        if settings.ANTHROPIC_API_KEY:
            self.anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

    async def _call_llm(self, prompt: str, system_prompt: str = "") -> str:
        """Call the configured LLM provider"""
        if self.provider == "openai" and self.openai_client:
            return await self._call_openai(prompt, system_prompt)
        elif self.provider == "anthropic" and self.anthropic_client:
            return await self._call_anthropic(prompt, system_prompt)
        else:
            # Fallback for when no AI is configured
            return self._fallback_response(prompt)

    async def _call_openai(self, prompt: str, system_prompt: str) -> str:
        try:
            response = await self.openai_client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            return self._fallback_response(prompt)

    async def _call_anthropic(self, prompt: str, system_prompt: str) -> str:
        try:
            response = await self.anthropic_client.messages.create(
                model=settings.ANTHROPIC_MODEL,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=2000,
                temperature=0.7
            )
            return response.content[0].text if response.content else ""
        except Exception as e:
            return self._fallback_response(prompt)

    def _fallback_response(self, prompt: str) -> str:
        return "AI service is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in environment variables."

    # Task Generation
    async def generate_tasks(self, request: TaskGenerationRequest) -> TaskGenerationResponse:
        system_prompt = """You are a senior software engineer and project manager.
        Convert project descriptions into actionable development tasks.
        Output as JSON array of tasks with: title, description, priority (low/medium/high/urgent), story_points (1-100), labels."""

        prompt = f"""Project Description: {request.project_description}

Generate up to {request.max_tasks} actionable development tasks for this project.
Focus on: setup, core features, testing, documentation, deployment.
Return valid JSON array only."""

        response = await self._call_llm(prompt, system_prompt)

        try:
            tasks_data = json.loads(response)
            tasks = [GeneratedTask(**t) for t in tasks_data[:request.max_tasks]]
            return TaskGenerationResponse(tasks=tasks)
        except:
            # Fallback tasks
            return TaskGenerationResponse(tasks=[
                GeneratedTask(title="Project Setup", description="Initialize repository, configure CI/CD, set up development environment", priority="high", story_points=5, labels=["setup", "infrastructure"]),
                GeneratedTask(title="Core Feature Implementation", description="Implement main application features", priority="high", story_points=13, labels=["feature"]),
                GeneratedTask(title="Testing", description="Write unit and integration tests", priority="medium", story_points=8, labels=["testing"]),
                GeneratedTask(title="Documentation", description="Write README, API docs, and user guides", priority="medium", story_points=5, labels=["documentation"]),
                GeneratedTask(title="Deployment", description="Configure production deployment and monitoring", priority="high", story_points=5, labels=["deployment", "devops"]),
            ])

    # Task Summarization
    async def summarize_task(self, request: TaskSummarizationRequest) -> TaskSummarizationResponse:
        system_prompt = """You are a technical writer. Summarize the given content concisely.
        Return JSON with: summary (max 200 chars), key_points (array of 3-5 points)."""

        prompt = f"""Summarize this task content in {request.max_length} characters or less:

{request.content}

Return valid JSON only."""

        response = await self._call_llm(prompt, system_prompt)

        try:
            data = json.loads(response)
            return TaskSummarizationResponse(**data)
        except:
            return TaskSummarizationResponse(
                summary=request.content[:request.max_length] + "..." if len(request.content) > request.max_length else request.content,
                key_points=["Summary unavailable - AI not configured"]
            )

    # Sprint Planning
    async def plan_sprints(self, request: SprintPlanningRequest) -> SprintPlanningResponse:
        system_prompt = """You are an agile coach. Plan sprints based on project tasks.
        Return JSON array of sprints with: name, goal, start_date, end_date, task_ids, total_story_points."""

        prompt = f"""Plan sprints for project {request.project_id}.
Sprint duration: {request.sprint_duration_days} days
Team size: {request.team_size}
Assume tasks are already created with story points.

Return valid JSON array of suggested sprints."""

        response = await self._call_llm(prompt, system_prompt)

        try:
            sprints_data = json.loads(response)
            sprints = []
            for i, s in enumerate(sprints_data):
                start = datetime.utcnow() + timedelta(days=i * request.sprint_duration_days)
                end = start + timedelta(days=request.sprint_duration_days)
                sprints.append(SuggestedSprint(
                    name=s.get("name", f"Sprint {i+1}"),
                    goal=s.get("goal", ""),
                    start_date=start,
                    end_date=end,
                    task_ids=[uuid.UUID(tid) for tid in s.get("task_ids", [])],
                    total_story_points=s.get("total_story_points", 0)
                ))
            return SprintPlanningResponse(suggested_sprints=sprints)
        except:
            return SprintPlanningResponse(suggested_sprints=[])

    # Project Insights
    async def get_project_insights(self, request: ProjectInsightsRequest) -> ProjectInsightsResponse:
        system_prompt = """You are a project analyst. Analyze project data and provide insights.
        Return JSON with: progress_percentage, velocity, estimated_completion, risks, recommendations, blocked_tasks, overdue_tasks."""

        prompt = f"""Analyze project {request.project_id} and provide insights.

Return valid JSON with project health metrics."""

        response = await self._call_llm(prompt, system_prompt)

        try:
            return ProjectInsightsResponse(**json.loads(response))
        except:
            return ProjectInsightsResponse(
                progress_percentage=0.0,
                velocity=0.0,
                risks=["AI insights unavailable - configure API key"],
                recommendations=["Set up AI provider for automated insights"]
            )

    # GitHub Activity Summary
    async def summarize_github_activity(self, request: GitHubActivitySummaryRequest) -> GitHubActivitySummaryResponse:
        system_prompt = """You are a developer advocate. Summarize GitHub activity.
        Return JSON with: commits_count, pull_requests_count, issues_count, contributors, summary."""

        prompt = f"""Summarize GitHub activity for repository {request.repository_id} over last {request.days} days.

Return valid JSON summary."""

        response = await self._call_llm(prompt, system_prompt)

        try:
            return GitHubActivitySummaryResponse(**json.loads(response))
        except:
            return GitHubActivitySummaryResponse(
                commits_count=0,
                pull_requests_count=0,
                issues_count=0,
                contributors=[],
                summary="GitHub summary unavailable - configure AI provider"
            )

    # Development Suggestions
    async def get_development_suggestions(self, request: DevelopmentSuggestionsRequest) -> DevelopmentSuggestionsResponse:
        system_prompt = """You are a senior developer. Provide personalized development suggestions.
        Return JSON array of suggestions with: type, title, description, related_task_id, priority (1-5)."""

        prompt = f"""Provide development suggestions for user {request.user_id} in project {request.project_id}.

Return valid JSON array of suggestions."""

        response = await self._call_llm(prompt, system_prompt)

        try:
            suggestions_data = json.loads(response)
            suggestions = [Suggestion(**s) for s in suggestions_data]
            return DevelopmentSuggestionsResponse(suggestions=suggestions)
        except:
            return DevelopmentSuggestionsResponse(suggestions=[
                Suggestion(type="priority", title="Focus on high-priority tasks", description="Complete urgent and high-priority tasks first", priority=5),
                Suggestion(type="review", title="Review pull requests", description="Help unblock teammates by reviewing PRs", priority=4),
            ])

    # Project Documentation
    async def generate_documentation(self, request: ProjectDocumentationRequest) -> ProjectDocumentationResponse:
        system_prompt = """You are a technical writer. Generate project documentation.
        Return JSON with: readme, api_docs, contributing."""

        prompt = f"""Generate documentation for project {request.project_id}.
Include tasks: {request.include_tasks}, GitHub: {request.include_github}.

Return valid JSON with documentation sections."""

        response = await self._call_llm(prompt, system_prompt)

        try:
            return ProjectDocumentationResponse(**json.loads(response))
        except:
            return ProjectDocumentationResponse(
                readme=f"# Project {request.project_id}\n\nDocumentation generated by DevFlow AI.\n\nConfigure AI provider for detailed documentation.",
                api_docs="API documentation unavailable",
                contributing="Contributing guidelines unavailable"
            )


ai_service = AIService()