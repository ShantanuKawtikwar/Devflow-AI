import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Project, ProjectStatus, ProjectPriority


class TestProjects:
    """Tests for project endpoints."""

    @pytest.mark.asyncio
    async def test_create_project(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """Test creating a project."""
        response = await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={
                "name": "New Project",
                "key": "NP",
                "description": "A new project",
                "status": "planning",
                "priority": "high",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "New Project"
        assert data["key"] == "NP"
        assert data["status"] == "planning"
        assert data["priority"] == "high"
        assert data["owner_id"] == str(test_user.id)
        assert "id" in data

    @pytest.mark.asyncio
    async def test_create_project_invalid_key(self, client: AsyncClient, auth_headers: dict):
        """Test creating project with invalid key fails."""
        response = await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={
                "name": "New Project",
                "key": "123invalid",  # Must start with letter
                "description": "A new project",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_create_project_duplicate_key(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test creating project with duplicate key fails."""
        # Create first project
        project1 = Project(
            name="Project 1",
            key="DUP",
            owner_id=test_user.id,
        )
        test_db.add(project1)
        await test_db.commit()

        # Try to create second with same key
        response = await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={
                "name": "Project 2",
                "key": "DUP",
                "description": "Another project",
            },
        )
        assert response.status_code == 400
        assert "already exists" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_list_projects(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test listing projects."""
        # Create test projects
        for i in range(3):
            project = Project(
                name=f"Project {i}",
                key=f"PJ{i}",
                owner_id=test_user.id,
            )
            test_db.add(project)
        await test_db.commit()

        response = await client.get("/api/v1/projects/", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert len(data["items"]) == 3

    @pytest.mark.asyncio
    async def test_list_projects_with_filters(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test listing projects with filters."""
        project1 = Project(name="Active Project", key="AP1", status=ProjectStatus.ACTIVE, owner_id=test_user.id)
        project2 = Project(name="Planning Project", key="PP1", status=ProjectStatus.PLANNING, owner_id=test_user.id)
        test_db.add_all([project1, project2])
        await test_db.commit()

        # Filter by status
        response = await client.get("/api/v1/projects/?status=active", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["status"] == "active"

    @pytest.mark.asyncio
    async def test_get_project(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test getting a single project."""
        project = Project(name="Test Project", key="TP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.get(f"/api/v1/projects/{project.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(project.id)
        assert data["name"] == "Test Project"

    @pytest.mark.asyncio
    async def test_get_project_not_found(self, client: AsyncClient, auth_headers: dict):
        """Test getting non-existent project returns 404."""
        import uuid
        response = await client.get(f"/api/v1/projects/{uuid.uuid4()}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_project(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test updating a project."""
        project = Project(name="Original", key="ORIG", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.put(
            f"/api/v1/projects/{project.id}",
            headers=auth_headers,
            json={"name": "Updated Name", "priority": "urgent"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["priority"] == "urgent"

    @pytest.mark.asyncio
    async def test_update_project_unauthorized(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_admin_user: User):
        """Test updating project owned by another user fails."""
        project = Project(name="Other's Project", key="OP", owner_id=test_admin_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.put(
            f"/api/v1/projects/{project.id}",
            headers=auth_headers,
            json={"name": "Hacked"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_delete_project(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test deleting a project."""
        project = Project(name="To Delete", key="DEL", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.delete(f"/api/v1/projects/{project.id}", headers=auth_headers)
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify it's gone
        response = await client.get(f"/api/v1/projects/{project.id}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_add_project_member(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test adding a member to project."""
        # Create another user
        from app.core.security import get_password_hash
        other_user = User(
            email="other@example.com",
            username="otheruser",
            full_name="Other User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(other_user)
        await test_db.commit()
        await test_db.refresh(other_user)

        project = Project(name="Team Project", key="TEAM", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.post(
            f"/api/v1/projects/{project.id}/members",
            headers=auth_headers,
            json={"user_id": str(other_user.id), "role": "member"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["user_id"] == str(other_user.id)
        assert data["role"] == "member"

    @pytest.mark.asyncio
    async def test_remove_project_member(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test removing a member from project."""
        from app.core.security import get_password_hash
        from app.models import ProjectMember

        other_user = User(
            email="member@example.com",
            username="memberuser",
            full_name="Member User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(other_user)
        await test_db.commit()
        await test_db.refresh(other_user)

        project = Project(name="Team Project", key="TEAM2", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        # Add member first
        member = ProjectMember(project_id=project.id, user_id=other_user.id, role="member")
        test_db.add(member)
        await test_db.commit()

        response = await client.delete(
            f"/api/v1/projects/{project.id}/members/{other_user.id}",
            headers=auth_headers,
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_get_project_stats(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test getting project statistics."""
        project = Project(name="Stats Project", key="STATS", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.get(f"/api/v1/projects/{project.id}/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_tasks" in data
        assert "completed_tasks" in data
        assert "by_status" in data
        assert "by_priority" in data