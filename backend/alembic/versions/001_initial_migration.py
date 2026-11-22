"""Initial migration

Revision ID: 001_initial_migration
Revises:
Create Date: 2026-11-22 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_initial_migration'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types
    user_role = postgresql.ENUM('admin', 'member', 'viewer', name='userrole', create_type=True)
    user_role.create(op.get_bind(), checkfirst=True)

    team_role = postgresql.ENUM('owner', 'admin', 'member', 'viewer', name='teamrole', create_type=True)
    team_role.create(op.get_bind(), checkfirst=True)

    project_status = postgresql.ENUM('planning', 'active', 'on_hold', 'completed', name='projectstatus', create_type=True)
    project_status.create(op.get_bind(), checkfirst=True)

    project_priority = postgresql.ENUM('low', 'medium', 'high', 'urgent', name='projectpriority', create_type=True)
    project_priority.create(op.get_bind(), checkfirst=True)

    task_status = postgresql.ENUM('backlog', 'todo', 'in_progress', 'in_review', 'done', name='taskstatus', create_type=True)
    task_status.create(op.get_bind(), checkfirst=True)

    task_priority = postgresql.ENUM('low', 'medium', 'high', 'urgent', name='taskpriority', create_type=True)
    task_priority.create(op.get_bind(), checkfirst=True)

    sprint_status = postgresql.ENUM('planning', 'active', 'completed', 'cancelled', name='sprintstatus', create_type=True)
    sprint_status.create(op.get_bind(), checkfirst=True)

    notification_type = postgresql.ENUM('info', 'success', 'warning', 'error', 'task_assigned', 'task_updated', 'task_completed', 'comment_added', 'mention', 'sprint_started', 'sprint_ended', 'github_push', 'github_pr', 'github_issue', name='notificationtype', create_type=True)
    notification_type.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('full_name', sa.String(255)),
        sa.Column('avatar_url', sa.String(500)),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('role', user_role, nullable=False, server_default='member'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_login', sa.DateTime()),
        sa.Column('github_id', sa.String(100), unique=True),
        sa.Column('github_access_token', sa.String(500)),
        sa.Column('github_refresh_token', sa.String(500)),
        sa.Column('github_token_expires_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_github_id', 'users', ['github_id'], unique=True)

    # Create teams table
    op.create_table(
        'teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('avatar_url', sa.String(500)),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_teams_name', 'teams', ['name'])
    op.create_index('ix_teams_slug', 'teams', ['slug'], unique=True)

    # Create team_members table
    op.create_table(
        'team_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', team_role, nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_team_members_team_user', 'team_members', ['team_id', 'user_id'], unique=True)

    # Create projects table
    op.create_table(
        'projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('key', sa.String(10), nullable=False),
        sa.Column('status', project_status, nullable=False, server_default='planning'),
        sa.Column('priority', project_priority, nullable=False, server_default='medium'),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True)),
        sa.Column('team_id', postgresql.UUID(as_uuid=True)),
        sa.Column('start_date', sa.DateTime()),
        sa.Column('end_date', sa.DateTime()),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_projects_name', 'projects', ['name'])
    op.create_index('ix_projects_key', 'projects', ['key'], unique=True)
    op.create_index('ix_projects_owner_team', 'projects', ['owner_id', 'team_id'])

    # Create project_members table
    op.create_table(
        'project_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', team_role, nullable=False, server_default='member'),
        sa.Column('joined_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_project_members_project_user', 'project_members', ['project_id', 'user_id'], unique=True)

    # Create labels table
    op.create_table(
        'labels',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), nullable=False, server_default='#6366f1'),
        sa.Column('description', sa.String(500)),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create tasks table
    op.create_table(
        'tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('status', task_status, nullable=False, server_default='backlog'),
        sa.Column('priority', task_priority, nullable=False, server_default='medium'),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('reporter_id', postgresql.UUID(as_uuid=True)),
        sa.Column('assignee_id', postgresql.UUID(as_uuid=True)),
        sa.Column('sprint_id', postgresql.UUID(as_uuid=True)),
        sa.Column('parent_task_id', postgresql.UUID(as_uuid=True)),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('story_points', sa.Integer()),
        sa.Column('start_date', sa.DateTime()),
        sa.Column('due_date', sa.DateTime()),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('github_issue_number', sa.Integer()),
        sa.Column('github_pr_number', sa.Integer()),
        sa.Column('github_branch_name', sa.String(255)),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['assignee_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['parent_task_id'], ['tasks.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reporter_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['sprint_id'], ['sprints.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tasks_project_status', 'tasks', ['project_id', 'status'])
    op.create_index('ix_tasks_assignee', 'tasks', ['assignee_id'])
    op.create_index('ix_tasks_sprint', 'tasks', ['sprint_id'])
    op.create_index('ix_tasks_parent', 'tasks', ['parent_task_id'])

    # Create task_labels association table
    op.create_table(
        'task_labels',
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['label_id'], ['labels.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('task_id', 'label_id')
    )

    # Create task_comments table
    op.create_table(
        'task_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('author_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['author_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create sprints table
    op.create_table(
        'sprints',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('goal', sa.Text()),
        sa.Column('status', sprint_status, nullable=False, server_default='planning'),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('start_date', sa.DateTime(), nullable=False),
        sa.Column('end_date', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sprints_project_status', 'sprints', ['project_id', 'status'])

    # Create github_accounts table
    op.create_table(
        'github_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('github_user_id', sa.String(100), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('avatar_url', sa.String(500)),
        sa.Column('access_token_encrypted', sa.Text(), nullable=False),
        sa.Column('refresh_token_encrypted', sa.Text()),
        sa.Column('token_expires_at', sa.DateTime()),
        sa.Column('scope', sa.String(500)),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_accounts_user', 'github_accounts', ['user_id'])
    op.create_index('ix_github_accounts_github_user_id', 'github_accounts', ['github_user_id'], unique=True)

    # Create github_repositories table
    op.create_table(
        'github_repositories',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('github_account_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('project_id', postgresql.UUID(as_uuid=True)),
        sa.Column('github_repo_id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('html_url', sa.String(500)),
        sa.Column('clone_url', sa.String(500)),
        sa.Column('ssh_url', sa.String(500)),
        sa.Column('private', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('default_branch', sa.String(100), server_default='main'),
        sa.Column('language', sa.String(100)),
        sa.Column('stars_count', sa.Integer(), server_default='0'),
        sa.Column('forks_count', sa.Integer(), server_default='0'),
        sa.Column('open_issues_count', sa.Integer(), server_default='0'),
        sa.Column('last_synced_at', sa.DateTime()),
        sa.Column('is_synced', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['github_account_id'], ['github_accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_repositories_github_repo_id', 'github_repositories', ['github_repo_id'], unique=True)
    op.create_index('ix_github_repositories_account', 'github_repositories', ['github_account_id'])

    # Create github_branches table
    op.create_table(
        'github_branches',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('repository_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('sha', sa.String(100), nullable=False),
        sa.Column('protected', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['repository_id'], ['github_repositories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_branches_repo_name', 'github_branches', ['repository_id', 'name'], unique=True)

    # Create github_commits table
    op.create_table(
        'github_commits',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('repository_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sha', sa.String(100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('author_name', sa.String(255)),
        sa.Column('author_email', sa.String(255)),
        sa.Column('author_github_id', sa.String(100)),
        sa.Column('committer_name', sa.String(255)),
        sa.Column('committer_email', sa.String(255)),
        sa.Column('committer_github_id', sa.String(100)),
        sa.Column('committed_at', sa.DateTime(), nullable=False),
        sa.Column('html_url', sa.String(500)),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['repository_id'], ['github_repositories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_commits_repo_sha', 'github_commits', ['repository_id', 'sha'], unique=True)
    op.create_index('ix_github_commits_author', 'github_commits', ['author_github_id'])

    # Create github_issues table
    op.create_table(
        'github_issues',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('repository_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('github_issue_id', sa.String(100), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('body', sa.Text()),
        sa.Column('state', sa.String(50), nullable=False),
        sa.Column('state_reason', sa.String(100)),
        sa.Column('author_github_id', sa.String(100)),
        sa.Column('assignee_github_id', sa.String(100)),
        sa.Column('labels', sa.JSON()),
        sa.Column('milestone', sa.JSON()),
        sa.Column('html_url', sa.String(500)),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('closed_at', sa.DateTime()),
        sa.Column('synced_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['repository_id'], ['github_repositories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_issues_repo_number', 'github_issues', ['repository_id', 'number'], unique=True)
    op.create_index('ix_github_issues_state', 'github_issues', ['state'])

    # Create github_pull_requests table
    op.create_table(
        'github_pull_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('repository_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('github_pr_id', sa.String(100), nullable=False),
        sa.Column('number', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('body', sa.Text()),
        sa.Column('state', sa.String(50), nullable=False),
        sa.Column('draft', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('head_branch', sa.String(255), nullable=False),
        sa.Column('base_branch', sa.String(255), nullable=False),
        sa.Column('head_sha', sa.String(100)),
        sa.Column('base_sha', sa.String(100)),
        sa.Column('author_github_id', sa.String(100)),
        sa.Column('merged_by_github_id', sa.String(100)),
        sa.Column('merged_at', sa.DateTime()),
        sa.Column('html_url', sa.String(500)),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('closed_at', sa.DateTime()),
        sa.Column('synced_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['repository_id'], ['github_repositories.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_pull_requests_repo_number', 'github_pull_requests', ['repository_id', 'number'], unique=True)
    op.create_index('ix_github_pull_requests_state', 'github_pull_requests', ['state'])

    # Create github_linked_issues table
    op.create_table(
        'github_linked_issues',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('github_issue_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('github_pr_id', postgresql.UUID(as_uuid=True)),
        sa.Column('link_type', sa.String(50), nullable=False, server_default='related'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['github_issue_id'], ['github_issues.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['github_pr_id'], ['github_pull_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_github_linked_issues_task', 'github_linked_issues', ['task_id'])
    op.create_index('ix_github_linked_issues_issue', 'github_linked_issues', ['github_issue_id'])

    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', notification_type, nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('data', sa.JSON()),
        sa.Column('read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_notifications_user_read', 'notifications', ['user_id', 'read'])
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'])

    # Create activity_logs table
    op.create_table(
        'activity_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(100), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True)),
        sa.Column('project_id', postgresql.UUID(as_uuid=True)),
        sa.Column('team_id', postgresql.UUID(as_uuid=True)),
        sa.Column('old_data', sa.JSON()),
        sa.Column('new_data', sa.JSON()),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('user_agent', sa.String(500)),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_activity_logs_user_created', 'activity_logs', ['user_id', 'created_at'])
    op.create_index('ix_activity_logs_entity', 'activity_logs', ['entity_type', 'entity_id'])
    op.create_index('ix_activity_logs_project', 'activity_logs', ['project_id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('activity_logs')
    op.drop_table('notifications')
    op.drop_table('github_linked_issues')
    op.drop_table('github_pull_requests')
    op.drop_table('github_issues')
    op.drop_table('github_commits')
    op.drop_table('github_branches')
    op.drop_table('github_repositories')
    op.drop_table('github_accounts')
    op.drop_table('sprints')
    op.drop_table('task_comments')
    op.drop_table('task_labels')
    op.drop_table('tasks')
    op.drop_table('labels')
    op.drop_table('project_members')
    op.drop_table('projects')
    op.drop_table('team_members')
    op.drop_table('teams')
    op.drop_table('users')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS userrole')
    op.execute('DROP TYPE IF EXISTS teamrole')
    op.execute('DROP TYPE IF EXISTS projectstatus')
    op.execute('DROP TYPE IF EXISTS projectpriority')
    op.execute('DROP TYPE IF EXISTS taskstatus')
    op.execute('DROP TYPE IF EXISTS taskpriority')
    op.execute('DROP TYPE IF EXISTS sprintstatus')
    op.execute('DROP TYPE IF EXISTS notificationtype')