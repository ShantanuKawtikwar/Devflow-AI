import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  X,
  Filter,
  Mail,
  Inbox,
  Archive,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  MessageSquare,
  GitPullRequest,
  Clock,
  Zap,
} from 'lucide-react';
import { cn, formatRelativeTime, formatDate } from '../../utils/helpers';
import { api, notificationsApi } from '../../services/api';
import { Notification, NotificationType } from '../../types';
import { Button } from '../common/Button';
import { Select } from '../common/Select';
import { Avatar } from '../common/Avatar';
import { Tabs, TabList, TabTrigger, TabContent } from '../common/Tabs';
import { Card } from '../common/Card';
import { toast } from 'react-hot-toast';

const typeIcons: Record<NotificationType, typeof Bell> = {
  task_assigned: Zap,
  task_updated: Clock,
  task_commented: MessageSquare,
  task_moved: GitPullRequest,
  sprint_started: Zap,
  sprint_ended: CheckCircle,
  mention: AlertCircle,
  team_invite: AlertCircle,
  github_pr: GitPullRequest,
  github_commit: Zap,
  github_issue: AlertCircle,
};

const typeLabels: Record<NotificationType, string> = {
  task_assigned: 'Task Assigned',
  task_updated: 'Task Updated',
  task_commented: 'New Comment',
  task_moved: 'Task Moved',
  sprint_started: 'Sprint Started',
  sprint_ended: 'Sprint Ended',
  mention: 'Mention',
  team_invite: 'Team Invite',
  github_pr: 'GitHub PR',
  github_commit: 'GitHub Commit',
  github_issue: 'GitHub Issue',
};

