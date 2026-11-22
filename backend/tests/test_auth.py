import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, UserRole


class TestAuth:
    """Tests for authentication endpoints."""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient):
        """Test successful user registration."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "full_name": "New User",
                "password": "password123",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == "newuser@example.com"
        assert data["username"] == "newuser"
        assert data["full_name"] == "New User"
        assert "id" in data
        assert "hashed_password" not in data

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, test_user: User):
        """Test registration with duplicate email fails."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": test_user.email,
                "username": "anotheruser",
                "full_name": "Another User",
                "password": "password123",
            },
        )
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_duplicate_username(self, client: AsyncClient, test_user: User):
        """Test registration with duplicate username fails."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "another@example.com",
                "username": test_user.username,
                "full_name": "Another User",
                "password": "password123",
            },
        )
        assert response.status_code == 400
        assert "already taken" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client: AsyncClient):
        """Test registration with invalid email fails."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "invalid-email",
                "username": "newuser",
                "full_name": "New User",
                "password": "password123",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_register_short_password(self, client: AsyncClient):
        """Test registration with short password fails."""
        response = await client.post(
            "/api/v1/auth/register",
            json={
                "email": "newuser@example.com",
                "username": "newuser",
                "full_name": "New User",
                "password": "123",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user: User):
        """Test successful login."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": test_user.email, "password": "testpassword123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert "user" in data
        assert data["user"]["email"] == test_user.email

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
        """Test login with wrong password fails."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": test_user.email, "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert "incorrect" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login with nonexistent user fails."""
        response = await client.post(
            "/api/v1/auth/login",
            data={"username": "nonexistent@example.com", "password": "password123"},
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, auth_headers: dict):
        """Test getting current user info."""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "email" in data
        assert "username" in data

    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without auth fails."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_refresh_token(self, client: AsyncClient, auth_headers: dict):
        """Test token refresh."""
        response = await client.post("/api/v1/auth/refresh", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_logout(self, client: AsyncClient, auth_headers: dict):
        """Test logout."""
        response = await client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code == 200
        assert "successfully logged out" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_update_profile(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """Test updating user profile."""
        response = await client.put(
            "/api/v1/auth/me",
            headers=auth_headers,
            json={"full_name": "Updated Name", "avatar_url": "https://example.com/avatar.png"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"
        assert data["avatar_url"] == "https://example.com/avatar.png"

    @pytest.mark.asyncio
    async def test_change_password(self, client: AsyncClient, auth_headers: dict, test_user: User):
        """Test changing password."""
        response = await client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={"current_password": "testpassword123", "new_password": "newpassword123"},
        )
        assert response.status_code == 200
        assert "password changed" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_change_password_wrong_current(self, client: AsyncClient, auth_headers: dict):
        """Test changing password with wrong current password fails."""
        response = await client.post(
            "/api/v1/auth/change-password",
            headers=auth_headers,
            json={"current_password": "wrongpassword", "new_password": "newpassword123"},
        )
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()


class TestAuthAdmin:
    """Tests for admin-only auth endpoints."""

    @pytest.mark.asyncio
    async def test_list_users_admin(self, client: AsyncClient, admin_auth_headers: dict):
        """Test admin can list all users."""
        response = await client.get("/api/v1/auth/users", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)

    @pytest.mark.asyncio
    async def test_list_users_non_admin(self, client: AsyncClient, auth_headers: dict):
        """Test non-admin cannot list users."""
        response = await client.get("/api/v1/auth/users", headers=auth_headers)
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_get_user_admin(self, client: AsyncClient, admin_auth_headers: dict, test_user: User):
        """Test admin can get any user."""
        response = await client.get(f"/api/v1/auth/users/{test_user.id}", headers=admin_auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_deactivate_user_admin(self, client: AsyncClient, admin_auth_headers: dict, test_user: User):
        """Test admin can deactivate user."""
        response = await client.patch(
            f"/api/v1/auth/users/{test_user.id}/deactivate", headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False

    @pytest.mark.asyncio
    async def test_activate_user_admin(self, client: AsyncClient, admin_auth_headers: dict, test_user: User):
        """Test admin can activate user."""
        # First deactivate
        await client.patch(f"/api/v1/auth/users/{test_user.id}/deactivate", headers=admin_auth_headers)
        # Then activate
        response = await client.patch(
            f"/api/v1/auth/users/{test_user.id}/activate", headers=admin_auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is True