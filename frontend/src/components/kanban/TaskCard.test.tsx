import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import { Task, TaskPriority } from '../../types';
import { vi } from 'vitest';

const mockTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'Task description',
  status: 'todo',
  priority: 'high',
  project_id: 'project-1',
  reporter_id: 'user-1',
  position: 0,
  story_points: 3,
  labels: [
    { id: 'label-1', name: 'bug', color: '#ef4444', project_id: 'project-1' },
    { id: 'label-2', name: 'frontend', color: '#3b82f6', project_id: 'project-1' },
  ],
  assignee: {
    id: 'user-2',
    username: 'assignee',
    full_name: 'Assignee User',
    avatar_url: null,
  },
  due_date: '2026-12-31T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('TaskCard', () => {
  const defaultProps = {
    task: mockTask,
    onClick: vi.fn(),
    onDragStart: vi.fn(),
    onDragEnd: vi.fn(),
  };

  it('renders task title', () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/test task/i)).toBeInTheDocument();
  });

  it('renders task description', () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/task description/i)).toBeInTheDocument();
  });

  it('renders priority indicator', () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByTestId('priority-high')).toBeInTheDocument();
  });

  it('renders story points when present', () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/3 pts/i)).toBeInTheDocument();
  });

  it('renders labels', () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/bug/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend/i)).toBeInTheDocument();
  });

  it('renders assignee avatar when present', () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByAltText(/assignee user/i)).toBeInTheDocument();
  });

  it('renders due date when present', () => {
    render(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/dec 31/i)).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    render(<TaskCard {...defaultProps} />);
    fireEvent.click(screen.getByTestId('task-card'));
    expect(defaultProps.onClick).toHaveBeenCalledWith(mockTask);
  });

  it('calls onDragStart when drag starts', () => {
    render(<TaskCard {...defaultProps} />);
    const card = screen.getByTestId('task-card');
    fireEvent.dragStart(card);
    expect(defaultProps.onDragStart).toHaveBeenCalled();
  });

  it('calls onDragEnd when drag ends', () => {
    render(<TaskCard {...defaultProps} />);
    const card = screen.getByTestId('task-card');
    fireEvent.dragEnd(card);
    expect(defaultProps.onDragEnd).toHaveBeenCalled();
  });

  it('shows different priority colors', () => {
    const lowPriorityTask = { ...mockTask, priority: 'low' as TaskPriority };
    render(<TaskCard {...defaultProps} task={lowPriorityTask} />);
    expect(screen.getByTestId('priority-low')).toBeInTheDocument();
  });

  it('does not show story points when not set', () => {
    const taskWithoutPoints = { ...mockTask, story_points: undefined };
    render(<TaskCard {...defaultProps} task={taskWithoutPoints} />);
    expect(screen.queryByText(/pts/i)).not.toBeInTheDocument();
  });

  it('does not show assignee when not assigned', () => {
    const taskWithoutAssignee = { ...mockTask, assignee: undefined };
    render(<TaskCard {...defaultProps} task={taskWithoutAssignee} />);
    expect(screen.queryByAltText(/assignee user/i)).not.toBeInTheDocument();
  });

  it('does not show due date when not set', () => {
    const taskWithoutDueDate = { ...mockTask, due_date: undefined };
    render(<TaskCard {...defaultProps} task={taskWithoutDueDate} />);
    expect(screen.queryByText(/dec 31/i)).not.toBeInTheDocument();
  });
});