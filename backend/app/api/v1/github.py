from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
import httpx
from datetime import datetime, timedelta
from urllib.parse import urlencode

from app.database.base import get_db
from app.core.deps import get_current_active_user
from app.core.config import settings
from app.models.user import User
from app.models.github import GitHubAccount, GitHubRepository, GitHubCommit, GitHubBranch, GitHubIssue, GitHubPullRequest, GitHubLinkedIssue
from app.models.project import Project, ProjectMember
from app.models.team import TeamMember, TeamRole
from app.schemas.github import GitHubOAuthURL, GitHubOAuthCallback, GitHubRepositoryResponse, GitHubSyncResponse

router = APIRouter(prefix="/github", tags=["github"])

GITHUB_API_BASE = "https://api.github.com"
GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token"


def encrypt_token(token: str) -> str:
    """Simple encryption - in production use proper encryption"""
    # For demo purposes, just return the token
    # In production: use Fernet or similar
    return token


def decrypt_token(encrypted: str) -> str:
    """Simple decryption - in production use proper encryption"""
    return encrypted


async def get_github_client(access_token: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=GITHUB_API_BASE,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "DevFlow-AI"
        },
        timeout=30.0
    )


@router.get("/oauth/url", response_model=GitHubOAuthURL)
async def get_oauth_url(current_user: User = Depends(get_current_active_user)):
    if not settings.GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "repo read:user user:email read:org",
        "state": str(current_user.id)
    }
    url = f"{GITHUB_OAUTH_AUTHORIZE}?{urlencode(params)}"
    return {"url": url}


@router.post("/oauth/callback", response_model=GitHubAccountResponse)
async def oauth_callback(
    callback: GitHubOAuthCallback,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GITHUB_OAUTH_TOKEN,
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": callback.code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"}
        )
        response.raise_for_status()
        token_data = response.json()

    access_token = token_data.get("access_token")
    token_type = token_data.get("token_type", "bearer")
    scope = token_data.get("scope", "")

    # Get user info
    async with httpx.AsyncClient() as client:
        client.headers.update({"Authorization": f"Bearer {access_token}"})
        user_response = await client.get(f"{GITHUB_API_BASE}/user")
        user_response.raise_for_status()
        github_user = user_response.json()

        # Get user emails
        email_response = await client.get(f"{GITHUB_API_BASE}/user/emails")
        email_response.raise_for_status()
        emails = email_response.json()
        primary_email = next((e["email"] for e in emails if e["primary"]), None)

    # Save or update GitHub account
    result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    github_account = result.scalar_one_or_none()

    if github_account:
        github_account.github_id = str(github_user["id"])
        github_account.login = github_user["login"]
        github_account.name = github_user.get("name")
        github_account.email = primary_email or github_user.get("email")
        github_account.avatar_url = github_user.get("avatar_url")
        github_account.html_url = github_user.get("html_url")
        github_account.access_token_encrypted = encrypt_token(access_token)
        github_account.token_type = token_type
        github_account.scope = scope
        github_account.expires_at = None  # GitHub tokens don't expire by default
        github_account.is_active = True
        github_account.updated_at = datetime.utcnow()
    else:
        github_account = GitHubAccount(
            user_id=current_user.id,
            github_id=str(github_user["id"]),
            login=github_user["login"],
            name=github_user.get("name"),
            email=primary_email or github_user.get("email"),
            avatar_url=github_user.get("avatar_url"),
            html_url=github_user.get("html_url"),
            access_token_encrypted=encrypt_token(access_token),
            token_type=token_type,
            scope=scope,
            is_active=True
        )
        db.add(github_account)

    await db.commit()
    await db.refresh(github_account)

    return github_account


@router.get("/account", response_model=GitHubAccountResponse)
async def get_github_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="GitHub account not connected")
    return account


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_github_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="GitHub account not connected")

    await db.delete(account)
    await db.commit()


