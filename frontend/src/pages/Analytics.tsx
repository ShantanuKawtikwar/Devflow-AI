import { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import {
  BarChart2,
  LineChart,
  PieChart,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Target,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '../../utils/helpers';
import { projectsApi, analyticsApi } from '../../services/api';
import { Project } from '../../types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { DashboardCharts } from '../charts/DashboardCharts';

type TimeRange = '7d' | '30d' | '90d' | 'all';
type AnalyticsTab = 'overview' | 'velocity' | 'burndown' | 'team' | 'cycle-time';

interface VelocityData {
  sprint: string;
  planned: number;
  completed: number;
}

interface BurndownData {
  date: string;
  ideal: number;
  actual: number;
}

interface CycleTimeData {
  date: string;
  avg_cycle_time: number;
  avg_lead_time: number;
}

interface TeamPerformanceData {
  user_id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  tasks_completed: number;
  story_points: number;
  avg_cycle_time: number;
}

interface ProjectAnalytics {
  velocity: VelocityData[];
  burndown: BurndownData[];
  cycle_time: CycleTimeData[];
  team_performance: TeamPerformanceData[];
  task_distribution: { status: string; count: number }[];
  priority_distribution: { priority: string; count: number }[];
}

export function Analytics() {
  const { projectId } = useParams<{ projectId: string }>();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [sprintFilter, setSprintFilter] = useState<string>('all');

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', projectId, timeRange, sprintFilter],
    queryFn: () => analyticsApi.getProjectAnalytics(projectId!, { time_range: timeRange, sprint_id: sprintFilter }),
    enabled: !!projectId,
  });

  const { data: sprints } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => projectsApi.getSprints(projectId!),
    enabled: !!projectId,
  });

  const tabs: { id: AnalyticsTab; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 className="w-4 h-4" />, description: 'High-level project metrics' },
    { id: 'velocity', label: 'Velocity', icon: <TrendingUp className="w-4 h-4" />, description: 'Sprint velocity tracking' },
    { id: 'burndown', label: 'Burndown', icon: <LineChart className="w-4 h-4" />, description: 'Sprint burndown charts' },
    { id: 'cycle-time', label: 'Cycle Time', icon: <Clock className="w-4 h-4" />, description: 'Lead & cycle time analysis' },
    { id: 'team', label: 'Team', icon: <Users className="w-4 h-4" />, description: 'Team performance metrics' },
  ];

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ];

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mb-2">Project not found</h2>
      </div>
    );
  }

  const completedSprints = sprints?.filter((s) => s.status === 'completed') || [];
  const activeSprint = sprints?.find((s) => s.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Analytics</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Insights and metrics for {project.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={timeRange}
            onValueChange={setTimeRange}
            options={timeRanges}
            className="w-48"
          />
          <Button variant="secondary" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Tasks"
          value={analytics?.task_distribution.reduce((sum, d) => sum + d.count, 0) || 0}
          icon={<BarChart2 className="w-5 h-5" />}
          color="blue"
          trend={analytics ? calculateTrend(analytics.task_distribution) : null}
        />
        <MetricCard
          title="Completed"
          value={analytics?.task_distribution.find((d) => d.status === 'done')?.count || 0}
          icon={<Target className="w-5 h-5" />}
          color="green"
        />
        <MetricCard
          title="In Progress"
          value={analytics?.task_distribution.find((d) => d.status === 'in_progress')?.count || 0}
          icon={<Activity className="w-5 h-5" />}
          color="yellow"
        />
        <MetricCard
          title="Avg Cycle Time"
          value={analytics?.cycle_time.length
            ? `${Math.round(analytics.cycle_time.reduce((sum, d) => sum + d.avg_cycle_time, 0) / analytics.cycle_time.length)}d`
            : '—'}
          icon={<Clock className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Tab Navigation */}
      <div className="card overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-neutral-800">
          <nav className="flex overflow-x-auto" aria-label="Analytics tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                  activeTab === tab.id
                    ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                )}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {analyticsLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
            </div>
          ) : activeTab === 'overview' && (
            <OverviewTab analytics={analytics} project={project} activeSprint={activeSprint} />
          )}

          {activeTab === 'velocity' && (
            <VelocityTab analytics={analytics} sprints={completedSprints} />
          )}

          {activeTab === 'burndown' && (
            <BurndownTab analytics={analytics} sprints={completedSprints} sprintFilter={sprintFilter} setSprintFilter={setSprintFilter} />
          )}

          {activeTab === 'cycle-time' && (
            <CycleTimeTab analytics={analytics} />
          )}

          {activeTab === 'team' && (
            <TeamTab analytics={analytics} />
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
  trend,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; label: string } | null;
}) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    red: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  };

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
          {trend && (
            <div className={cn('flex items-center gap-1 mt-2 text-sm', trend.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              <TrendingUp className="w-4 h-4" />
              <span>{Math.abs(trend.value)}% vs last period</span>
            </div>
          )}
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClasses[color as keyof typeof colorClasses] || colorClasses.blue)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function calculateTrend(distribution: { status: string; count: number }[]) {
  // Mock trend calculation
  return { value: 12, label: 'vs last period' };
}

function OverviewTab({ analytics, project, activeSprint }: { analytics: any; project: Project; activeSprint: any }) {
  if (!analytics) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Task Distribution</h3>
          </div>
          <DashboardCharts.TaskDistributionChart data={analytics.task_distribution} height={300} />
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Priority Distribution</h3>
          </div>
          <DashboardCharts.PriorityDistributionChart data={analytics.priority_distribution} height={300} />
        </Card>
      </div>

      {/* Sprint Progress */}
      {activeSprint && analytics.burndown.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{activeSprint.name} Burndown</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {formatDate(activeSprint.start_date)} - {formatDate(activeSprint.end_date)}
              </p>
            </div>
          </div>
          <DashboardCharts.BurndownChart data={analytics.burndown} height={300} />
        </Card>
      )}

      {/* Velocity Overview */}
      {analytics.velocity.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Recent Velocity</h3>
          </div>
          <DashboardCharts.VelocityChart data={analytics.velocity.slice(-6)} height={300} />
        </Card>
      )}

      {/* Cycle Time Trend */}
      {analytics.cycle_time.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Cycle Time Trend</h3>
          </div>
          <DashboardCharts.CycleTimeChart data={analytics.cycle_time} height={300} />
        </Card>
      )}
    </div>
  );
}

