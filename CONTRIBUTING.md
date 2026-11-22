# Contributing to DevFlow AI

Thank you for your interest in contributing to DevFlow AI! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)
- [Security](#security)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please be respectful and inclusive in all interactions.

## Getting Started

### Prerequisites

- Git
- Docker and Docker Compose
- Node.js 20+
- Python 3.13+
- A GitHub account

### Setting Up Your Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/devflow-ai.git
   cd devflow-ai
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/devflow-ai.git
   ```
4. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```
5. **Start development services**:
   ```bash
   docker-compose up -d postgres redis
   ```
6. **Run backend migrations**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   alembic upgrade head
   ```
7. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:

| Prefix | Purpose |
|--------|---------|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `refactor/` | Code refactoring |
| `test/` | Test additions/updates |
| `chore/` | Maintenance tasks |

Examples:
- `feature/add-sprint-analytics`
- `fix/kanban-drag-drop-issue`
- `docs/update-api-documentation`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(kanban): add drag-and-drop reordering
fix(auth): resolve token refresh race condition
docs(api): update endpoint documentation
test(tasks): add unit tests for task service
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

## Coding Standards

### Backend (Python)

- **Formatter**: Black (line length 100)
- **Linter**: Ruff
- **Type Checking**: mypy (strict mode)
- **Imports**: isort

Run checks:
```bash
cd backend
black .
ruff check .
mypy app/
isort .
```

Or use pre-commit:
```bash
pre-commit install
pre-commit run --all-files
```

### Frontend (TypeScript/React)

- **Formatter**: Prettier
- **Linter**: ESLint
- **Type Checking**: TypeScript strict mode

Run checks:
```bash
cd frontend
npm run lint
npm run type-check
npm run format
```

### General Guidelines

1. **Write self-documenting code** - Clear variable/function names over comments
2. **Keep functions small** - Single responsibility principle
3. **Handle errors gracefully** - Never let exceptions bubble up unhandled
4. **Write tests** - New features require tests
5. **Update documentation** - Keep docs in sync with code
6. **No hardcoded secrets** - Use environment variables
7. **Accessibility** - Follow WCAG guidelines for UI

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v

# Run with specific marker
pytest -m "not integration"
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test file
npm run test -- src/components/common/Button.test.tsx
```

### Writing Tests

- **Unit tests** for business logic
- **Integration tests** for API endpoints
- **Component tests** for React components
- **E2E tests** for critical user flows (future)

Test naming: `describe('ComponentName', () => { it('should do something', () => { }) })`

## Pull Request Process

### Before Submitting

1. **Run all tests** - Ensure everything passes
2. **Run linters** - Fix any style issues
3. **Update documentation** - If APIs or features changed
4. **Add tests** - For new functionality
5. **Check for breaking changes** - Document in PR description

### PR Requirements

- [ ] All CI checks pass
- [ ] Tests added/updated for changes
- [ ] Documentation updated
- [ ] No console.log or debug code
- [ ] No TODO/FIXME comments (unless tracked in issues)
- [ ] Meaningful commit messages
- [ ] PR description explains the "why" and "what"

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing done

## Screenshots (if UI changes)
<!-- Add screenshots here -->

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added
```

### Review Process

1. **Automated checks** run on every PR
2. **Code review** by at least one maintainer
3. **Address feedback** - Make requested changes
4. **Approval** - Maintainer approves
5. **Merge** - Squash and merge to main

## Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Backend version: [e.g., 1.0.0]
- Frontend version: [e.g., 1.0.0]

## Additional Context
Screenshots, logs, etc.
```

### Feature Requests

Use the feature request template:

```markdown
## Feature Description
Clear description of the feature

## Problem Statement
What problem does this solve?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Mockups, references, etc.
```

## Security

### Reporting Security Vulnerabilities

**DO NOT** create public issues for security vulnerabilities. Instead:

1. Email security@devflow-ai.com
2. Include detailed description
3. Include steps to reproduce
4. Wait for acknowledgment before disclosing

### Security Best Practices

- Never commit secrets, API keys, or passwords
- Use environment variables for all configuration
- Encrypt sensitive data at rest
- Validate all user inputs
- Use parameterized queries
- Keep dependencies updated

## Release Process

1. **Version bump** - Update version in `pyproject.toml` and `package.json`
2. **Changelog** - Update `CHANGELOG.md`
3. **Tag** - Create git tag `v{X.Y.Z}`
4. **Build** - CI builds and publishes Docker images
5. **Deploy** - Deploy to staging, then production

## Getting Help

- **Documentation**: [Wiki](https://github.com/yourusername/devflow-ai/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/devflow-ai/discussions)
- **Discord**: [Join our community](https://discord.gg/devflow-ai)

## Recognition

Contributors are recognized in:
- `CONTRIBUTORS.md` file
- Release notes
- Project website

Thank you for contributing to DevFlow AI! 🚀