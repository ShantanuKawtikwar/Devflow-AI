from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
import uuid

from app.database.base import get_db
from app.core.deps import get_current_active_user, require_role
from app.models.user import User
from app.models.team import Team, TeamMember, TeamRole
from app.schemas.team import TeamCreate, TeamUpdate, TeamResponse, TeamWithMembers, TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse

router = APIRouter(prefix="/teams", tags=["teams"])


@router.post("", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if slug exists
    result = await db.execute(select(Team).where(Team.slug == team_data.slug))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Team slug already exists")

    team = Team(**team_data.model_dump())
    db.add(team)
    await db.flush()

    # Add creator as owner
    member = TeamMember(team_id=team.id, user_id=current_user.id, role=TeamRole.OWNER)
    db.add(member)
    await db.commit()
    await db.refresh(team)

    return team


@router.get("", response_model=List[TeamResponse])
async def list_teams(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Team)
        .join(TeamMember, Team.id == TeamMember.team_id)
        .where(TeamMember.user_id == current_user.id, Team.is_active == True)
    )
    teams = result.scalars().all()
    return teams


@router.get("/{team_id}", response_model=TeamWithMembers)
async def get_team(
    team_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Team)
        .options(selectinload(Team.members).selectinload(TeamMember.user))
        .where(Team.id == team_id)
    )
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check membership
    member_result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == current_user.id)
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this team")

    return team


@router.put("/{team_id}", response_model=TeamResponse)
async def update_team(
    team_id: uuid.UUID,
    team_update: TeamUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check if user is owner or admin
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to update this team")

    if team_update.slug and team_update.slug != team.slug:
        slug_result = await db.execute(select(Team).where(Team.slug == team_update.slug))
        if slug_result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Team slug already exists")

    update_data = team_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(team, field, value)

    await db.commit()
    await db.refresh(team)
    return team


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check if user is owner
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id,
            TeamMember.role == TeamRole.OWNER
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only owner can delete team")

    await db.delete(team)
    await db.commit()


# Team Members
@router.post("/{team_id}/members", response_model=TeamMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_team_member(
    team_id: uuid.UUID,
    member_data: TeamMemberCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check if user is owner or admin
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to add members")

    # Check if user exists
    user_result = await db.execute(select(User).where(User.id == member_data.user_id))
    if not user_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already a member
    existing = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == member_data.user_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User is already a member")

    member = TeamMember(**member_data.model_dump(), team_id=team_id)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.get("/{team_id}/members", response_model=List[TeamMemberResponse])
async def list_team_members(
    team_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Team)
        .join(TeamMember, Team.id == TeamMember.team_id)
        .where(Team.id == team_id, TeamMember.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a member of this team")

    result = await db.execute(
        select(TeamMember)
        .options(selectinload(TeamMember.user))
        .where(TeamMember.team_id == team_id)
    )
    return result.scalars().all()


@router.put("/{team_id}/members/{user_id}", response_model=TeamMemberResponse)
async def update_team_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    member_update: TeamMemberUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check if user is owner or admin
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
        )
    )
    if not member_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not authorized to update members")

    result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Can't change owner role
    if member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot change owner role")

    if member_update.role:
        member.role = member_update.role

    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{team_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_team_member(
    team_id: uuid.UUID,
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Team).where(Team.id == team_id))
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Check if user is owner or admin, or removing themselves
    member_result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == current_user.id,
            TeamMember.role.in_([TeamRole.OWNER, TeamRole.ADMIN])
        )
    )
    is_admin = member_result.scalar_one_or_none()

    if not is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to remove this member")

    result = await db.execute(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Can't remove owner
    if member.role == TeamRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove team owner")

    await db.delete(member)
    await db.commit()