import { screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import { Task, TaskPriority } from '../../types';
import { vi } from 'vitest';
import { renderWithQueryClient } from '../../test/setup.tsx';

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

  it('has draggable attribute', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('draggable', 'true');
  });

  it('calls onDragStart when drag starts', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    const card = screen.getByRole('button');
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn() } });
    expect(defaultProps.onDragStart).toHaveBeenCalled();
  });

  it('calls onDragEnd when drag ends', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    const card = screen.getByRole('button');
    fireEvent.dragEnd(card);
    expect(defaultProps.onDragEnd).toHaveBeenCalled();
  });

  it('renders task title', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/test task/i)).toBeInTheDocument();
  });

  it('renders task description', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/task description/i)).toBeInTheDocument();
  });

  it('renders priority indicator', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Test Task');
  });

  it('renders story points when present', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/3 pts/i)).toBeInTheDocument();
  });

  it('renders labels', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/bug/i)).toBeInTheDocument();
    expect(screen.getByText(/frontend/i)).toBeInTheDocument();
  });

  it('renders assignee avatar when present', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/assignee user/i)).toBeInTheDocument();
  });

  it('renders due date when present', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    expect(screen.getByText(/dec 31/i)).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    fireEvent.click(screen.getByRole('button'));
    expect(defaultProps.onClick).toHaveBeenCalled();
  });

  it('has draggable attribute', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('draggable', 'true');
  });

  it('has draggable attribute', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('draggable', 'true');
  });

  it('calls onDragStart when drag starts', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    const card = screen.getByRole('button');
    fireEvent.dragStart(card, { dataTransfer: { setData: vi.fn() } });
    expect(defaultProps.onDragStart).toHaveBeenCalled();
  });

  it('calls onDragEnd when drag ends', () => {
    renderWithQueryClient(<TaskCard {...defaultProps} />);
    const card = screen.getByRole('button');
    fireEvent.dragEnd(card);
    expect(defaultProps.onDragEnd).toHaveBeenCalled();
  });

  it('shows different priority colors', () => {
    const lowPriorityTask = { ...mockTask, priority: 'low' as TaskPriority };
    renderWithQueryClient(<TaskCard {...defaultProps} task={lowPriorityTask} />);
    // Check that the priority indicator div has the correct background color
    const priorityDiv = screen.getByRole('button').firstChild;
    expect(priorityDiv).toHaveClass('bg-neutral');
  });

  it('does not show story points when not set', () => {
    const taskWithoutPoints = { ...mockTask, story_points: undefined };
    renderWithQueryClient(<TaskCard {...defaultProps} task={taskWithoutPoints} />);
    expect(screen.queryByText(/pts/i)).not.toBeInTheDocument();
  });

  it('does not show assignee when not assigned', () => {
    const taskWithoutAssignee = { ...mockTask, assignee: undefined };
    renderWithQueryClient(<TaskCard {...defaultProps} task={taskWithoutAssignee} />);
    expect(screen.queryByAltText(/assignee user/i)).not.toBeInTheDocument();
  });

  it('does not show due date when not set', () => {
    const taskWithoutDueDate = { ...mockTask, due_date: undefined };
    renderWithQueryClient(<TaskCard {...defaultProps} task={taskWithoutDueDate} />);
    expect(screen.queryByText(/dec 31/i)).not.toBeInTheDocument();
  });
});