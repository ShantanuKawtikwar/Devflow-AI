from app.api.v1 import auth, teams, projects, tasks, sprints, github, ai, notifications, analytics
from fastapi import APIRouter

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(teams.router, prefix="/teams", tags=["teams"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(sprints.router, prefix="/sprints", tags=["sprints"])
api_router.include_router(github.router, prefix="/github", tags=["github"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])