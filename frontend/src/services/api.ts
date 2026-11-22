import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../context/authStore';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data: { email: string; username: string; password: string; full_name?: string; bio?: string }) =>
    api.post('/auth/register', data),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  getMe: () => api.get('/auth/me'),
  updateMe: (data: Partial<{ email: string; username: string; full_name: string; bio: string; avatar_url: string }>) =>
    api.put('/auth/me', data),
  updatePassword: (current_password: string, new_password: string) =>
    api.put('/auth/me/password', { current_password, new_password }),
  logout: () => api.post('/auth/logout'),
};

// Teams API
export const teamsApi = {
  list: () => api.get('/teams'),
  create: (data: { name: string; slug: string; description?: string }) =>
    api.post('/teams', data),
  get: (id: string) => api.get(`/teams/${id}`),
  update: (id: string, data: Partial<{ name: string; slug: string; description: string; avatar_url: string; is_active: boolean }>) =>
    api.put(`/teams/${id}`, data),
  delete: (id: string) => api.delete(`/teams/${id}`),
  listMembers: (teamId: string) => api.get(`/teams/${teamId}/members`),
  addMember: (teamId: string, data: { user_id: string; role?: string }) =>
    api.post(`/teams/${teamId}/members`, data),
  updateMember: (teamId: string, userId: string, data: { role?: string }) =>
    api.put(`/teams/${teamId}/members/${userId}`, data),
  removeMember: (teamId: string, userId: string) =>
    api.delete(`/teams/${teamId}/members/${userId}`),
};

// Projects API
export const projectsApi = {
  list: (params?: { status?: string; team_id?: string }) =>
    api.get('/projects', { params }),
  create: (data: { name: string; description?: string; key: string; status?: string; priority?: string; team_id?: string; start_date?: string; end_date?: string }) =>
    api.post('/projects', data),
  get: (id: string) => api.get(`/projects/${id}`),
  update: (id: string, data: Partial<{ name: string; description: string; key: string; status: string; priority: string; team_id: string; start_date: string; end_date: string; is_active: boolean }>) =>
    api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  listMembers: (projectId: string) => api.get(`/projects/${projectId}/members`),
  addMember: (projectId: string, data: { user_id: string; role?: string }) =>
    api.post(`/projects/${projectId}/members`, data),
  updateMember: (projectId: string, userId: string, data: { role?: string }) =>
    api.put(`/projects/${projectId}/members/${userId}`, data),
  removeMember: (projectId: string, userId: string) =>
    api.delete(`/projects/${projectId}/members/${userId}`),
};

// Tasks API
export const tasksApi = {
  list: (projectId: string, params?: { status?: string; assignee_id?: string; sprint_id?: string }) =>
    api.get('/tasks', { params: { project_id: projectId, ...params } }),
  create: (data: { title: string; description?: string; project_id: string; sprint_id?: string; assignee_id?: string; status?: string; priority?: string; order?: number; story_points?: number; due_date?: string }) =>
    api.post('/tasks', data),
  get: (id: string) => api.get(`/tasks/${id}`),
  update: (id: string, data: Partial<{ title: string; description: string; sprint_id: string; assignee_id: string; status: string; priority: string; order: number; story_points: number; due_date: string }>) =>
    api.put(`/tasks/${id}`, data),
  move: (id: string, data: { status: string; order: number }) =>
    api.put(`/tasks/${id}/move`, data),
  delete: (id: string) => api.delete(`/tasks/${id}`),
  listComments: (taskId: string) => api.get(`/tasks/${taskId}/comments`),
  createComment: (taskId: string, content: string) => api.post(`/tasks/${taskId}/comments`, { content }),
  updateComment: (commentId: string, content: string) => api.put(`/tasks/comments/${commentId}`, { content }),
  deleteComment: (commentId: string) => api.delete(`/tasks/comments/${commentId}`),
  addLabel: (taskId: string, data: { name: string; color?: string }) => api.post(`/tasks/${taskId}/labels`, data),
  removeLabel: (taskId: string, labelId: string) => api.delete(`/tasks/${taskId}/labels/${labelId}`),
};

