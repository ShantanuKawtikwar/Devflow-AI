import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  FolderKanban,
  Users,
  ChevronDown,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatDate, getProjectStatusColor, getPriorityColor } from '@/utils/helpers';
import { projectsApi } from '@/services/api';
import { Project, ProjectStatus, ProjectPriority } from '@/types';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Modal } from '@/components/common/Modal';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';

const projectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  key: z.string().min(2, 'Key must be at least 2 characters').max(10).regex(/^[A-Z][A-Z0-9]*$/),
  status: z.enum(['planning', 'active', 'on_hold', 'completed']),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  team_id: z.string().uuid().optional().nullable(),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

const priorityOptions: { value: ProjectPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function Projects() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectFormData) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create project');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProjectFormData> }) => projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project updated successfully');
      setEditingProject(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update project');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete project');
    },
  });

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const handleCreateSubmit = (data: ProjectFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdateSubmit = (data: ProjectFormData) => {
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, data });
    }
  };

  const handleDelete = (project: Project) => {
    if (confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(project.id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Projects</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">Manage your development projects</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'all')}
            className="w-full sm:w-48 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          >
            <option value="all">All Statuses</option>
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse" data-testid="skeleton-card">
              <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4 mb-4" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2 mb-2" />
              <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="card p-12 text-center">
          <FolderKanban className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100 mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {searchQuery || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Create your first project to get started'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link to={`/projects/${project.id}`} className="card-hover h-full p-6 flex flex-col">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <FolderKanban className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn('badge', getProjectStatusColor(project.status))}>
                      {project.status.replace('_', ' ')}
                    </span>
                    <span className={cn('badge', getPriorityColor(project.priority))}>
                      {project.priority}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 mb-1">{project.name}</h3>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-3">{project.key}</p>
                  {project.description && (
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 line-clamp-2 mb-4">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-4 text-sm text-neutral-500 dark:text-neutral-400">
                    <span className="flex items-center gap-1">
                      <FolderKanban className="w-4 h-4" />
                      {project.task_count} tasks
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {project.members?.length || 0} members
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {project.completed_task_count > 0 && project.task_count > 0 && (
                      <div className="w-24 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-600 rounded-full"
                          style={{ width: `${(project.completed_task_count / project.task_count) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal || !!editingProject}
        onClose={() => {
          setShowCreateModal(false);
          setEditingProject(null);
        }}
        title={editingProject ? 'Edit Project' : 'Create Project'}
        size="lg"
      >
        <ProjectForm
          onSubmit={editingProject ? handleUpdateSubmit : handleCreateSubmit}
          isLoading={createMutation.isPending || updateMutation.isPending}
          defaultValues={editingProject || undefined}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProject(null);
          }}
        />
      </Modal>
    </div>
  );
}

interface ProjectFormProps {
  onSubmit: (data: ProjectFormData) => void;
  isLoading: boolean;
  defaultValues?: Partial<ProjectFormData>;
  onClose: () => void;
}

function ProjectForm({ onSubmit, isLoading, defaultValues, onClose }: ProjectFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: '',
      description: '',
      key: '',
      status: 'planning',
      priority: 'medium',
      team_id: null,
      start_date: null,
      end_date: null,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Input
        label="Name"
        placeholder="Project name"
        error={errors.name?.message}
        {...register('name')}
      />

      <Input
        label="Key"
        placeholder="PROJ"
        error={errors.key?.message}
        {...register('key')}
        maxLength={10}
      />

      <div>
        <label className="label">Description</label>
        <textarea
          {...register('description')}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:placeholder:text-neutral-500 resize-y min-h-[100px]"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Status</label>
          <select {...register('status')} className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select {...register('priority')} className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
            {priorityOptions.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Start Date</label>
          <input type="date" {...register('start_date')} className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
        </div>
        <div>
          <label className="label">End Date</label>
          <input type="date" {...register('end_date')} className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-neutral-200 dark:border-neutral-800">
        <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {defaultValues ? 'Save Changes' : 'Create Project'}
        </Button>
      </div>
    </form>
  );
}