import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../utils/helpers';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface TaskStatusDistributionProps {
  data: Record<string, number>;
}

export function TaskStatusDistribution({ data }: TaskStatusDistributionProps) {
  const chartData = Object.entries(data).map(([status, count]) => ({
    status: status.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    count,
  }));

  const statusColors: Record<string, string> = {
    Done: '#22c55e',
    'In Progress': '#3b82f6',
    'In Review': '#f59e0b',
    'To Do': '#6b7280',
    Backlog: '#9ca3af',
  };

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Task Status Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              fill="#8884d8"
              paddingAngle={2}
              dataKey="count"
              nameKey="status"
              label={({ status, count, percent }) =>
                `${status}: ${count} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={statusColors[chartData[index].status] || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, 'tasks']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface PriorityDistributionProps {
  data: Record<string, number>;
}

export function PriorityDistribution({ data }: PriorityDistributionProps) {
  const chartData = Object.entries(data).map(([priority, count]) => ({
    priority: priority.charAt(0).toUpperCase() + priority.slice(1),
    count,
  }));

  const priorityColors: Record<string, string> = {
    Urgent: '#ef4444',
    High: '#f59e0b',
    Medium: '#3b82f6',
    Low: '#22c55e',
  };

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Priority Distribution</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis type="number" tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="priority" width={60} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value: number) => [value, 'tasks']} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={priorityColors[chartData[index].priority] || COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface TasksOverTimeProps {
  data: { date: string; created: number; completed: number }[];
}

export function TasksOverTime({ data }: TasksOverTimeProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    created: d.created,
    completed: d.completed,
  }));

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Tasks Over Time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, name: string) => [value, name === 'created' ? 'Created' : 'Completed']}
              labelFormatter={(label) => label}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              stroke="#3b82f6"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCreated)"
              name="Created"
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#22c55e"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCompleted)"
              name="Completed"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface SprintVelocityProps {
  data: { sprint_name: string; completed_story_points: number; total_story_points: number }[];
}

export function SprintVelocity({ data }: SprintVelocityProps) {
  const chartData = data.map((d) => ({
    sprint: d.sprint_name,
    completed: d.completed_story_points,
    total: d.total_story_points,
  }));

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Sprint Velocity</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="sprint" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, name: string) => [value, name === 'completed' ? 'Completed' : 'Planned']}
            />
            <Legend />
            <Bar dataKey="completed" fill="#22c55e" name="Completed" radius={[4, 4, 0, 0]} />
            <Bar dataKey="total" fill="#3b82f6" name="Planned" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ProjectStatusDistributionProps {
  data: { status: string; count: number }[];
}

export function ProjectStatusDistribution({ data }: ProjectStatusDistributionProps) {
  const statusColors: Record<string, string> = {
    Completed: '#22c55e',
    Active: '#3b82f6',
    'On Hold': '#f59e0b',
    Planning: '#6b7280',
  };

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-4">Project Status</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="count"
              nameKey="status"
              label={({ status, count, percent }) =>
                `${status}: ${count} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={statusColors[data[index].status] || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => [value, 'projects']} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number | string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: React.ReactNode;
  color: string;
}

export function StatCard({ title, value, change, changeType = 'neutral', icon, color }: StatCardProps) {
  return (
    <div className="card p-6 hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{value}</p>
          {change && (
            <p className={cn('text-sm mt-1', {
              'text-green-600 dark:text-green-400': changeType === 'positive',
              'text-red-600 dark:text-red-400': changeType === 'negative',
              'text-neutral-500 dark:text-neutral-400': changeType === 'neutral',
            })}>
              {change}
            </p>
          )}
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
          {icon}
        </div>
      </div>
    </div>
  );
}