// Sprints API
export const sprintsApi = {
  list: (projectId: string, params?: { status?: string }) =>
    api.get('/sprints', { params: { project_id: projectId, ...params } }),
  create: (data: { name: string; goal?: string; project_id: string; start_date: string; end_date: string }) =>
    api.post('/sprints', data),
  get: (id: string) => api.get(`/sprints/${id}`),
  update: (id: string, data: Partial<{ name: string; goal: string; status: string; start_date: string; end_date: string }>) =>
    api.put(`/sprints/${id}`, data),
  delete: (id: string) => api.delete(`/sprints/${id}`),
  start: (id: string) => api.post(`/sprints/${id}/start`),
  complete: (id: string) => api.post(`/sprints/${id}/complete`),
};

// GitHub API
export const githubApi = {
  getOAuthUrl: () => api.get('/github/oauth/url'),
  oauthCallback: (code: string) => api.post('/github/oauth/callback', { code }),
  getAccount: () => api.get('/github/account'),
  disconnectAccount: () => api.delete('/github/account'),
  listRepositories: (projectId?: string) => api.get('/github/repositories', { params: { project_id: projectId } }),
  syncRepositories: () => api.post('/github/repositories/sync'),
  linkRepositoryToProject: (repoId: string, projectId?: string) =>
    api.put(`/github/repositories/${repoId}/link-project`, { project_id: projectId }),
  getCommits: (repoId: string, limit?: number) => api.get(`/github/repositories/${repoId}/commits`, { params: { limit } }),
  getBranches: (repoId: string) => api.get(`/github/repositories/${repoId}/branches`),
  getIssues: (repoId: string, state?: string) => api.get(`/github/repositories/${repoId}/issues`, { params: { state } }),
  getPullRequests: (repoId: string, state?: string) => api.get(`/github/repositories/${repoId}/pull-requests`, { params: { state } }),
  linkTaskToIssue: (taskId: string, githubIssueId: string) => api.post('/github/issues/link', { task_id: taskId, github_issue_id: githubIssueId }),
  unlinkTaskFromIssue: (linkId: string) => api.delete(`/github/issues/link/${linkId}`),
  linkTaskToPullRequest: (taskId: string, pullRequestId: string) => api.post('/github/pull-requests/link', { task_id: taskId, pull_request_id: pullRequestId }),
};

// AI API
export const aiApi = {
  generateTasks: (data: { project_description: string; project_id: string; max_tasks?: number }) =>
    api.post('/ai/generate-tasks', data),
  summarizeTask: (data: { content: string; max_length?: number }) =>
    api.post('/ai/summarize-task', data),
  planSprints: (data: { project_id: string; sprint_duration_days?: number; team_size?: number }) =>
    api.post('/ai/plan-sprints', data),
  projectInsights: (projectId: string) => api.post('/ai/project-insights', { project_id: projectId }),
  githubSummary: (repositoryId: string, days?: number) => api.post('/ai/github-summary', { repository_id: repositoryId, days }),
  developmentSuggestions: (projectId: string, userId: string) => api.post('/ai/development-suggestions', { project_id: projectId, user_id: userId }),
  generateDocumentation: (data: { project_id: string; include_tasks?: boolean; include_github?: boolean }) =>
    api.post('/ai/generate-documentation', data),
};

// Notifications API
export const notificationsApi = {
  list: (params?: { unread_only?: boolean; limit?: number }) =>
    api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (notificationIds: string[]) => api.put('/notifications/mark-read', { notification_ids: notificationIds }),
  markOneRead: (notificationId: string) => api.put(`/notifications/${notificationId}/read`),
  delete: (notificationId: string) => api.delete(`/notifications/${notificationId}`),
  getActivity: (params?: { project_id?: string; limit?: number }) =>
    api.get('/notifications/activity', { params }),
};

// Analytics API
export const analyticsApi = {
  getDashboard: () => api.get('/analytics/dashboard'),
  getTasksOverTime: (days?: number) => api.get('/analytics/tasks-over-time', { params: { days } }),
  getSprintVelocity: (projectId: string) => api.get(`/analytics/sprint-velocity`, { params: { project_id: projectId } }),
  getProjectStatusDistribution: () => api.get('/analytics/project-status-distribution'),
  getTeamContribution: (projectId: string) => api.get(`/analytics/team-contribution`, { params: { project_id: projectId } }),
  getOverdueStatistics: () => api.get('/analytics/overdue-statistics'),
};