import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Tab, Tabs, TabList, TabTrigger, TabContent } from '../../components/common/Tabs';
import { ProjectHeader } from './ProjectHeader';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { TaskList } from './TaskList';
import { SprintList } from './SprintList';
import { ProjectSettings } from './ProjectSettings';
import { projectsApi, tasksApi } from '../../services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Project, Task } from '../../types';
import { toast } from 'react-hot-toast';

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('board');

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => tasksApi.list(projectId!),
    enabled: !!projectId,
  });

  const handleTaskClick = (task: Task) => {
    navigate(`/tasks/${task.id}`);
  };

  if (isLoading) {
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
        <p className="text-neutral-500 dark:text-neutral-400">The project you&apos;re looking for doesn&apos;t exist.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ProjectHeader project={project} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabList className="grid w-full grid-cols-4">
          <TabTrigger value="board">Board</TabTrigger>
          <TabTrigger value="list">List</TabTrigger>
          <TabTrigger value="sprints">Sprints</TabTrigger>
          <TabTrigger value="settings">Settings</TabTrigger>
        </TabList>

        <TabContent value="board">
          <KanbanBoard projectId={projectId!} tasks={tasks || []} onTaskClick={handleTaskClick} />
        </TabContent>

        <TabContent value="list">
          <TaskList projectId={projectId!} tasks={tasks || []} onTaskClick={handleTaskClick} />
        </TabContent>

        <TabContent value="sprints">
          <SprintList projectId={projectId!} />
        </TabContent>

        <TabContent value="settings">
          <ProjectSettings project={project} />
        </TabContent>
      </Tabs>
    </div>
  );
}