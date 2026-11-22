import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User, GitHubAccount, GitHubRepository, GitHubIssue, GitHubPullRequest, Project
from app.core.security import get_password_hash


class TestGitHubIntegration:
    """Tests for GitHub integration endpoints."""

    @pytest.mark.asyncio
    async def test_github_oauth_url(self, client: AsyncClient, auth_headers: dict):
        """Test getting GitHub OAuth URL."""
        response = await client.get("/api/v1/github/oauth/url", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "url" in data
        assert "github.com/login/oauth/authorize" in data["url"]
        assert "client_id" in data["url"]

    @pytest.mark.asyncio
    async def test_github_callback_no_code(self, client: AsyncClient, auth_headers: dict):
        """Test GitHub callback without code fails."""
        response = await client.get("/api/v1/github/oauth/callback", headers=auth_headers)
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_github_callback_invalid_code(self, client: AsyncClient, auth_headers: dict):
        """Test GitHub callback with invalid code fails."""
        with patch("app.api.v1.github.github_service.exchange_code_for_token") as mock_exchange:
            mock_exchange.return_value = None
            response = await client.get(
                "/api/v1/github/oauth/callback",
                headers=auth_headers,
                params={"code": "invalid_code"},
            )
            assert response.status_code == 400
            assert "failed" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_github_callback_success(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test successful GitHub OAuth callback."""
        mock_token_data = {
            "access_token": "gho_test_token",
            "refresh_token": "ghr_refresh_token",
            "expires_in": 3600,
            "scope": "repo,user",
        }
        mock_user_data = {
            "id": 12345,
            "login": "githubuser",
            "avatar_url": "https://avatars.githubusercontent.com/u/12345",
        }

        with patch("app.api.v1.github.github_service.exchange_code_for_token") as mock_exchange, \
             patch("app.api.v1.github.github_service.get_github_user") as mock_get_user:
            mock_exchange.return_value = mock_token_data
            mock_get_user.return_value = mock_user_data

            response = await client.get(
                "/api/v1/github/oauth/callback",
                headers=auth_headers,
                params={"code": "valid_code"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["github_username"] == "githubuser"

    @pytest.mark.asyncio
    async def test_list_github_accounts(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test listing connected GitHub accounts."""
        account = GitHubAccount(
            user_id=test_user.id,
            github_user_id="12345",
            username="githubuser",
            avatar_url="https://avatars.githubusercontent.com/u/12345",
            access_token_encrypted="encrypted_token",
            scope="repo,user",
            is_active=True,
        )
        test_db.add(account)
        await test_db.commit()

        response = await client.get("/api/v1/github/accounts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["username"] == "githubuser"

    @pytest.mark.asyncio
    async def test_disconnect_github_account(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test disconnecting GitHub account."""
        account = GitHubAccount(
            user_id=test_user.id,
            github_user_id="12345",
            username="githubuser",
            access_token_encrypted="encrypted_token",
            is_active=True,
        )
        test_db.add(account)
        await test_db.commit()
        await test_db.refresh(account)

        response = await client.delete(f"/api/v1/github/accounts/{account.id}", headers=auth_headers)
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_repositories(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test listing GitHub repositories."""
        account = GitHubAccount(
            user_id=test_user.id,
            github_user_id="12345",
            username="githubuser",
            access_token_encrypted="encrypted_token",
            is_active=True,
        )
        test_db.add(account)
        await test_db.commit()
        await test_db.refresh(account)

        repo = GitHubRepository(
            github_account_id=account.id,
            github_repo_id="67890",
            name="test-repo",
            full_name="githubuser/test-repo",
            html_url="https://github.com/githubuser/test-repo",
            clone_url="https://github.com/githubuser/test-repo.git",
            private=False,
        )
        test_db.add(repo)
        await test_db.commit()

        with patch("app.api.v1.github.github_service.get_repositories") as mock_get_repos:
            mock_get_repos.return_value = [
                {
                    "id": "67890",
                    "name": "test-repo",
                    "full_name": "githubuser/test-repo",
                    "private": False,
                }
            ]
            response = await client.get("/api/v1/github/repositories", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert len(data) >= 1

    @pytest.mark.asyncio
    async def test_sync_repository(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test syncing a repository."""
        account = GitHubAccount(
            user_id=test_user.id,
            github_user_id="12345",
            username="githubuser",
            access_token_encrypted="encrypted_token",
            is_active=True,
        )
        test_db.add(account)
        await test_db.commit()
        await test_db.refresh(account)

        repo = GitHubRepository(
            github_account_id=account.id,
            github_repo_id="67890",
            name="test-repo",
            full_name="githubuser/test-repo",
            html_url="https://github.com/githubuser/test-repo",
            clone_url="https://github.com/githubuser/test-repo.git",
            private=False,
        )
        test_db.add(repo)
        await test_db.commit()
        await test_db.refresh(repo)

        with patch("app.api.v1.github.github_service.sync_repository") as mock_sync:
            mock_sync.return_value = {
                "commits_synced": 10,
                "branches_synced": 3,
                "issues_synced": 5,
                "prs_synced": 2,
            }
            response = await client.post(
                f"/api/v1/github/repositories/{repo.id}/sync",
                headers=auth_headers,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["commits_synced"] == 10

    @pytest.mark.asyncio
    async def test_link_github_issue_to_task(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test linking GitHub issue to task."""
        from app.models import Task, GitHubLinkedIssue

        project = Project(name="GitHub Project", key="GH", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        account = GitHubAccount(
            user_id=test_user.id,
            github_user_id="12345",
            username="githubuser",
            access_token_encrypted="encrypted_token",
            is_active=True,
        )
        test_db.add(account)
        await test_db.commit()
        await test_db.refresh(account)

        repo = GitHubRepository(
            github_account_id=account.id,
            github_repo_id="67890",
            name="test-repo",
            full_name="githubuser/test-repo",
            html_url="https://github.com/githubuser/test-repo",
            clone_url="https://github.com/githubuser/test-repo.git",
        )
        test_db.add(repo)
        await test_db.commit()
        await test_db.refresh(repo)

        issue = GitHubIssue(
            repository_id=repo.id,
            github_issue_id="111",
            number=1,
            title="Test Issue",
            state="open",
            html_url="https://github.com/githubuser/test-repo/issues/1",
        )
        test_db.add(issue)
        await test_db.commit()
        await test_db.refresh(issue)

        task = Task(title="Related Task", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        response = await client.post(
            f"/api/v1/github/issues/{issue.id}/link-task",
            headers=auth_headers,
            json={"task_id": str(task.id), "link_type": "fixes"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["task_id"] == str(task.id)
        assert data["link_type"] == "fixes"

    @pytest.mark.asyncio
    async def test_get_linked_issues(self, client: AsyncClient, auth_headers: dict, test_db: AsyncSession, test_user: User):
        """Test getting linked issues for a task."""
        from app.models import Task, GitHubIssue, GitHubLinkedIssue, GitHubRepository, GitHubAccount

        project = Project(name="Linked Project", key="LP", owner_id=test_user.id)
        test_db.add(project)
        await test_db.commit()
        await test_db.refresh(project)

        account = GitHubAccount(user_id=test_user.id, github_user_id="12345", username="githubuser", access_token_encrypted="encrypted", is_active=True)
        test_db.add(account)
        await test_db.commit()
        await test_db.refresh(account)

        repo = GitHubRepository(github_account_id=account.id, github_repo_id="67890", name="test-repo", full_name="githubuser/test-repo", html_url="https://github.com/githubuser/test-repo", clone_url="https://github.com/githubuser/test-repo.git")
        test_db.add(repo)
        await test_db.commit()
        await test_db.refresh(repo)

        issue = GitHubIssue(repository_id=repo.id, github_issue_id="111", number=1, title="Test Issue", state="open", html_url="https://github.com/githubuser/test-repo/issues/1")
        test_db.add(issue)
        await test_db.commit()
        await test_db.refresh(issue)

        task = Task(title="Linked Task", project_id=project.id, reporter_id=test_user.id)
        test_db.add(task)
        await test_db.commit()
        await test_db.refresh(task)

        linked = GitHubLinkedIssue(task_id=task.id, github_issue_id=issue.id, link_type="related")
        test_db.add(linked)
        await test_db.commit()

        response = await client.get(f"/api/v1/tasks/{task.id}/github-links", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["github_issue"]["number"] == 1


class TestGitHubWebhooks:
    """Tests for GitHub webhook handling."""

    @pytest.mark.asyncio
    async def test_github_webhook_push(self, client: AsyncClient, test_db: AsyncSession):
        """Test handling push webhook."""
        from app.models import GitHubAccount, GitHubRepository

        account = GitHubAccount(user_id="00000000-0000-0000-0000-000000000000", github_user_id="12345", username="githubuser", access_token_encrypted="encrypted", is_active=True)
        test_db.add(account)
        await test_db.commit()
        await test_db.refresh(account)

        repo = GitHubRepository(github_account_id=account.id, github_repo_id="67890", name="test-repo", full_name="githubuser/test-repo", html_url="https://github.com/githubuser/test-repo", clone_url="https://github.com/githubuser/test-repo.git")
        test_db.add(repo)
        await test_db.commit()
        await test_db.refresh(repo)

        payload = {
            "ref": "refs/heads/main",
            "repository": {"id": 67890, "full_name": "githubuser/test-repo"},
            "commits": [
                {"id": "abc123", "message": "Test commit", "author": {"name": "User", "email": "user@example.com"}}
            ],
        }

        with patch("app.api.v1.github.github_service.verify_webhook_signature") as mock_verify, \
             patch("app.api.v1.github.github_service.process_push_webhook") as mock_process:
            mock_verify.return_value = True
            mock_process.return_value = {"commits_processed": 1}

            response = await client.post(
                "/api/v1/github/webhook",
                json=payload,
                headers={"X-GitHub-Event": "push", "X-Hub-Signature-256": "sha256=test"},
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_github_webhook_pull_request(self, client: AsyncClient, test_db: AsyncSession):
        """Test handling pull request webhook."""
        from app.models import GitHubAccount, GitHubRepository

        account = GitHubAccount(user_id="00000000-0000-0000-0000-000000000000", github_user_id="12345", username="githubuser", access_token_encrypted="encrypted", is_active=True)
        test_db.add(account)
        await test_db.commit()
        await test_db.refresh(account)

        repo = GitHubRepository(github_account_id=account.id, github_repo_id="67890", name="test-repo", full_name="githubuser/test-repo", html_url="https://github.com/githubuser/test-repo", clone_url="https://github.com/githubuser/test-repo.git")
        test_db.add(repo)
        await test_db.commit()
        await test_db.refresh(repo)

        payload = {
            "action": "opened",
            "pull_request": {
                "id": 111,
                "number": 1,
                "title": "Test PR",
                "head": {"ref": "feature", "sha": "abc123"},
                "base": {"ref": "main", "sha": "def456"},
                "user": {"id": 12345, "login": "githubuser"},
                "html_url": "https://github.com/githubuser/test-repo/pull/1",
            },
            "repository": {"id": 67890, "full_name": "githubuser/test-repo"},
        }

        with patch("app.api.v1.github.github_service.verify_webhook_signature") as mock_verify, \
             patch("app.api.v1.github.github_service.process_pr_webhook") as mock_process:
            mock_verify.return_value = True
            mock_process.return_value = {"pr_synced": True}

            response = await client.post(
                "/api/v1/github/webhook",
                json=payload,
                headers={"X-GitHub-Event": "pull_request", "X-Hub-Signature-256": "sha256=test"},
            )
            assert response.status_code == 200