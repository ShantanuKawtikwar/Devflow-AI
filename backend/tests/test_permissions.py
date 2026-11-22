import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, Project, Team, TeamMember, TeamRole, ProjectMember
from app.core.security import get_password_hash


class TestPermissions:
    """Tests for role-based access control."""

    @pytest.mark.asyncio
    async def test_project_owner_can_edit(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test project owner can edit project."""
        project = Project(name="Owner Project", key="OP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.put(
            f"/api/v1/projects/{project.id}",
            headers=auth_headers,
            json={"name": "Updated by Owner"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_project_admin_can_edit(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test project admin can edit project."""
        # Create admin user
        admin = User(
            email="admin@example.com",
            username="projectadmin",
            full_name="Project Admin",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(admin)
        await test_db.commit()
        await test_db.refresh(admin)

        project = Project(name="Admin Project", key="AP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        # Add admin as project member with admin role
        member = ProjectMember(project_id=project.id, user_id=admin.id, role="admin")
        test_db.add(member)
        await test_db.commit()

        # Login as admin
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": admin.email, "password": "password123"},
        )
        admin_token = response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        response = await client.put(
            f"/api/v1/projects/{project.id}",
            headers=admin_headers,
            json={"name": "Updated by Admin"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_project_member_cannot_edit(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test project member cannot edit project."""
        # Create member user
        member_user = User(
            email="member@example.com",
            username="projectmember",
            full_name="Project Member",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(member_user)
        await test_db.commit()
        await test_db.refresh(member_user)

        project = Project(name="Member Project", key="MP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        # Add member
        member = ProjectMember(project_id=project.id, user_id=member_user.id, role="member")
        test_db.add(member)
        await test_db.commit()

        # Login as member
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": member_user.email, "password": "password123"},
        )
        member_token = response.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}

        response = await client.put(
            f"/api/v1/projects/{project.id}",
            headers=member_headers,
            json={"name": "Hacked by Member"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_project_viewer_cannot_edit(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test project viewer cannot edit project."""
        viewer = User(
            email="viewer@example.com",
            username="projectviewer",
            full_name="Project Viewer",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(viewer)
        await test_db.commit()
        await test_db.refresh(viewer)

        project = Project(name="Viewer Project", key="VP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        member = ProjectMember(project_id=project.id, user_id=viewer.id, role="viewer")
        test_db.add(member)
        await test_db.commit()

        response = await client.post(
            "/api/v1/auth/login",
            data={"username": viewer.email, "password": "password123"},
        )
        viewer_token = response.json()["access_token"]
        viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

        response = await client.put(
            f"/api/v1/projects/{project.id}",
            headers=viewer_headers,
            json={"name": "Hacked by Viewer"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_non_member_cannot_access_project(self, client: AsyncClient, test_db: AsyncSession, test_user: User, test_admin_user: User):
        """Test non-member cannot access project."""
        project = Project(name="Private Project", key="PP", owner_id=test_admin_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.get(f"/api/v1/projects/{project.id}", headers=auth_headers)
        assert response.status_code == 404  # Not found (hidden)

    @pytest.mark.asyncio
    async def test_team_owner_can_manage_team(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test team owner can manage team."""
        team = Team(name="Owner Team", slug="owner-team", owner_id=test_user.id)
        test_db.add(team)
        await test_db.commit()
        await test_db.refresh(team)

        response = await client.put(
            f"/api/v1/teams/{team.id}",
            headers=auth_headers,
            json={"name": "Updated Team Name"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_team_admin_can_manage_team(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test team admin can manage team."""
        admin = User(
            email="teamadmin@example.com",
            username="teamadmin",
            full_name="Team Admin",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(admin)
        await test_db.commit()
        await test_db.refresh(admin)

        team = Team(name="Admin Team", slug="admin-team", owner_id=test_user.id)
        test_db.add(team)
        await test_db.commit()
        await test_db.refresh(team)

        member = TeamMember(team_id=team.id, user_id=admin.id, role=TeamRole.ADMIN)
        test_db.add(member)
        await test_db.commit()

        response = await client.post(
            "/api/v1/auth/login",
            data={"username": admin.email, "password": "password123"},
        )
        admin_token = response.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        response = await client.put(
            f"/api/v1/teams/{team.id}",
            headers=admin_headers,
            json={"name": "Updated by Admin"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_team_member_cannot_manage_team(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test team member cannot manage team settings."""
        member = User(
            email="teammember@example.com",
            username="teammember",
            full_name="Team Member",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(member)
        await test_db.commit()
        await test_db.refresh(member)

        team = Team(name="Member Team", slug="member-team", owner_id=test_user.id)
        test_db.add(team)
        await test_db.commit()
        await test_db.refresh(team)

        team_member = TeamMember(team_id=team.id, user_id=member.id, role=TeamRole.MEMBER)
        test_db.add(team_member)
        await test_db.commit()

        response = await client.post(
            "/api/v1/auth/login",
            data={"username": member.email, "password": "password123"},
        )
        member_token = response.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}

        response = await client.put(
            f"/api/v1/teams/{team.id}",
            headers=member_headers,
            json={"name": "Hacked"},
        )
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_team_member_can_view_team(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test team member can view team."""
        member = User(
            email="viewmember@example.com",
            username="viewmember",
            full_name="View Member",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(member)
        await test_db.commit()
        await test_db.refresh(member)

        team = Team(name="View Team", slug="view-team", owner_id=test_user.id)
        test_db.add(team)
        await test_db.commit()
        await test_db.refresh(team)

        team_member = TeamMember(team_id=team.id, user_id=member.id, role=TeamRole.MEMBER)
        test_db.add(team_member)
        await test_db.commit()

        response = await client.post(
            "/api/v1/auth/login",
            data={"username": member.email, "password": "password123"},
        )
        member_token = response.json()["access_token"]
        member_headers = {"Authorization": f"Bearer {member_token}"}

        response = await client.get(f"/api/v1/teams/{team.id}", headers=member_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_can_access_all_projects(self, client: AsyncClient, admin_auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test admin can access any project."""
        project = Project(name="Admin Access Project", key="AAP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        response = await client.get(f"/api/v1/projects/{project.id}", headers=admin_auth_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_admin_can_manage_all_users(self, client: AsyncClient, admin_auth_headers: dict, test_user: User):
        """Test admin can deactivate/activate any user."""
        response = await client.patch(
            f"/api/v1/auth/users/{test_user.id}/deactivate",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is False

        response = await client.patch(
            f"/api/v1/auth/users/{test_user.id}/activate",
            headers=admin_auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["is_active"] is True

    @pytest.mark.asyncio
    async def test_task_assignee_can_update_status(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test task assignee can update task status."""
        assignee = User(
            email="taskassignee@example.com",
            username="taskassignee",
            full_name="Task Assignee",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(assignee)
        await test_db.commit()
        await test_db.refresh(assignee)

        project = Project(name="Assignee Project", key="ASP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        from app.models import Task, TaskStatus
        task = Task(
            title="Assignee Task",
            project_id=project.id,
            reporter_id=test_user.id,
            assignee_id=assignee.id,
            status=TaskStatus.TODO,
        )
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.post(
            "/api/v1/auth/login",
            data={"username": assignee.email, "password": "password123"},
        )
        assignee_token = response.json()["access_token"]
        assignee_headers = {"Authorization": f"Bearer {assignee_token}"}

        response = await client.put(
            f"/api/v1/tasks/{task.id}",
            headers=assignee_headers,
            json={"status": "in_progress"},
        )
        assert response.status_code == 200
        assert response.json()["status"] == "in_progress"

    @pytest.mark.asyncio
    async def test_task_reporter_can_update_task(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test task reporter can update task."""
        project = Project(name="Reporter Project", key="RP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        from app.models import Task
        task = Task(
            title="Reporter Task",
            project_id=project.id,
            reporter_id=test_user.id,
        )
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.put(
            f"/api/v1/tasks/{task.id}",
            headers=auth_headers,
            json={"title": "Updated by Reporter"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_unassigned_user_cannot_update_task(self, client: AsyncClient, test_db: AsyncSession, test_user: User):
        """Test unassigned user cannot update task."""
        other = User(
            email="unassigned@example.com",
            username="unassigned",
            full_name="Unassigned",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_verified=True,
        )
        test_db.add(other)
        await test_db.commit()
        await test_db.refresh(other)

        project = Project(name="Unassigned Project", key="UAP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        from app.models import Task
        task = Task(
            title="Unassigned Task",
            project_id=project.id,
            reporter_id=test_user.id,
        )
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.post(
            "/api/v1/auth/login",
            data={"username": other.email, "password": "password123"},
        )
        other_token = response.json()["access_token"]
        other_headers = {"Authorization": f"Bearer {other_token}"}

        response = await client.put(
            f"/api/v1/tasks/{task.id}",
            headers=other_headers,
            json={"title": "Hacked"},
        )
        assert response.status_code == 403