import { motion } from 'framer-motion';
import { Clock, User, Tag, MessageSquare, GitBranch, Flag, MoreHorizontal } from 'lucide-react';
import { cn, formatDate, getPriorityColor, getInitials } from '../../utils/helpers';
import { Task } from '../../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../services/api';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const queryClient = useQueryClient();

  const { mutate: updateTask } = useMutation({
    mutationFn: (data: Partial<Task> & { id: string }) => {
      const { id, ...rest } = data;
      return tasksApi.update(id, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleStatusChange = (newStatus: Task['status']) => {
    updateTask({ id: task.id, status: newStatus });
  };

  const handlePriorityChange = (newPriority: Task['priority']) => {
    updateTask({ id: task.id, priority: newPriority });
  };

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';

  return (
    <motion.div
      layout
      className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
      whileHover={{ y: -2 }}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      aria-label={task.title}
    >
      {/* Priority indicator */}
      <div className={cn('w-full h-1 rounded-t-lg mb-3', getPriorityColor(task.priority).replace('badge', 'bg'))} />

      {/* Title */}
      <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-2 line-clamp-2">{task.title}</h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: label.color + '20', color: label.color }}
            >
              {label.name}
            </span>
          ))}
          {task.labels.length > 3 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-neutral-500 dark:text-neutral-400">
              +{task.labels.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="space-y-2">
        {/* Assignee */}
        {task.assignee && (
          <div className="flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-neutral-400" />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                  {getInitials(task.assignee.full_name || task.assignee.username)}
                </span>
              </div>
              <span className="text-neutral-600 dark:text-neutral-400 truncate">
                {task.assignee.full_name || task.assignee.username}
              </span>
            </div>
          </div>
        )}

        {/* Due Date */}
        {task.due_date && (
          <div className={cn('flex items-center gap-2 text-sm', isOverdue && 'text-red-600 dark:text-red-400')}>
            <Clock className="w-4 h-4" />
            <span className={cn(isOverdue && 'font-medium')}>
              {isOverdue ? 'Overdue' : 'Due'} {formatDate(task.due_date)}
            </span>
          </div>
        )}

        {/* Story Points */}
        {task.story_points && (
          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <Flag className="w-4 h-4" />
            <span>{task.story_points} pts</span>
          </div>
        )}

        {/* Comments count */}
        {task.comments_count > 0 && (
          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <MessageSquare className="w-4 h-4" />
            <span>{task.comments_count}</span>
          </div>
        )}

        {/* GitHub linked */}
        {/* This would be shown if task has linked GitHub issue/PR */}
      </div>
    </motion.div>
  );
}