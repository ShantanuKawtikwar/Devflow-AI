import asyncio
import os
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.database.base import Base, get_db
from app.main import app
from app.models import User, UserRole


# Test database URL (uses SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def test_db(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a test database session."""
    async_session = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest.fixture(scope="function")
async def client(test_db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create a test client with overridden database dependency."""

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def sync_client(test_db: AsyncSession) -> Generator[TestClient, None, None]:
    """Create a synchronous test client."""

    async def override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def mock_github_client() -> MagicMock:
    """Mock GitHub API client."""
    mock = MagicMock()
    mock.get_user = AsyncMock()
    mock.get_repos = AsyncMock()
    mock.get_repo = AsyncMock()
    return mock


@pytest.fixture
def mock_openai_client() -> AsyncMock:
    """Mock OpenAI API client."""
    mock = AsyncMock()
    mock.chat.completions.create = AsyncMock()
    return mock


@pytest.fixture
def mock_anthropic_client() -> AsyncMock:
    """Mock Anthropic API client."""
    mock = AsyncMock()
    mock.messages.create = AsyncMock()
    return mock


@pytest.fixture
async def test_user(test_db: AsyncSession) -> User:
    """Create a test user."""
    from app.core.security import get_password_hash

    user = User(
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        hashed_password=get_password_hash("testpassword123"),
        role=UserRole.MEMBER,
        is_active=True,
        is_verified=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
async def test_admin_user(test_db: AsyncSession) -> User:
    """Create a test admin user."""
    from app.core.security import get_password_hash

    user = User(
        email="admin@example.com",
        username="adminuser",
        full_name="Admin User",
        hashed_password=get_password_hash("adminpassword123"),
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user: User) -> dict:
    """Create authorization headers for test user."""
    from app.core.security import create_access_token

    token = create_access_token(data={"sub": str(test_user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(test_admin_user: User) -> dict:
    """Create authorization headers for admin user."""
    from app.core.security import create_access_token

    token = create_access_token(data={"sub": str(test_admin_user.id)})
    return {"Authorization": f"Bearer {token}"}


# Test data factories
class TestDataFactory:
    """Factory for creating test data."""

    @staticmethod
    def user_data(**kwargs) -> dict:
        data = {
            "email": "newuser@example.com",
            "username": "newuser",
            "full_name": "New User",
            "password": "password123",
        }
        data.update(kwargs)
        return data

    @staticmethod
    def team_data(**kwargs) -> dict:
        data = {
            "name": "Test Team",
            "slug": "test-team",
            "description": "A test team",
        }
        data.update(kwargs)
        return data

    @staticmethod
    def project_data(**kwargs) -> dict:
        data = {
            "name": "Test Project",
            "key": "TEST",
            "description": "A test project",
            "status": "planning",
            "priority": "medium",
        }
        data.update(kwargs)
        return data

    @staticmethod
    def task_data(**kwargs) -> dict:
        data = {
            "title": "Test Task",
            "description": "A test task",
            "status": "backlog",
            "priority": "medium",
        }
        data.update(kwargs)
        return data

    @staticmethod
    def sprint_data(**kwargs) -> dict:
        data = {
            "name": "Sprint 1",
            "goal": "Complete initial features",
            "status": "planning",
            "start_date": "2026-01-01T00:00:00",
            "end_date": "2026-01-14T00:00:00",
        }
        data.update(kwargs)
        return data


@pytest.fixture
def test_data_factory() -> TestDataFactory:
    """Provide test data factory."""
    return TestDataFactory()