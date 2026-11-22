import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Projects } from './Projects';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Mock the API
vi.mock('../../services/api', () => ({
  projectsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { projectsApi } from '../../services/api';

const mockProjects = [
  {
    id: '1',
    name: 'Project One',
    key: 'P1',
    description: 'First project',
    status: 'active',
    priority: 'high',
    task_count: 10,
    completed_task_count: 5,
    members: [{ id: '1', username: 'user1' }],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Project Two',
    key: 'P2',
    description: 'Second project',
    status: 'planning',
    priority: 'medium',
    task_count: 5,
    completed_task_count: 0,
    members: [],
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Projects Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (projectsApi.list as vi.Mock).mockResolvedValue(mockProjects);
    (projectsApi.create as vi.Mock).mockResolvedValue({ ...mockProjects[0], id: '3' });
    (projectsApi.update as vi.Mock).mockResolvedValue(mockProjects[0]);
    (projectsApi.delete as vi.Mock).mockResolvedValue({ message: 'Project deleted' });
  });

  it('renders projects list', async () => {
    renderWithProviders(<Projects />);

    await waitFor(() => {
      expect(screen.getByText(/project one/i)).toBeInTheDocument();
      expect(screen.getByText(/project two/i)).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    (projectsApi.list as vi.Mock).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<Projects />);

    expect(screen.getByText(/projects/i)).toBeInTheDocument();
  });

  it('shows empty state when no projects', async () => {
    (projectsApi.list as vi.Mock).mockResolvedValue([]);

    renderWithProviders(<Projects />);

    await waitFor(() => {
      expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
    });
  });

  it('opens create modal when clicking new project', async () => {
    renderWithProviders(<Projects />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new project/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /new project/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/create project/i)).toBeInTheDocument();
    });
  });

  it('filters projects by search query', async () => {
    renderWithProviders(<Projects />);

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/search projects/i);
      fireEvent.change(searchInput, { target: { value: 'Project One' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/project one/i)).toBeInTheDocument();
      expect(screen.queryByText(/project two/i)).not.toBeInTheDocument();
    });
  });

  it('filters projects by status', async () => {
    renderWithProviders(<Projects />);

    await waitFor(() => {
      const statusSelect = screen.getByRole('combobox');
      fireEvent.change(statusSelect, { target: { value: 'active' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/project one/i)).toBeInTheDocument();
      expect(screen.queryByText(/project two/i)).not.toBeInTheDocument();
    });
  });

  it('validates project form', async () => {
    renderWithProviders(<Projects />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /new project/i }));
    });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/key must be at least 2 characters/i)).toBeInTheDocument();
    });
  });

  it('creates project successfully', async () => {
    renderWithProviders(<Projects />);

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /new project/i }));
    });

    await waitFor(() => {
      fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'New Project' } });
      fireEvent.change(screen.getByLabelText(/key/i), { target: { value: 'NP' } });
      fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    });

    await waitFor(() => {
      expect(projectsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Project', key: 'NP' })
      );
    });
  });
});