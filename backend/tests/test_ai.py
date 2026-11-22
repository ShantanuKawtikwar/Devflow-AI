import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Project, Task, TaskStatus
from app.core.security import get_password_hash


class TestAIService:
    """Tests for AI-powered features."""

    @pytest.mark.asyncio
    async def test_generate_tasks(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test AI task generation."""
        project = Project(name="AI Project", key="AIP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        mock_response = {
            "tasks": [
                {
                    "title": "Set up project structure",
                    "description": "Initialize the project with proper folder structure",
                    "priority": "high",
                    "story_points": 3,
                },
                {
                    "title": "Create database models",
                    "description": "Define SQLAlchemy models for all entities",
                    "priority": "high",
                    "story_points": 5,
                },
                {
                    "title": "Build API endpoints",
                    "description": "Create RESTful API endpoints for CRUD operations",
                    "priority": "medium",
                    "story_points": 8,
                },
            ]
        }

        with patch("app.services.ai_service.AIService.generate_tasks") as mock_generate:
            mock_generate.return_value = mock_response

            response = await client.post(
                f"/api/v1/ai/projects/{project.id}/generate-tasks",
                headers=auth_headers,
                json={"description": "Build a task management app", "count": 3},
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["tasks"]) == 3
            assert data["tasks"][0]["title"] == "Set up project structure"

    @pytest.mark.asyncio
    async def test_generate_tasks_no_api_key(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test task generation falls back when no API key."""
        project = Project(name="No Key Project", key="NKP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        with patch("app.services.ai_service.AIService.generate_tasks") as mock_generate:
            # Simulate fallback response
            mock_generate.return_value = {
                "tasks": [
                    {
                        "title": "Fallback Task 1",
                        "description": "Generated without AI",
                        "priority": "medium",
                        "story_points": 3,
                    }
                ]
            }

            response = await client.post(
                f"/api/v1/ai/projects/{project.id}/generate-tasks",
                headers=auth_headers,
                json={"description": "Build something", "count": 1},
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["tasks"]) == 1

    @pytest.mark.asyncio
    async def test_summarize_project(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test AI project summarization."""
        project = Project(name="Summary Project", key="SP", description="A project to test summarization", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        # Add some tasks
        for i in range(3):
            task = Task(
                title=f"Task {i}",
                description=f"Description for task {i}",
                project_id=project.id,
                reporter_id=test_user.id,
                status=TaskStatus.DONE if i < 2 else TaskStatus.IN_PROGRESS,
            )
            test_db.add(task)
        await test_db.commit()

        mock_summary = {
            "summary": "This project has 3 tasks. 2 are completed and 1 is in progress. The project is on track.",
            "key_metrics": {
                "total_tasks": 3,
                "completed": 2,
                "in_progress": 1,
                "completion_rate": 66.7,
            },
            "recommendations": [
                "Focus on completing the remaining in-progress task",
                "Consider adding more tasks to the backlog",
            ],
        }

        with patch("app.services.ai_service.AIService.summarize_project") as mock_summarize:
            mock_summarize.return_value = mock_summary

            response = await client.post(
                f"/api/v1/ai/projects/{project.id}/summarize",
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert "summary" in data
            assert "key_metrics" in data
            assert data["key_metrics"]["total_tasks"] == 3

    @pytest.mark.asyncio
    async def test_plan_sprint(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test AI sprint planning."""
        project = Project(name="Sprint Plan Project", key="SPP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        # Add backlog tasks
        for i in range(5):
            task = Task(
                title=f"Backlog Task {i}",
                description=f"Description {i}",
                project_id=project.id,
                reporter_id=test_user.id,
                status=TaskStatus.BACKLOG,
                priority="high" if i < 2 else "medium",
                story_points=i + 1,
            )
            test_db.add(task)
        await test_db.commit()

        mock_plan = {
            "sprint_name": "Sprint 1",
            "sprint_goal": "Complete high priority tasks",
            "selected_tasks": [
                {"task_id": "1", "title": "Backlog Task 0", "story_points": 1},
                {"task_id": "2", "title": "Backlog Task 1", "story_points": 2},
                {"task_id": "3", "title": "Backlog Task 2", "story_points": 3},
            ],
            "total_story_points": 6,
            "capacity": 8,
            "reasoning": "Selected top 3 high priority tasks that fit within capacity",
        }

        with patch("app.services.ai_service.AIService.plan_sprint") as mock_plan_sprint:
            mock_plan_sprint.return_value = mock_plan

            response = await client.post(
                f"/api/v1/ai/projects/{project.id}/plan-sprint",
                headers=auth_headers,
                json={"sprint_name": "Sprint 1", "capacity": 8},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["sprint_name"] == "Sprint 1"
            assert data["total_story_points"] == 6
            assert len(data["selected_tasks"]) == 3

    @pytest.mark.asyncio
    async def test_generate_insights(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test AI insights generation."""
        project = Project(name="Insights Project", key="IP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        mock_insights = {
            "insights": [
                {
                    "type": "velocity",
                    "title": "Velocity Improving",
                    "description": "Team velocity has increased 15% over last 3 sprints",
                    "severity": "positive",
                },
                {
                    "type": "bottleneck",
                    "title": "Review Bottleneck",
                    "description": "Tasks spend 40% of time in review. Consider adding more reviewers.",
                    "severity": "warning",
                },
            ],
            "metrics": {
                "avg_cycle_time": 3.5,
                "avg_lead_time": 5.2,
                "throughput": 8,
            },
        }

        with patch("app.services.ai_service.AIService.generate_insights") as mock_insights:
            mock_insights.return_value = mock_insights

            response = await client.post(
                f"/api/v1/ai/projects/{project.id}/insights",
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert len(data["insights"]) == 2
            assert data["insights"][0]["type"] == "velocity"
            assert data["metrics"]["throughput"] == 8

    @pytest.mark.asyncio
    async def test_ai_chat(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test AI chat endpoint."""
        project = Project(name="Chat Project", key="CP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        mock_response = {
            "response": "Based on your project data, I recommend focusing on the high-priority tasks in the backlog.",
            "suggestions": [
                "Prioritize tasks with highest business value",
                "Consider breaking down large tasks",
            ],
        }

        with patch("app.services.ai_service.AIService.chat") as mock_chat:
            mock_chat.return_value = mock_response

            response = await client.post(
                f"/api/v1/ai/projects/{project.id}/chat",
                headers=auth_headers,
                json={"message": "What should I work on next?"},
            )
            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert "suggestions" in data

    @pytest.mark.asyncio
    async def test_ai_chat_with_context(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test AI chat with conversation history."""
        project = Project(name="Chat Context Project", key="CCP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        mock_response = {
            "response": "Continuing from our previous discussion about task prioritization...",
            "suggestions": [],
        }

        with patch("app.services.ai_service.AIService.chat") as mock_chat:
            mock_chat.return_value = mock_response

            response = await client.post(
                f"/api/v1/ai/projects/{project.id}/chat",
                headers=auth_headers,
                json={
                    "message": "Can you elaborate?",
                    "conversation_id": "conv-123",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert "response" in data


class TestAIServiceFallback:
    """Tests for AI service fallback behavior."""

    @pytest.mark.asyncio
    async def test_fallback_task_generation(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test fallback task generation when AI provider unavailable."""
        from app.services.ai_service import AIService

        project = Project(name="Fallback Project", key="FBP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        # Test the fallback method directly
        service = AIService()
        result = await service._fallback_generate_tasks("Build a web app", 3)

        assert "tasks" in result
        assert len(result["tasks"]) == 3
        for task in result["tasks"]:
            assert "title" in task
            assert "description" in task
            assert "priority" in task
            assert "story_points" in task

    @pytest.mark.asyncio
    async def test_fallback_summarize(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test fallback project summarization."""
        from app.services.ai_service import AIService

        project = Project(name="Fallback Summary", key="FSP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        # Add tasks
        for i in range(3):
            task = Task(title=f"Task {i}", project_id=project.id, reporter_id=test_user.id, status=TaskStatus.DONE)
            test_db.add(task)
        await test_db.commit()

        service = AIService()
        result = await service._fallback_summarize_project(project, [])

        assert "summary" in result
        assert "key_metrics" in result
        assert result["key_metrics"]["total_tasks"] == 3