@router.get("/repositories", response_model=List[GitHubRepositoryResponse])
async def list_repositories(
    project_id: Optional[uuid.UUID] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="GitHub account not connected")

    query = select(GitHubRepository).where(GitHubRepository.account_id == account.id)
    if project_id:
        query = query.where(GitHubRepository.project_id == project_id)

    query = query.order_by(GitHubRepository.updated_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/repositories/sync", response_model=GitHubSyncResponse)
async def sync_repositories(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="GitHub account not connected")

    access_token = decrypt_token(account.access_token_encrypted)
    stats = {"repositories_synced": 0, "commits_synced": 0, "issues_synced": 0, "pull_requests_synced": 0, "branches_synced": 0}

    async with await get_github_client(access_token) as client:
        # Get user's repositories
        repos_response = await client.get(
            f"{GITHUB_API_BASE}/user/repos",
            params={"sort": "updated", "per_page": 100}
        )
        repos_response.raise_for_status()
        repos = repos_response.json()

        for repo_data in repos:
            # Check if already exists
            repo_result = await db.execute(
                select(GitHubRepository).where(GitHubRepository.github_id == str(repo_data["id"]))
            )
            repo = repo_result.scalar_one_or_none()

            if repo:
                # Update existing
                repo.name = repo_data["name"]
                repo.full_name = repo_data["full_name"]
                repo.description = repo_data.get("description")
                repo.html_url = repo_data["html_url"]
                repo.clone_url = repo_data["clone_url"]
                repo.language = repo_data.get("language")
                repo.stargazers_count = repo_data["stargazers_count"]
                repo.forks_count = repo_data["forks_count"]
                repo.watchers_count = repo_data["watchers_count"]
                repo.open_issues_count = repo_data["open_issues_count"]
                repo.default_branch = repo_data["default_branch"]
                repo.visibility = repo_data["visibility"]
                repo.is_fork = repo_data["fork"]
                repo.is_archived = repo_data["archived"]
                repo.pushed_at = datetime.fromisoformat(repo_data["pushed_at"].replace("Z", "+00:00")) if repo_data.get("pushed_at") else None
                repo.github_created_at = datetime.fromisoformat(repo_data["created_at"].replace("Z", "+00:00"))
                repo.github_updated_at = datetime.fromisoformat(repo_data["updated_at"].replace("Z", "+00:00"))
                repo.last_synced_at = datetime.utcnow()
            else:
                repo = GitHubRepository(
                    account_id=account.id,
                    github_id=str(repo_data["id"]),
                    name=repo_data["name"],
                    full_name=repo_data["full_name"],
                    description=repo_data.get("description"),
                    html_url=repo_data["html_url"],
                    clone_url=repo_data["clone_url"],
                    language=repo_data.get("language"),
                    stargazers_count=repo_data["stargazers_count"],
                    forks_count=repo_data["forks_count"],
                    watchers_count=repo_data["watchers_count"],
                    open_issues_count=repo_data["open_issues_count"],
                    default_branch=repo_data["default_branch"],
                    visibility=repo_data["visibility"],
                    is_fork=repo_data["fork"],
                    is_archived=repo_data["archived"],
                    pushed_at=datetime.fromisoformat(repo_data["pushed_at"].replace("Z", "+00:00")) if repo_data.get("pushed_at") else None,
                    github_created_at=datetime.fromisoformat(repo_data["created_at"].replace("Z", "+00:00")),
                    github_updated_at=datetime.fromisoformat(repo_data["updated_at"].replace("Z", "+00:00")),
                    last_synced_at=datetime.utcnow()
                )
                db.add(repo)
                stats["repositories_synced"] += 1

            await db.flush()

            # Sync commits (last 50)
            commits_response = await client.get(
                f"{GITHUB_API_BASE}/repos/{repo_data['full_name']}/commits",
                params={"per_page": 50}
            )
            if commits_response.status_code == 200:
                commits = commits_response.json()
                for commit_data in commits:
                    commit_result = await db.execute(
                        select(GitHubCommit).where(
                            GitHubCommit.repository_id == repo.id,
                            GitHubCommit.sha == commit_data["sha"]
                        )
                    )
                    if not commit_result.scalar_one_or_none():
                        commit = GitHubCommit(
                            repository_id=repo.id,
                            sha=commit_data["sha"],
                            message=commit_data["commit"]["message"],
                            author_name=commit_data["commit"]["author"]["name"],
                            author_email=commit_data["commit"]["author"]["email"],
                            author_date=datetime.fromisoformat(commit_data["commit"]["author"]["date"].replace("Z", "+00:00")),
                            committer_name=commit_data["commit"]["committer"]["name"],
                            committer_email=commit_data["commit"]["committer"]["email"],
                            committer_date=datetime.fromisoformat(commit_data["commit"]["committer"]["date"].replace("Z", "+00:00")),
                            html_url=commit_data["html_url"]
                        )
                        db.add(commit)
                        stats["commits_synced"] += 1

            # Sync branches
            branches_response = await client.get(
                f"{GITHUB_API_BASE}/repos/{repo_data['full_name']}/branches",
                params={"per_page": 50}
            )
            if branches_response.status_code == 200:
                branches = branches_response.json()
                for branch_data in branches:
                    branch_result = await db.execute(
                        select(GitHubBranch).where(
                            GitHubBranch.repository_id == repo.id,
                            GitHubBranch.name == branch_data["name"]
                        )
                    )
                    branch = branch_result.scalar_one_or_none()
                    if branch:
                        branch.sha = branch_data["commit"]["sha"]
                        branch.is_protected = branch_data.get("protected", False)
                        branch.is_default = branch_data["name"] == repo.default_branch
                        branch.updated_at = datetime.utcnow()
                    else:
                        branch = GitHubBranch(
                            repository_id=repo.id,
                            name=branch_data["name"],
                            sha=branch_data["commit"]["sha"],
                            is_protected=branch_data.get("protected", False),
                            is_default=branch_data["name"] == repo.default_branch
                        )
                        db.add(branch)
                        stats["branches_synced"] += 1

            # Sync issues (open + recent closed)
            issues_response = await client.get(
                f"{GITHUB_API_BASE}/repos/{repo_data['full_name']}/issues",
                params={"state": "all", "per_page": 50, "sort": "updated"}
            )
            if issues_response.status_code == 200:
                issues = issues_response.json()
                for issue_data in issues:
                    if "pull_request" in issue_data:
                        continue  # Skip PRs, they're handled separately

                    issue_result = await db.execute(
                        select(GitHubIssue).where(
                            GitHubIssue.repository_id == repo.id,
                            GitHubIssue.github_id == str(issue_data["id"])
                        )
                    )
                    issue = issue_result.scalar_one_or_none()

                    labels_json = str([{"name": l["name"], "color": l["color"]} for l in issue_data.get("labels", [])])
                    assignees_json = str([a["login"] for a in issue_data.get("assignees", [])])

                    if issue:
                        issue.title = issue_data["title"]
                        issue.body = issue_data.get("body")
                        issue.state = issue_data["state"]
                        issue.state_reason = issue_data.get("state_reason")
                        issue.labels = labels_json
                        issue.assignees = assignees_json
                        issue.author_login = issue_data["user"]["login"]
                        issue.html_url = issue_data["html_url"]
                        issue.comments_count = issue_data["comments"]
                        issue.github_updated_at = datetime.fromisoformat(issue_data["updated_at"].replace("Z", "+00:00"))
                        issue.github_closed_at = datetime.fromisoformat(issue_data["closed_at"].replace("Z", "+00:00")) if issue_data.get("closed_at") else None
                        issue.last_synced_at = datetime.utcnow()
                    else:
                        issue = GitHubIssue(
                            repository_id=repo.id,
                            github_id=str(issue_data["id"]),
                            number=issue_data["number"],
                            title=issue_data["title"],
                            body=issue_data.get("body"),
                            state=issue_data["state"],
                            state_reason=issue_data.get("state_reason"),
                            labels=labels_json,
                            assignees=assignees_json,
                            author_login=issue_data["user"]["login"],
                            html_url=issue_data["html_url"],
                            comments_count=issue_data["comments"],
                            github_created_at=datetime.fromisoformat(issue_data["created_at"].replace("Z", "+00:00")),
                            github_updated_at=datetime.fromisoformat(issue_data["updated_at"].replace("Z", "+00:00")),
                            github_closed_at=datetime.fromisoformat(issue_data["closed_at"].replace("Z", "+00:00")) if issue_data.get("closed_at") else None,
                            last_synced_at=datetime.utcnow()
                        )
                        db.add(issue)
                        stats["issues_synced"] += 1

            # Sync pull requests
            prs_response = await client.get(
                f"{GITHUB_API_BASE}/repos/{repo_data['full_name']}/pulls",
                params={"state": "all", "per_page": 50, "sort": "updated"}
            )
            if prs_response.status_code == 200:
                prs = prs_response.json()
                for pr_data in prs:
                    pr_result = await db.execute(
                        select(GitHubPullRequest).where(
                            GitHubPullRequest.repository_id == repo.id,
                            GitHubPullRequest.github_id == str(pr_data["id"])
                        )
                    )
                    pr = pr_result.scalar_one_or_none()

                    if pr:
                        pr.title = pr_data["title"]
                        pr.body = pr_data.get("body")
                        pr.state = pr_data["state"]
                        pr.draft = pr_data["draft"]
                        pr.head_ref = pr_data["head"]["ref"]
                        pr.head_sha = pr_data["head"]["sha"]
                        pr.base_ref = pr_data["base"]["ref"]
                        pr.base_sha = pr_data["base"]["sha"]
                        pr.author_login = pr_data["user"]["login"]
                        pr.html_url = pr_data["html_url"]
                        pr.mergeable = pr_data.get("mergeable")
                        pr.github_updated_at = datetime.fromisoformat(pr_data["updated_at"].replace("Z", "+00:00"))
                        pr.github_closed_at = datetime.fromisoformat(pr_data["closed_at"].replace("Z", "+00:00")) if pr_data.get("closed_at") else None
                        pr.merged_at = datetime.fromisoformat(pr_data["merged_at"].replace("Z", "+00:00")) if pr_data.get("merged_at") else None
                        pr.last_synced_at = datetime.utcnow()
                    else:
                        pr = GitHubPullRequest(
                            repository_id=repo.id,
                            github_id=str(pr_data["id"]),
                            number=pr_data["number"],
                            title=pr_data["title"],
                            body=pr_data.get("body"),
                            state=pr_data["state"],
                            draft=pr_data["draft"],
                            head_ref=pr_data["head"]["ref"],
                            head_sha=pr_data["head"]["sha"],
                            base_ref=pr_data["base"]["ref"],
                            base_sha=pr_data["base"]["sha"],
                            author_login=pr_data["user"]["login"],
                            html_url=pr_data["html_url"],
                            mergeable=pr_data.get("mergeable"),
                            github_created_at=datetime.fromisoformat(pr_data["created_at"].replace("Z", "+00:00")),
                            github_updated_at=datetime.fromisoformat(pr_data["updated_at"].replace("Z", "+00:00")),
                            github_closed_at=datetime.fromisoformat(pr_data["closed_at"].replace("Z", "+00:00")) if pr_data.get("closed_at") else None,
                            merged_at=datetime.fromisoformat(pr_data["merged_at"].replace("Z", "+00:00")) if pr_data.get("merged_at") else None,
                            last_synced_at=datetime.utcnow()
                        )
                        db.add(pr)
                        stats["pull_requests_synced"] += 1

    await db.commit()
    return GitHubSyncResponse(**stats)


@router.put("/repositories/{repo_id}/link-project", response_model=GitHubRepositoryResponse)
async def link_repository_to_project(
    repo_id: uuid.UUID,
    project_id: Optional[uuid.UUID],
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubRepository).where(GitHubRepository.id == repo_id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Verify ownership
    account_result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.id == repo.account_id, GitHubAccount.user_id == current_user.id)
    )
    if not account_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    if project_id:
        # Check project access
        project_result = await db.execute(
            select(Project).where(Project.id == project_id)
        )
        project = project_result.scalar_one_or_none()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Check access
        if project.owner_id != current_user.id:
            if project.team_id:
                team_member = await db.execute(
                    select(TeamMember).where(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id)
                )
                if not team_member.scalar_one_or_none():
                    raise HTTPException(status_code=403, detail="Not a member of this project")
            else:
                project_member = await db.execute(
                    select(ProjectMember).where(ProjectMember.project_id == project_id, ProjectMember.user_id == current_user.id)
                )
                if not project_member.scalar_one_or_none():
                    raise HTTPException(status_code=403, detail="Not a member of this project")

    repo.project_id = project_id
    await db.commit()
    await db.refresh(repo)
    return repo


