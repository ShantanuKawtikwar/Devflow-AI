# DevFlow AI

An intelligent developer productivity and project management platform combining features from Linear, Trello, Jira, and GitHub. Built with modern technologies for teams who want to ship faster.

## Features

### Project & Task Management
- **Kanban Boards** - Drag-and-drop task management with customizable columns
- **Sprints** - Plan, track, and analyze sprints with burndown charts
- **Tasks** - Rich task details with labels, assignees, due dates, comments, and checklists
- **Projects** - Organize work with projects, descriptions, and team visibility

### GitHub Integration
- **OAuth Authentication** - Secure GitHub connection with minimal permissions
- **Repository Sync** - Automatic sync of repos, branches, commits, PRs, and issues
- **Task Linking** - Link GitHub activity to tasks for automatic updates
- **Issue Import** - Import GitHub issues as tasks with one click

### AI-Powered Assistant
- **Task Generation** - Create tasks from natural language descriptions
- **Summarization** - Summarize sprint progress, project status, and team activity
- **Sprint Planning** - AI-suggested sprint plans based on backlog and velocity
- **Insights** - Actionable insights on team performance and bottlenecks
- **Chat Assistant** - Context-aware chat for questions about projects and tasks

### Analytics Dashboard
- **Velocity Charts** - Track team velocity over time
- **Burndown Charts** - Visualize sprint progress
- **Cycle Time** - Measure task completion speed
- **Team Performance** - Individual and team metrics

### Team Collaboration
- **Role-Based Access** - Owner, Admin, Member, Viewer roles
- **Team Management** - Invite members, manage permissions
- **Notifications** - Real-time notifications with email and in-app options
- **Activity Log** - Complete audit trail of all actions

## Tech Stack

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **SQLAlchemy 2.0** - Async ORM with PostgreSQL
- **Alembic** - Database migrations
- **Pydantic v2** - Data validation and serialization
- **JWT** - Secure authentication with bcrypt password hashing
- **Redis** - Caching and session storage

### Frontend
- **React 18** - Component-based UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **@dnd-kit** - Accessible drag-and-drop
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Recharts** - Composable charting library
- **React Hook Form + Zod** - Form handling and validation

### Infrastructure
- **Docker** - Multi-stage builds for production
- **Docker Compose** - Local development environment
- **PostgreSQL** - Primary database
- **Nginx** - Reverse proxy for frontend
- **GitHub Actions** - CI/CD pipeline

## Getting Started

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local frontend development)
- Python 3.13+ (for local backend development)
- GitHub OAuth App (for GitHub integration)

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/devflow-ai.git
cd devflow-ai

# Copy environment file and configure
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Local Development

#### Backend
```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp ../.env.example .env
# Edit .env with your configuration

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `SECRET_KEY` | JWT signing secret (32+ chars) | Yes |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID | For GitHub integration |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret | For GitHub integration |
| `OPENAI_API_KEY` | OpenAI API key for AI features | For AI features |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI features | For AI features |
| `CORS_ORIGINS` | Allowed CORS origins | Yes |

See `.env.example` for all available options.

## Project Structure

```
devflow-ai/
├── backend/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── core/          # Core configuration
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic
│   │   ├── repositories/  # Data access layer
│   │   ├── integrations/  # External integrations
│   │   ├── ai/            # AI services
│   │   └── database/      # Database configuration
│   ├── alembic/           # Database migrations
│   └── tests/             # Backend tests
├── frontend/
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── context/       # React context providers
│   │   ├── hooks/         # Custom hooks
│   │   ├── types/         # TypeScript types
│   │   └── utils/         # Utility functions
│   └── tests/             # Frontend tests
├── docker-compose.yml
└── README.md
```

## API Documentation

Once the backend is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Testing

### Backend Tests
```bash
cd backend
pytest                    # Run all tests
pytest -v                 # Verbose output
pytest --cov=app          # With coverage
pytest tests/test_auth.py # Run specific test file
```

### Frontend Tests
```bash
cd frontend
npm run test              # Run all tests
npm run test:ui           # With Vitest UI
npm run test:coverage     # With coverage
```

## Deployment

### Production with Docker Compose
```bash
# Build and start production services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Run migrations
docker-compose exec backend alembic upgrade head
```

### Manual Deployment
1. Build frontend: `cd frontend && npm run build`
2. Build backend Docker image: `docker build -t devflow-backend ./backend`
3. Build frontend Docker image: `docker build -t devflow-frontend ./frontend`
4. Deploy with your preferred orchestration tool (Kubernetes, ECS, etc.)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Inspired by Linear, Trello, Jira, and GitHub
- Built with amazing open-source libraries
- Icons from Lucide React
- Charts from Recharts

## Support

- **Documentation**: [Wiki](https://github.com/yourusername/devflow-ai/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/devflow-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/devflow-ai/discussions)

---

Built with ❤️ for developers who want to ship faster.