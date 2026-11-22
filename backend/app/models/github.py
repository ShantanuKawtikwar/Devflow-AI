from sqlalchemy import Column, String, Boolean, DateTime, Enum as SQLEnum, Text, ForeignKey, Index, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
import enum

from app.database.base import Base


class GitHubAccount(Base):
    __tablename__ = "github_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    github_id = Column(String(100), unique=True, index=True, nullable=False)  # GitHub user ID
    login = Column(String(255), index=True, nullable=False)  # GitHub username
    name = Column(String(255))
    email = Column(String(255))
    avatar_url = Column(String(500))
    html_url = Column(String(500))
    access_token_encrypted = Column(Text)  # Encrypted access token
    token_type = Column(String(50), default="bearer")
    scope = Column(String(500))
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="github_account")
    repositories = relationship("GitHubRepository", back_populates="account")

    def __repr__(self):
        return f"<GitHubAccount(id={self.id}, login={self.login})>"


class GitHubRepository(Base):
    __tablename__ = "github_repositories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("github_accounts.id", ondelete="CASCADE"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"))
    github_id = Column(String(100), unique=True, index=True, nullable=False)  # GitHub repo ID
    name = Column(String(255), nullable=False)
    full_name = Column(String(500), index=True, nullable=False)  # owner/repo
    description = Column(Text)
    html_url = Column(String(500))
    clone_url = Column(String(500))
    language = Column(String(100))
    stargazers_count = Column(Integer, default=0)
    forks_count = Column(Integer, default=0)
    watchers_count = Column(Integer, default=0)
    open_issues_count = Column(Integer, default=0)
    default_branch = Column(String(100), default="main")
    visibility = Column(String(50))  # public, private, internal
    is_fork = Column(Boolean, default=False)
    is_archived = Column(Boolean, default=False)
    pushed_at = Column(DateTime)
    github_created_at = Column(DateTime)
    github_updated_at = Column(DateTime)
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    account = relationship("GitHubAccount", back_populates="repositories")
    project = relationship("Project", back_populates="github_repos")
    commits = relationship("GitHubCommit", back_populates="repository")
    branches = relationship("GitHubBranch", back_populates="repository")
    pull_requests = relationship("GitHubPullRequest", back_populates="repository")
    issues = relationship("GitHubIssue", back_populates="repository")

    __table_args__ = (
        Index('ix_github_repos_account_project', 'account_id', 'project_id'),
    )

    def __repr__(self):
        return f"<GitHubRepository(id={self.id}, full_name={self.full_name})>"


class GitHubCommit(Base):
    __tablename__ = "github_commits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False)
    sha = Column(String(100), nullable=False)
    message = Column(Text)
    author_name = Column(String(255))
    author_email = Column(String(255))
    author_date = Column(DateTime)
    committer_name = Column(String(255))
    committer_email = Column(String(255))
    committer_date = Column(DateTime)
    html_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    repository = relationship("GitHubRepository", back_populates="commits")

    __table_args__ = (
        Index('ix_github_commits_repo_sha', 'repository_id', 'sha', unique=True),
        Index('ix_github_commits_author_date', 'author_date'),
    )

    def __repr__(self):
        return f"<GitHubCommit(sha={self.sha[:7]})>"


class GitHubBranch(Base):
    __tablename__ = "github_branches"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    sha = Column(String(100))
    is_protected = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    last_commit_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    repository = relationship("GitHubRepository", back_populates="branches")

    __table_args__ = (
        Index('ix_github_branches_repo_name', 'repository_id', 'name', unique=True),
    )

    def __repr__(self):
        return f"<GitHubBranch(name={self.name})>"


class GitHubIssue(Base):
    __tablename__ = "github_issues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False)
    github_id = Column(String(100), nullable=False)  # GitHub issue ID
    number = Column(Integer, nullable=False)  # Issue number
    title = Column(String(500), nullable=False)
    body = Column(Text)
    state = Column(String(50))  # open, closed
    state_reason = Column(String(50))  # completed, not_planned, re-opened
    labels = Column(Text)  # JSON string of labels
    assignees = Column(Text)  # JSON string of assignees
    author_login = Column(String(255))
    html_url = Column(String(500))
    comments_count = Column(Integer, default=0)
    github_created_at = Column(DateTime)
    github_updated_at = Column(DateTime)
    github_closed_at = Column(DateTime)
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    repository = relationship("GitHubRepository", back_populates="issues")
    linked_tasks = relationship("GitHubLinkedIssue", back_populates="github_issue")

    __table_args__ = (
        Index('ix_github_issues_repo_number', 'repository_id', 'number', unique=True),
        Index('ix_github_issues_state', 'state'),
    )

    def __repr__(self):
        return f"<GitHubIssue(number={self.number}, title={self.title[:30]})>"


class GitHubLinkedIssue(Base):
    __tablename__ = "github_linked_issues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    github_issue_id = Column(UUID(as_uuid=True), ForeignKey("github_issues.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    task = relationship("Task", back_populates="github_issues")
    github_issue = relationship("GitHubIssue", back_populates="linked_tasks")

    __table_args__ = (
        Index('ix_github_linked_issues_task', 'task_id', 'github_issue_id', unique=True),
    )

    def __repr__(self):
        return f"<GitHubLinkedIssue(task_id={self.task_id}, github_issue_id={self.github_issue_id})>"


class GitHubPullRequest(Base):
    __tablename__ = "github_pull_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repository_id = Column(UUID(as_uuid=True), ForeignKey("github_repositories.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"))
    github_id = Column(String(100), nullable=False)
    number = Column(Integer, nullable=False)
    title = Column(String(500), nullable=False)
    body = Column(Text)
    state = Column(String(50))  # open, closed, merged
    draft = Column(Boolean, default=False)
    head_ref = Column(String(255))
    head_sha = Column(String(100))
    base_ref = Column(String(255))
    base_sha = Column(String(100))
    author_login = Column(String(255))
    html_url = Column(String(500))
    mergeable = Column(Boolean)
    merged_at = Column(DateTime)
    github_created_at = Column(DateTime)
    github_updated_at = Column(DateTime)
    github_closed_at = Column(DateTime)
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    repository = relationship("GitHubRepository", back_populates="pull_requests")
    task = relationship("Task", back_populates="github_prs")

    __table_args__ = (
        Index('ix_github_prs_repo_number', 'repository_id', 'number', unique=True),
        Index('ix_github_prs_state', 'state'),
        Index('ix_github_prs_task', 'task_id'),
    )

    def __repr__(self):
        return f"<GitHubPullRequest(number={self.number}, title={self.title[:30]})>"