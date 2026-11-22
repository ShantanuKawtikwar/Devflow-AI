import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Calendar, User, Flag, Tag, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/helpers';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Textarea } from '../common/Textarea';
import { Modal } from '../common/Modal';
import { tasksApi } from '../../services/api';
import { TaskStatus, TaskPriority, User as UserType } from '../../types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  story_points: z.number().min(0).max(100).optional().nullable(),
  due_date: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormModalProps {
  projectId: string;
  initialStatus: TaskStatus;
  task?: any; // For editing
  onClose: () => void;
  onSuccess: () => void;
}

export function TaskFormModal({ projectId, initialStatus, task, onClose, onSuccess }: TaskFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!task;
  const [assignees, setAssignees] = useState<UserType[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      status: initialStatus,
      priority: 'medium',
      story_points: null,
      due_date: null,
      assignee_id: null,
      ...(task ? {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        story_points: task.story_points,
        due_date: task.due_date ? task.due_date.split('T')[0] : null,
        assignee_id: task.assignee_id,
      } : {}),
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: (data: TaskFormData) => tasksApi.create({ ...data, project_id: projectId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      onSuccess();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: (data: TaskFormData) => tasksApi.update(task!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      onSuccess();
    },
  });

  const onSubmit = (data: TaskFormData) => {
    const submitData = {
      ...data,
      story_points: data.story_points || undefined,
      due_date: data.due_date || undefined,
      assignee_id: data.assignee_id || undefined,
    };

    if (isEditing) {
      updateTaskMutation.mutate(submitData);
    } else {
      createTaskMutation.mutate(submitData);
    }
  };

  // Fetch project members for assignee dropdown
  useEffect(() => {
    // In a real app, this would fetch from API
    // For now, we'll use a placeholder
  }, [projectId]);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? 'Edit Task' : 'Create Task'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <Input
          label="Title"
          placeholder="Enter task title"
          error={errors.title?.message}
          {...register('title')}
        />

        <Textarea
          label="Description"
          placeholder="Add a description..."
          {...register('description')}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Status</label>
            <select
              {...register('status')}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label className="label">Priority</label>
            <select
              {...register('priority')}
              className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Story Points</label>
            <Input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              {...register('story_points', { valueAsNumber: true })}
            />
          </div>

          <div>
            <label className="label">Due Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <input
                type="date"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                {...register('due_date')}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Assignee</label>
          <select
            {...register('assignee_id')}
            className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="">Unassigned</option>
            {assignees.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name || user.username}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}