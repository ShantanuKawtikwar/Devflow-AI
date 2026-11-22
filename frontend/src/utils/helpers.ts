import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent':
      return 'badge-danger';
    case 'high':
      return 'badge-warning';
    case 'medium':
      return 'badge-primary';
    case 'low':
      return 'badge-neutral';
    default:
      return 'badge-neutral';
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'done':
      return 'badge-success';
    case 'in_progress':
      return 'badge-primary';
    case 'in_review':
      return 'badge-warning';
    case 'todo':
      return 'badge-neutral';
    case 'backlog':
      return 'badge-neutral';
    default:
      return 'badge-neutral';
  }
}

export function getProjectStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'badge-success';
    case 'active':
      return 'badge-primary';
    case 'on_hold':
      return 'badge-warning';
    case 'planning':
      return 'badge-neutral';
    default:
      return 'badge-neutral';
  }
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

export function generateProjectKey(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0].toUpperCase())
    .join('')
    .slice(0, 4);
}