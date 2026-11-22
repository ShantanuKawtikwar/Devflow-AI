import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Project, Task, TaskStatus, TaskPriority


class TestTasks:
    """Tests for task endpoints."""

    @pytest.mark.asyncio
    async def test_create_task(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test creating a task."""
        project = Project(name="Task Project", key="TP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            headers=auth_headers,
            json={
                "title": "New Task",
                "description": "Task description",
                "status": "backlog",
                "priority": "high",
                "story_points": 5,
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Task"
        assert data["project_id"] == str(project.id)
        assert data["reporter_id"] == str(test_user.id)
        assert data["story_points"] == 5

    @pytest.mark.asyncio
    async def test_create_task_with_assignee(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test creating a task with assignee."""
        from app.core.security import get_password_hash
        assignee = User(
            email="assignee@example.com",
            username="assignee",
            full_name="Assignee User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(assignee)
        await test_db.commit()
        await test_db.refresh(assignee)

        project = Project(name="Task Project 2", key="TP2", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            headers=auth_headers,
            json={
                "title": "Assigned Task",
                "assignee_id": str(assignee.id),
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["assignee_id"] == str(assignee.id)

    @pytest.mark.asyncio
    async def test_list_tasks(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test listing tasks."""
        project = Project(name="Task List Project", key="TLP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        for i in range(5):
            task = Task(
                title=f"Task {i}",
                project_id=project.id,
                reporter_id=test_user.id,
                status=TaskStatus.BACKLOG if i % 2 == 0 else TaskStatus.TODO,
            )
            test_db.add(task)
        await test_db.commit()

        response = await client.get(f"/api/v1/projects/{project.id}/tasks", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert len(data["items"]) == 5

    @pytest.mark.asyncio
    async def test_list_tasks_with_filters(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test listing tasks with status and assignee filters."""
        project = Project(name="Filter Project", key="FP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        task1 = Task(title="Backlog Task", project_id=project.id, reporter_id=test_user.id, status=TaskStatus.BACKLOG)
        task2 = Task(title="In Progress Task", project_id=project.id, reporter_id=test_user.id, status=TaskStatus.IN_PROGRESS)
        task3 = Task(title="Done Task", project_id=project.id, reporter_id=test_user.id, status=TaskStatus.DONE)
        test_db.add_all([task1, task2, task3])
        await test_db.commit()

        response = await client.get(f"/api/v1/projects/{project.id}/tasks?status=backlog", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["status"] == "backlog"

    @pytest.mark.asyncio
    async def test_get_task(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test getting a single task."""
        project = Project(name="Get Task Project", key="GTP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        task = Task(title="Get Me", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.get(f"/api/v1/tasks/{task.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(task.id)
        assert data["title"] == "Get Me"

    @pytest.mark.asyncio
    async def test_update_task(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test updating a task."""
        project = Project(name="Update Project", key="UP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        task = Task(title="Original Title", project_id=project.id, reporter_id=test_user.id, status=TaskStatus.TODO)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.put(
            f"/api/v1/tasks/{task.id}",
            headers=auth_headers,
            json={"title": "Updated Title", "status": "in_progress", "priority": "urgent"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "in_progress"
        assert data["priority"] == "urgent"

    @pytest.mark.asyncio
    async def test_update_task_status_completes(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test that completing a task sets completed_at."""
        project = Project(name="Complete Project", key="CP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        task = Task(title="To Complete", project_id=project.id, reporter_id=test_user.id, status=TaskStatus.IN_PROGRESS)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.put(
            f"/api/v1/tasks/{task.id}",
            headers=auth_headers,
            json={"status": "done"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "done"
        assert data["completed_at"] is not None

    @pytest.mark.asyncio
    async def test_delete_task(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test deleting a task."""
        project = Project(name="Delete Project", key="DP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        task = Task(title="To Delete", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.delete(f"/api/v1/tasks/{task.id}", headers=auth_headers)
        assert response.status_code == 200

        response = await client.get(f"/api/v1/tasks/{task.id}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_move_task_to_sprint(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test moving a task to a sprint."""
        from app.models import Sprint, SprintStatus

        project = Project(name="Sprint Project", key="SP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        sprint = Sprint(
            name="Sprint 1",
            project_id=project.id,
            start_date=datetime.utcnow(),
            end_date=datetime.utcnow() + timedelta(days=14),
            status=SprintStatus.ACTIVE,
        )
        test_db.add(sprint)
        await test_db.commit()
        await test_db.refresh(sprint)

        task = Task(title="Sprint Task", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.put(
            f"/api/v1/tasks/{task.id}",
            headers=auth_headers,
            json={"sprint_id": str(sprint.id)},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sprint_id"] == str(sprint.id)

    @pytest.mark.asyncio
    async def test_add_task_comment(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test adding a comment to a task."""
        project = Project(name="Comment Project", key="COMP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        task = Task(title="Comment Task", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.post(
            f"/api/v1/tasks/{task.id}/comments",
            headers=auth_headers,
            json={"content": "This is a comment"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "This is a comment"
        assert data["author_id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_get_task_comments(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test getting task comments."""
        project = Project(name="Comment List Project", key="CLP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        task = Task(title="Comment List Task", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        from app.models import TaskComment
        comment1 = TaskComment(content="Comment 1", task_id=task.id, author_id=test_user.id)
        comment2 = TaskComment(content="Comment 2", task_id=task.id, author_id=test_user.id)
        test_db.add_all([comment1, comment2])
        await test_db.commit()

        response = await client.get(f"/api/v1/tasks/{task.id}/comments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestTaskLabels:
    """Tests for task label endpoints."""

    @pytest.mark.asyncio
    async def test_create_label(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test creating a label."""
        project = Project(name="Label Project", key="LBP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.post(
            f"/api/v1/projects/{project.id}/labels",
            headers=auth_headers,
            json={"name": "bug", "color": "#ef4444", "description": "Bug reports"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "bug"
        assert data["color"] == "#ef4444"

    @pytest.mark.asyncio
    async def test_add_label_to_task(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test adding a label to a task."""
        project = Project(name="Label Task Project", key="LTP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        from app.models import Label
        label = Label(name="feature", color="#22c55e", project_id=project.id)
        test_db.add(label)
        await test_db.commit()
        await test_db.refresh(label)

        task = Task(title="Labeled Task", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.post(
            f"/api/v1/tasks/{task.id}/labels/{label.id}",
            headers=auth_headers,
        )
        assert response.status_code == 201

        # Verify label is attached
        response = await client.get(f"/api/v1/tasks/{task.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["labels"]) == 1
        assert data["labels"][0]["name"] == "feature"