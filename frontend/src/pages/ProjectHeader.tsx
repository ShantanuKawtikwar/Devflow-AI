import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Edit,
  Trash2,
  MoreHorizontal,
  Users,
  Calendar,
  Flag,
  CheckCircle2,
  Clock,
  GitBranch,
} from 'lucide-react';
import { cn, formatDate, getProjectStatusColor, getPriorityColor } from '../../utils/helpers';
import { Project } from '../../types';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '../../services/api';
import { toast } from 'react-hot-toast';
import { useState } from 'react';

interface ProjectHeaderProps {
  project: Project;
}

export function ProjectHeader({ project }: ProjectHeaderProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
      navigate('/projects');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    },
  });

  const handleDelete = () => {
    deleteMutation.mutate(project.id);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="card overflow-hidden">
      {/* Background accent */}
      <div className="h-2 bg-gradient-to-r from-primary-500 to-purple-500" />

      <div className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Back + Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors lg:hidden"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide">
                  {project.key}
                </span>
                <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{project.name}</h1>
              </div>
              {project.description && (
                <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl">{project.description}</p>
              )}
            </div>
          </div>

          {/* Status badges & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn('badge', getProjectStatusColor(project.status))}>
              {project.status.replace('_', ' ')}
            </span>
            <span className={cn('badge', getPriorityColor(project.priority))}>
              {project.priority}
            </span>

            <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400 hidden sm:flex">
              {project.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Started {formatDate(project.start_date)}
                </span>
              )}
              {project.end_date && (
                <span className="flex items-center gap-1">
                  <Flag className="w-4 h-4" />
                  Ends {formatDate(project.end_date)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {project.members?.length || 1} members
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Link to={`/projects/${project.id}/edit`} className="btn-secondary btn-sm">
                <Edit className="w-4 h-4" />
                Edit
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        {project.task_count > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-neutral-500 dark:text-neutral-400">Overall Progress</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {project.completed_task_count}/{project.task_count} tasks completed
              </span>
            </div>
            <div className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(project.completed_task_count / project.task_count) * 100}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-primary-500 to-purple-500 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
            <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{project.task_count}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Tasks</p>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{project.completed_task_count}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Completed</p>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{project.task_count - project.completed_task_count}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Remaining</p>
          </div>
          <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50">
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{project.sprint_count || 0}</p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Sprints</p>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Project"
        description={`Are you sure you want to delete "${project.name}"? This action cannot be undone.`}
      >
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} loading={deleteMutation.isPending}>
            Delete Project
          </Button>
        </div>
      </Modal>
    </div>
  );
}