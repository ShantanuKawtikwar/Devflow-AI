from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid


class GitHubAccountBase(BaseModel):
    login: str
    name: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    html_url: Optional[str] = None


class GitHubAccountResponse(GitHubAccountBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    github_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class GitHubOAuthURL(BaseModel):
    url: str


class GitHubOAuthCallback(BaseModel):
    code: str


class GitHubRepositoryBase(BaseModel):
    name: str
    full_name: str
    description: Optional[str] = None
    html_url: Optional[str] = None
    clone_url: Optional[str] = None
    language: Optional[str] = None
    stargazers_count: int = 0
    forks_count: int = 0
    watchers_count: int = 0
    open_issues_count: int = 0
    default_branch: str = "main"
    visibility: str = "public"
    is_fork: bool = False
    is_archived: bool = False
    pushed_at: Optional[datetime] = None


class GitHubRepositoryCreate(GitHubRepositoryBase):
    github_id: str
    account_id: uuid.UUID
    project_id: Optional[uuid.UUID] = None


class GitHubRepositoryUpdate(BaseModel):
    project_id: Optional[uuid.UUID] = None


class GitHubRepositoryResponse(GitHubRepositoryBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    github_id: str
    account_id: uuid.UUID
    project_id: Optional[uuid.UUID]
    github_created_at: Optional[datetime]
    github_updated_at: Optional[datetime]
    last_synced_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class GitHubCommitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    repository_id: uuid.UUID
    sha: str
    message: Optional[str]
    author_name: Optional[str]
    author_email: Optional[str]
    author_date: Optional[datetime]
    html_url: Optional[str]
    created_at: datetime


class GitHubBranchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    repository_id: uuid.UUID
    name: str
    sha: Optional[str]
    is_protected: bool
    is_default: bool
    last_commit_date: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class GitHubIssueBase(BaseModel):
    number: int
    title: str
    body: Optional[str] = None
    state: str
    state_reason: Optional[str] = None
    labels: Optional[str] = None
    assignees: Optional[str] = None
    author_login: Optional[str] = None
    html_url: Optional[str] = None
    comments_count: int = 0


class GitHubIssueResponse(GitHubIssueBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    repository_id: uuid.UUID
    github_id: str
    github_created_at: Optional[datetime]
    github_updated_at: Optional[datetime]
    github_closed_at: Optional[datetime]
    last_synced_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class GitHubLinkedIssueCreate(BaseModel):
    task_id: uuid.UUID
    github_issue_id: uuid.UUID


class GitHubLinkedIssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_id: uuid.UUID
    github_issue_id: uuid.UUID
    created_at: datetime
    github_issue: Optional[GitHubIssueResponse] = None


class GitHubPullRequestBase(BaseModel):
    number: int
    title: str
    body: Optional[str] = None
    state: str
    draft: bool = False
    head_ref: Optional[str] = None
    head_sha: Optional[str] = None
    base_ref: Optional[str] = None
    base_sha: Optional[str] = None
    author_login: Optional[str] = None
    html_url: Optional[str] = None
    mergeable: Optional[bool] = None


class GitHubPullRequestResponse(GitHubPullRequestBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    repository_id: uuid.UUID
    task_id: Optional[uuid.UUID]
    github_id: str
    merged_at: Optional[datetime]
    github_created_at: Optional[datetime]
    github_updated_at: Optional[datetime]
    github_closed_at: Optional[datetime]
    last_synced_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class GitHubPullRequestLink(BaseModel):
    task_id: uuid.UUID
    pull_request_id: uuid.UUID


class GitHubSyncResponse(BaseModel):
    repositories_synced: int
    commits_synced: int
    issues_synced: int
    pull_requests_synced: int
    branches_synced: int