function VelocityTab({ analytics, sprints }: { analytics: any; sprints: any[] }) {
  if (!analytics) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Sprint Velocity</h3>
        <DashboardCharts.VelocityChart data={analytics.velocity} height={400} />
      </Card>

      {analytics.velocity.length > 0 && (
        <Card>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Velocity Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="pb-3 font-medium">Sprint</th>
                  <th className="pb-3 font-medium text-right">Planned</th>
                  <th className="pb-3 font-medium text-right">Completed</th>
                  <th className="pb-3 font-medium text-right">Velocity</th>
                  <th className="pb-3 font-medium text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {analytics.velocity.map((v: any, index: number) => (
                  <tr key={index} className="border-b border-neutral-100 dark:border-neutral-800/50">
                    <td className="py-3 text-neutral-900 dark:text-neutral-100">{v.sprint}</td>
                    <td className="py-3 text-right text-neutral-600 dark:text-neutral-400">{v.planned} pts</td>
                    <td className="py-3 text-right text-neutral-600 dark:text-neutral-400">{v.completed} pts</td>
                    <td className="py-3 text-right font-medium text-neutral-900 dark:text-neutral-100">{v.completed} pts</td>
                    <td className="py-3 text-right">
                      <span className={cn('text-sm font-medium', v.completed >= v.planned ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                        {v.completed - v.planned >= 0 ? '+' : ''}{v.completed - v.planned} pts
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Average velocity */}
      {analytics.velocity.length > 0 && (
        <Card>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Velocity Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatBox label="Average Velocity" value={`${Math.round(analytics.velocity.reduce((s: number, v: any) => s + v.completed, 0) / analytics.velocity.length)} pts`} />
            <StatBox label="Best Sprint" value={`${Math.max(...analytics.velocity.map((v: any) => v.completed))} pts`} />
            <StatBox label="Worst Sprint" value={`${Math.min(...analytics.velocity.map((v: any) => v.completed))} pts`} />
            <StatBox label="Sprints Tracked" value={analytics.velocity.length} />
          </div>
        </Card>
      )}
    </div>
  );
}

function BurndownTab({ analytics, sprints, sprintFilter, setSprintFilter }: { analytics: any; sprints: any[]; sprintFilter: string; setSprintFilter: (v: string) => void }) {
  if (!analytics) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Sprint Burndown</h3>
        <Select
          value={sprintFilter}
          onValueChange={setSprintFilter}
          options={[{ value: 'all', label: 'All Sprints' }, ...sprints.map((s) => ({ value: s.id, label: s.name }))]}
          className="w-64"
        />
      </div>

      {sprintFilter === 'all' ? (
        <Card>
          <DashboardCharts.BurndownChart data={analytics.burndown} height={400} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <DashboardCharts.BurndownChart data={analytics.burndown} height={400} />
          </Card>
          <Card>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Daily Progress</h3>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {analytics.burndown.slice().reverse().map((d: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <span className="text-sm text-neutral-500 dark:text-neutral-400">{formatDate(d.date)}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-neutral-600 dark:text-neutral-400">Ideal: {d.ideal}</span>
                    <span className={cn('font-medium', d.actual <= d.ideal ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      Actual: {d.actual}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function CycleTimeTab({ analytics }: { analytics: any }) {
  if (!analytics) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Avg Cycle Time"
          value={`${(analytics.cycle_time.reduce((s: number, d: any) => s + d.avg_cycle_time, 0) / (analytics.cycle_time.length || 1)).toFixed(1)} days`}
          icon={<Clock className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          title="Avg Lead Time"
          value={`${(analytics.cycle_time.reduce((s: number, d: any) => s + d.avg_lead_time, 0) / (analytics.cycle_time.length || 1)).toFixed(1)} days`}
          icon={<Calendar className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Trend"
          value={analytics.cycle_time.length > 1
            ? analytics.cycle_time[analytics.cycle_time.length - 1].avg_cycle_time < analytics.cycle_time[0].avg_cycle_time
              ? 'Improving ↓'
              : 'Increasing ↑'
            : '—'}
          icon={<TrendingUp className="w-5 h-5" />}
          color="green"
        />
      </div>

      <Card>
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Cycle & Lead Time Trend</h3>
        <DashboardCharts.CycleTimeChart data={analytics.cycle_time} height={400} />
      </Card>

      {analytics.cycle_time.length > 0 && (
        <Card>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Daily Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-neutral-800">
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium text-right">Avg Cycle Time</th>
                  <th className="pb-3 font-medium text-right">Avg Lead Time</th>
                  <th className="pb-3 font-medium text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                {analytics.cycle_time.slice().reverse().map((d: any, index: number) => (
                  <tr key={index} className="border-b border-neutral-100 dark:border-neutral-800/50">
                    <td className="py-3 text-neutral-900 dark:text-neutral-100">{formatDate(d.date)}</td>
                    <td className="py-3 text-right text-neutral-600 dark:text-neutral-400">{d.avg_cycle_time.toFixed(1)}d</td>
                    <td className="py-3 text-right text-neutral-600 dark:text-neutral-400">{d.avg_lead_time.toFixed(1)}d</td>
                    <td className="py-3 text-right">
                      <span className={cn('text-sm font-medium', d.avg_lead_time > d.avg_cycle_time ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400')}>
                        +{(d.avg_lead_time - d.avg_cycle_time).toFixed(1)}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function TeamTab({ analytics }: { analytics: any }) {
  if (!analytics) return <div>Loading...</div>;

  const team = analytics.team_performance || [];

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Team Performance</h3>
        {team.length > 0 ? (
          <div className="space-y-4">
            {team.map((member: any, index: number) => (
              <motion.div
                key={member.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center overflow-hidden">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-primary-600 dark:text-primary-400 font-medium">
                      {member.full_name?.charAt(0) || member.username?.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{member.full_name || member.username}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">@{member.username}</p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{member.tasks_completed}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Tasks</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{member.story_points}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Points</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{member.avg_cycle_time.toFixed(1)}d</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">Cycle Time</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
            <Users className="w-12 h-12 mx-auto mb-4 text-neutral-300 dark:text-neutral-600" />
            <p>No team performance data available</p>
          </div>
        )}
      </Card>

      {/* Team velocity chart */}
      {team.length > 0 && (
        <Card>
          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Team Velocity Comparison</h3>
          <DashboardCharts.TeamVelocityChart data={team} height={300} />
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 text-center">
      <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{label}</p>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{title}</p>
          <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-1">{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClasses[color as keyof typeof colorClasses] || colorClasses.blue)}>
          {icon}
        </div>
      </div>
    </Card>
  );
}