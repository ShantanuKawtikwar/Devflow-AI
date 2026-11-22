export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: 'admin' | 'project_manager' | 'developer' | 'viewer';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  user?: User;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  key: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  owner_id: string | null;
  team_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner?: User;
  team?: Team;
  members: ProjectMember[];
  task_count: number;
  completed_task_count: number;
  sprint_count?: number;
  active_sprint?: Sprint;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joined_at: string;
  user?: User;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  sprint_id: string | null;
  assignee_id: string | null;
  creator_id: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  order: number;
  story_points: number | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assignee?: User;
  creator?: User;
  labels: TaskLabel[];
  comments_count: number;
}

export interface TaskWithDetails extends Task {
  comments: TaskComment[];
}

export interface TaskLabel {
  id: string;
  task_id: string;
  name: string;
  color: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author?: User;
}

export interface Sprint {
  id: string;
  name: string;
  goal: string | null;
  project_id: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  project?: Project;
  task_count: number;
  completed_task_count: number;
  total_story_points: number;
  completed_story_points: number;
  tasks?: Task[];
}

export interface GitHubAccount {
  id: string;
  github_id: string;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  html_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepository {
  id: string;
  github_id: string;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string | null;
  clone_url: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  open_issues_count: number;
  default_branch: string;
  visibility: string;
  is_fork: boolean;
  is_archived: boolean;
  pushed_at: string | null;
  github_created_at: string | null;
  github_updated_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  account_id: string;
  project_id: string | null;
}

export interface GitHubCommit {
  id: string;
  repository_id: string;
  sha: string;
  message: string | null;
  author_name: string | null;
  author_email: string | null;
  author_date: string | null;
  html_url: string | null;
  created_at: string;
}

export interface GitHubBranch {
  id: string;
  repository_id: string;
  name: string;
  sha: string | null;
  is_protected: boolean;
  is_default: boolean;
  last_commit_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubIssue {
  id: string;
  repository_id: string;
  github_id: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  state_reason: string | null;
  labels: string | null;
  assignees: string | null;
  author_login: string | null;
  html_url: string | null;
  comments_count: number;
  github_created_at: string | null;
  github_updated_at: string | null;
  github_closed_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GitHubPullRequest {
  id: string;
  repository_id: string;
  task_id: string | null;
  github_id: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft: boolean;
  head_ref: string | null;
  head_sha: string | null;
  base_ref: string | null;
  base_sha: string | null;
  author_login: string | null;
  html_url: string | null;
  mergeable: boolean | null;
  merged_at: string | null;
  github_created_at: string | null;
  github_updated_at: string | null;
  github_closed_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  project_id: string | null;
  details: string | null;
  created_at: string;
  user?: User;
}

export interface DashboardAnalytics {
  total_projects: number;
  active_projects: number;
  completed_tasks: number;
  pending_tasks: number;
  overdue_tasks: number;
  current_sprint_progress: number;
  recent_activity: ActivityLog[];
  upcoming_deadlines: { id: string; title: string; due_date: string | null; project_id: string }[];
  task_status_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
}

export interface TasksOverTimeData {
  data: { date: string; created: number; completed: number }[];
}

export interface SprintVelocityData {
  velocity: { sprint_id: string; sprint_name: string; end_date: string | null; completed_story_points: number; total_story_points: number }[];
}

export interface ProjectStatusDistribution {
  data: { status: string; count: number }[];
}

export interface TeamContribution {
  contributions: { user_id: string; username: string; full_name: string; avatar_url: string | null; role: string; assigned_tasks: number; completed_tasks: number; story_points_completed: number; comments: number }[];
}

export interface OverdueStatistics {
  overdue_by_project: { project: string; count: number }[];
  overdue_by_priority: Record<string, number>;
  overdue_by_assignee: { username: string; full_name: string; count: number }[];
}

export interface AI_TaskGenerationResponse {
  tasks: { title: string; description: string | null; priority: string; story_points: number | null; labels: string[] }[];
}

export interface AI_TaskSummarizationResponse {
  summary: string;
  key_points: string[];
}

export interface AI_SprintPlanningResponse {
  suggested_sprints: { name: string; goal: string; start_date: string; end_date: string; task_ids: string[]; total_story_points: number }[];
}

export interface AI_ProjectInsightsResponse {
  progress_percentage: number;
  velocity: number;
  estimated_completion: string | null;
  risks: string[];
  recommendations: string[];
  blocked_tasks: number;
  overdue_tasks: number;
}

export interface AI_GitHubSummaryResponse {
  commits_count: number;
  pull_requests_count: number;
  issues_count: number;
  contributors: string[];
  summary: string;
}

export interface AI_DevelopmentSuggestionsResponse {
  suggestions: { type: string; title: string; description: string; related_task_id: string | null; priority: number }[];
}

export interface AI_ProjectDocumentationResponse {
  readme: string;
  api_docs: string | null;
  contributing: string | null;
}