import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  GitBranch,
  TrendingUp,
  Plus,
  Activity,
  Calendar,
  Users,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn, formatRelativeTime, getProjectStatusColor } from '../../utils/helpers';
import { projectsApi, tasksApi, sprintsApi, analyticsApi, githubApi } from '../../services/api';
import { StatCard } from '../charts/DashboardCharts';
import { Task, Sprint, Project, ActivityLog } from '../../types';
import { useAuthStore } from '../../context/authStore';

export function Dashboard() {
  const { user } = useAuthStore();
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.getDashboard(),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', 'recent'],
    queryFn: () => tasksApi.list('all', { limit: 5 }),
  });

  const { data: sprintsData } = useQuery({
    queryKey: ['sprints', 'active'],
    queryFn: () => sprintsApi.list('all', { status: 'active' }),
  });

  // Update recent projects when projects data loads
  useEffect(() => {
    if (projectsData) {
      setRecentProjects(
        projectsData
          .filter((p) => p.is_active)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 4)
      );
    }
  }, [projectsData]);

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Projects',
      value: dashboardData?.total_projects || 0,
      icon: <FolderKanban className="w-6 h-6" />,
      color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400',
    },
    {
      title: 'Active Projects',
      value: dashboardData?.active_projects || 0,
      icon: <GitBranch className="w-6 h-6" />,
      color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    },
    {
      title: 'Completed Tasks',
      value: dashboardData?.completed_tasks || 0,
      icon: <CheckCircle2 className="w-6 h-6" />,
      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Pending Tasks',
      value: dashboardData?.pending_tasks || 0,
      icon: <Clock className="w-6 h-6" />,
      color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Overdue Tasks',
      value: dashboardData?.overdue_tasks || 0,
      change: dashboardData?.overdue_tasks ? `${dashboardData.overdue_tasks} need attention` : undefined,
      changeType: dashboardData?.overdue_tasks && dashboardData.overdue_tasks > 0 ? 'negative' : 'neutral',
      icon: <AlertTriangle className="w-6 h-6" />,
      color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    },
    {
      title: 'Sprint Progress',
      value: `${Math.round(dashboardData?.current_sprint_progress || 0)}%`,
      icon: <TrendingUp className="w-6 h-6" />,
      color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    },
  ];

  const activeSprint = sprintsData?.find((s: Sprint) => s.status === 'active');
  const upcomingDeadlines = dashboardData?.upcoming_deadlines || [];
  const recentActivity = dashboardData?.recent_activity || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Welcome back, {user?.full_name?.split(' ')[0] || user?.username || 'Developer'}
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/projects/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            New Project
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Projects & Activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Projects */}
          <div className="card">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Recent Projects</h2>
              <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                View all
              </Link>
            </div>
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="p-4 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <FolderKanban className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">{project.name}</p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">{project.key} • {project.task_count} tasks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cn('badge', getProjectStatusColor(project.status))}>
                        {project.status.replace('_', ' ')}
                      </span>
                      {project.completed_task_count > 0 && project.task_count > 0 && (
                        <div className="w-24 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-600 rounded-full transition-all duration-500"
                            style={{ width: `${(project.completed_task_count / project.task_count) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-12 text-center">
                  <FolderKanban className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-500 dark:text-neutral-400">No projects yet</p>
                  <Link to="/projects/new" className="mt-4 inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium">
                    Create your first project
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Active Sprint */}
          {activeSprint && (
            <div className="card">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <GitBranch className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Active Sprint</h2>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">{activeSprint.name}</p>
                  </div>
                </div>
                <Link to={`/sprints/${activeSprint.id}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  View
                </Link>
              </div>
              <div className="p-6">
                {activeSprint.goal && (
                  <p className="text-neutral-600 dark:text-neutral-400 mb-4">{activeSprint.goal}</p>
                )}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">Progress</p>
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                      {activeSprint.completed_task_count}/{activeSprint.task_count} tasks
                    </p>
                  </div>
                  <div className="w-48 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full transition-all duration-500"
                      style={{ width: `${activeSprint.task_count > 0 ? (activeSprint.completed_task_count / activeSprint.task_count) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {activeSprint.total_story_points > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-neutral-500 dark:text-neutral-400">Story Points</span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {activeSprint.completed_story_points}/{activeSprint.total_story_points}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="card">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Upcoming Deadlines</h2>
                </div>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {upcomingDeadlines.slice(0, 5).map((deadline) => (
                  <div key={deadline.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">{deadline.title}</p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">Due {formatRelativeTime(deadline.due_date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="card">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h2 className="font-semibold text-neutral-900 dark:text-neutral-100">Recent Activity</h2>
                </div>
              </div>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {recentActivity.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="p-4 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-neutral-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 dark:text-neutral-100">
                        <span className="font-medium">{activity.user_name}</span> {activity.action} {activity.entity_name}
                      </p>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">{formatRelativeTime(activity.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Quick Actions & GitHub */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="card p-6">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link to="/projects/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">Create Project</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Start a new project</p>
                </div>
              </Link>
              <Link to="/tasks" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">Create Task</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Add a new task</p>
                </div>
              </Link>
              <Link to="/sprints/new" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">Plan Sprint</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Create a new sprint</p>
                </div>
              </Link>
              <Link to="/ai" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">AI Assistant</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Get AI-powered insights</p>
                </div>
              </Link>
              <Link to="/github" className="flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                </div>
                <div>
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">GitHub Integration</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Connect repositories</p>
                </div>
              </Link>
            </div>
          </div>

          {/* GitHub Status */}
          <div className="card p-6">
            <h2 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-neutral-600 dark:text-neutral-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              GitHub Status
            </h2>
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">Not connected</p>
              <Link to="/github" className="btn-primary">
                Connect GitHub
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}