@router.get("/repositories/{repo_id}/commits", response_model=List[GitHubCommitResponse])
async def get_repository_commits(
    repo_id: uuid.UUID,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubRepository).where(GitHubRepository.id == repo_id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    # Verify access
    account_result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.id == repo.account_id, GitHubAccount.user_id == current_user.id)
    )
    if not account_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(GitHubCommit)
        .where(GitHubCommit.repository_id == repo_id)
        .order_by(GitHubCommit.author_date.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/repositories/{repo_id}/branches", response_model=List[GitHubBranchResponse])
async def get_repository_branches(
    repo_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubRepository).where(GitHubRepository.id == repo_id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    account_result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.id == repo.account_id, GitHubAccount.user_id == current_user.id)
    )
    if not account_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(GitHubBranch).where(GitHubBranch.repository_id == repo_id)
    )
    return result.scalars().all()


@router.get("/repositories/{repo_id}/issues", response_model=List[GitHubIssueResponse])
async def get_repository_issues(
    repo_id: uuid.UUID,
    state: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubRepository).where(GitHubRepository.id == repo_id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    account_result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.id == repo.account_id, GitHubAccount.user_id == current_user.id)
    )
    if not account_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    query = select(GitHubIssue).where(GitHubIssue.repository_id == repo_id)
    if state:
        query = query.where(GitHubIssue.state == state)
    query = query.order_by(GitHubIssue.github_updated_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/repositories/{repo_id}/pull-requests", response_model=List[GitHubPullRequestResponse])
async def get_repository_pull_requests(
    repo_id: uuid.UUID,
    state: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(GitHubRepository).where(GitHubRepository.id == repo_id)
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    account_result = await db.execute(
        select(GitHubAccount).where(GitHubAccount.id == repo.account_id, GitHubAccount.user_id == current_user.id)
    )
    if not account_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized")

    query = select(GitHubPullRequest).where(GitHubPullRequest.repository_id == repo_id)
    if state:
        query = query.where(GitHubPullRequest.state == state)
    query = query.order_by(GitHubPullRequest.github_updated_at.desc())

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/issues/link", response_model=GitHubLinkedIssueResponse)
async def link_task_to_issue(
    link_data: GitHubLinkedIssueCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify task exists and user has access
    from app.models.task import Task
    result = await db.execute(select(Task).where(Task.id == link_data.task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check access
    project_result = await db.execute(select(Project).where(Project.id == task.project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id != current_user.id:
        if project.team_id:
            team_member = await db.execute(
                select(TeamMember).where(TeamMember.team_id == project.team_id, TeamMember.user_id == current_user.id)
            )
            if not team_member.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Not authorized")
        else:
            project_member = await db.execute(
                select(ProjectMember).where(ProjectMember.project_id == project.id, ProjectMember.user_id == current_user.id)
            )
            if not project_member.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Not authorized")

    # Verify issue exists
    result = await db.execute(select(GitHubIssue).where(GitHubIssue.id == link_data.github_issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(status_code=404, detail="GitHub issue not found")

    # Check if already linked
    existing = await db.execute(
        select(GitHubLinkedIssue).where(
            GitHubLinkedIssue.task_id == link_data.task_id,
            GitHubLinkedIssue.github_issue_id == link_data.github_issue_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already linked")

    link = GitHubLinkedIssue(**link_data.model_dump())
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


@router.delete("/issues/link/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_task_from_issue(
    link_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(GitHubLinkedIssue).where(GitHubLinkedIssue.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    # Verify task access
    from app.models.task import Task
    task_result = await db.execute(select(Task).where(Task.id == link.task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project_result = await db.execute(select(Project).where(Project.id == task.project_id))
    project = project_result.scalar_one_or_none()
    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.delete(link)
    await db.commit()


@router.post("/pull-requests/link")
async def link_task_to_pull_request(
    link_data: GitHubPullRequestLink,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify task exists and user has access
    from app.models.task import Task
    result = await db.execute(select(Task).where(Task.id == link_data.task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    project_result = await db.execute(select(Project).where(Project.id == task.project_id))
    project = project_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Verify PR exists
    result = await db.execute(select(GitHubPullRequest).where(GitHubPullRequest.id == link_data.pull_request_id))
    pr = result.scalar_one_or_none()
    if not pr:
        raise HTTPException(status_code=404, detail="Pull request not found")

    pr.task_id = link_data.task_id
    await db.commit()
    return {"message": "Linked successfully"}


from app.schemas.github import GitHubAccountResponse, GitHubLinkedIssueResponse, GitHubPullRequestLink