export function Notifications() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'archived'>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  const { data: notificationsResponse, isLoading, refetch } = useQuery({
    queryKey: ['notifications', activeTab, filterType],
    queryFn: () => notificationsApi.list({ status: activeTab, type: filterType !== 'all' ? filterType : undefined }),
    refetchInterval: 30000,
  });

  const notifications = notificationsResponse?.data || [];
  const meta = notificationsResponse?.meta;

  const markReadMutation = useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      setSelectedIds(new Set());
      setSelectAll(false);
    },
  });

  const markUnreadMutation = useMutation({
    mutationFn: (ids: string[]) => notificationsApi.markUnread(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
      setSelectedIds(new Set());
      setSelectAll(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (ids: string[]) => notificationsApi.archive(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedIds(new Set());
      setSelectAll(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => notificationsApi.delete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setSelectedIds(new Set());
      setSelectAll(false);
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(new Set(notifications.map((n) => n.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
    setSelectAll(newSelected.size === notifications.length && notifications.length > 0);
  };

  const selectedNotifications = notifications.filter((n) => selectedIds.has(n.id));
  const hasSelection = selectedIds.size > 0;

  const tabs = [
    { id: 'all', label: 'All', count: meta?.total || 0, icon: Inbox },
    { id: 'unread', label: 'Unread', count: meta?.unread_count || 0, icon: Bell },
    { id: 'archived', label: 'Archived', count: meta?.archived_count || 0, icon: Archive },
  ];

  const filteredNotifications = notifications;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Notifications</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Stay up to date with your projects</p>
        </div>
        <div className="flex items-center gap-3">
          {hasSelection && (
            <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <span>{selectedIds.size} selected</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(Array.from(selectedIds))} loading={markReadMutation.isPending}>
                  <Check className="w-3 h-3 mr-1" /> Mark Read
                </Button>
                <Button variant="ghost" size="sm" onClick={() => markUnreadMutation.mutate(Array.from(selectedIds))} loading={markUnreadMutation.isPending}>
                  <Clock className="w-3 h-3 mr-1" /> Mark Unread
                </Button>
                <Button variant="ghost" size="sm" onClick={() => archiveMutation.mutate(Array.from(selectedIds))} loading={archiveMutation.isPending}>
                  <Archive className="w-3 h-3 mr-1" /> Archive
                </Button>
                <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(Array.from(selectedIds))} loading={deleteMutation.isPending} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </div>
            </div>
          )}
          {activeTab === 'unread' && meta?.unread_count > 0 && (
            <Button variant="secondary" onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
              <Check className="w-3 h-3 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Tab Navigation & Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
            <TabList className="gap-1">
              {tabs.map((tab) => (
                <TabTrigger key={tab.id} value={tab.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      'px-2 py-0.5 text-xs rounded-full',
                      activeTab === tab.id ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                    )}>
                      {tab.count > 99 ? '99+' : tab.count}
                    </span>
                  )}
                </TabTrigger>
              ))}
            </TabList>
          </Tabs>

          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-neutral-400" />
            <Select
              value={filterType}
              onValueChange={setFilterType}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'task_assigned', label: 'Task Assigned' },
                { value: 'task_updated', label: 'Task Updated' },
                { value: 'task_commented', label: 'New Comment' },
                { value: 'task_moved', label: 'Task Moved' },
                { value: 'sprint_started', label: 'Sprint Started' },
                { value: 'sprint_ended', label: 'Sprint Ended' },
                { value: 'mention', label: 'Mention' },
                { value: 'team_invite', label: 'Team Invite' },
                { value: 'github_pr', label: 'GitHub PR' },
                { value: 'github_commit', label: 'GitHub Commit' },
                { value: 'github_issue', label: 'GitHub Issue' },
              ]}
              className="w-48"
            />
          </div>
        </div>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/4" />
                  <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2" />
                  <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            {filterType !== 'all' ? `No ${typeLabels[filterType as NotificationType]?.toLowerCase() || 'notifications'} found` : 'No notifications yet'}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {activeTab === 'archived' ? 'Archived notifications will appear here' : 'You\'re all caught up!'}
          </p>
          {filterType !== 'all' && (
            <Button variant="secondary" onClick={() => setFilterType('all')}>
              <X className="w-4 h-4 mr-2" />
              Clear Filter
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification, index) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              index={index}
              isSelected={selectedIds.has(notification.id)}
              onSelect={handleSelect}
              onClick={() => {
                if (!notification.read_at) {
                  markReadMutation.mutate([notification.id]);
                }
                if (notification.action_url) {
                  window.location.href = notification.action_url;
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Showing {((meta.page - 1) * meta.page_size) + 1} to {Math.min(meta.page * meta.page_size, meta.total)} of {meta.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={meta.page === 1}
                onClick={() => refetch()}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={meta.page === meta.total_pages}
                onClick={() => refetch()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: Notification;
  index: number;
  isSelected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onClick: () => void;
}

function NotificationItem({ notification, index, isSelected, onSelect, onClick }: NotificationItemProps) {
  const Icon = typeIcons[notification.type] || Bell;
  const isUnread = !notification.read_at;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        'card p-4 cursor-pointer transition-all',
        isUnread && 'bg-primary-50/50 dark:bg-primary-900/10 border-l-4 border-primary-500',
        isSelected && 'ring-2 ring-primary-500/50'
      )}
      onClick={onClick}
    >
      <div className="flex gap-4">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(notification.id, e.target.checked);
          }}
          className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500 mt-0.5"
        />
        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={cn('font-medium text-neutral-900 dark:text-neutral-100', isUnread && 'font-semibold')}>
                  {notification.title}
                </h4>
                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-primary-500" />
                )}
                <span className="badge badge-gray">{typeLabels[notification.type]}</span>
              </div>
              <p className={cn('text-sm', isUnread ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-500 dark:text-neutral-400')}>
                {notification.message}
              </p>
              {notification.metadata && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(notification.metadata).map(([key, value]) => (
                    <span key={key} className="text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 text-sm text-neutral-400 dark:text-neutral-500">
              <time>{formatRelativeTime(notification.created_at)}</time>
              {notification.action_url && (
                <span className="text-primary-600 dark:text-primary-400 hover:underline">View</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}