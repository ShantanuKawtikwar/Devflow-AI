import { useState } from 'react';
import { DndContext, closestCorners, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Plus, MoreHorizontal, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../../utils/helpers';
import { Task, TaskStatus } from '../../types';
import { tasksApi } from '../../services/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TaskCard } from './TaskCard';
import { TaskFormModal } from './TaskFormModal';

const statuses: { value: TaskStatus; label: string; icon: React.ReactNode }[] = [
  { value: 'backlog', label: 'Backlog', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { value: 'todo', label: 'To Do', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
  { value: 'in_progress', label: 'In Progress', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { value: 'in_review', label: 'In Review', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
  { value: 'done', label: 'Done', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> },
];

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  onTaskClick: (task: Task) => void;
}

function KanbanColumn({ status, tasks, projectId, onTaskClick }: KanbanColumnProps) {
  const statusConfig = statuses.find((s) => s.value === status)!;
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { mutate: moveTask } = useMutation({
    mutationFn: ({ taskId, newStatus, newOrder }: { taskId: string; newStatus: TaskStatus; newOrder: number }) =>
      tasksApi.move(taskId, { status: newStatus, order: newOrder }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeTask = tasks.find((t) => t.id === active.id);
      const overTask = tasks.find((t) => t.id === over.id);

      if (activeTask && overTask) {
        const oldIndex = tasks.indexOf(activeTask);
        const newIndex = tasks.indexOf(overTask);
        const newOrder = overTask.order;

        moveTask({
          taskId: active.id as string,
          newStatus: status,
          newOrder,
        });
      }
    }
  };

  const handleDragOver = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeData = active.data.current?.task;
      const overData = over.data.current?.task;

      if (activeData && overData && activeData.status !== overData.status) {
        // Cross-column drop - handle in drop zone
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col h-full min-w-[280px] max-w-[280px] bg-neutral-100 dark:bg-neutral-900 rounded-xl">
          {/* Column Header */}
          <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="text-neutral-500 dark:text-neutral-400">{statusConfig.icon}</span>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{statusConfig.label}</h3>
              <span className="badge badge-neutral">{tasks.length}</span>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              aria-label={`Add task to ${statusConfig.label}`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Tasks List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin" role="list" aria-label={`${statusConfig.label} tasks`}>
            {tasks.length === 0 ? (
              <div className="h-24 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg flex items-center justify-center">
                <p className="text-neutral-400 dark:text-neutral-500 text-sm">Drop tasks here</p>
              </div>
            ) : (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                />
              ))
            )}
          </div>

          {/* Add Task Form */}
          {showCreateForm && (
            <TaskFormModal
              projectId={projectId}
              initialStatus={status}
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => {
                setShowCreateForm(false);
                queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
              }}
            />
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}

interface KanbanBoardProps {
  projectId: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function KanbanBoard({ projectId, tasks, onTaskClick }: KanbanBoardProps) {
  const tasksByStatus = statuses.reduce(
    (acc, { value }) => {
      acc[value] = tasks
        .filter((t) => t.status === value)
        .sort((a, b) => a.order - b.order);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>
  );

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {statuses.map(({ value }) => (
        <KanbanColumn
          key={value}
          status={value}
          tasks={tasksByStatus[value]}
          projectId={projectId}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  );
}