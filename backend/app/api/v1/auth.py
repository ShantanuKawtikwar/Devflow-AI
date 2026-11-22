from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta

from app.database.base import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_token_response
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, UserUpdate, UserPasswordUpdate
from app.core.deps import get_current_active_user

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register", response_model=dict)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(
        (User.email == user_data.email) | (User.username == user_data.username)
    ))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email or username already registered")

    # Create user
    hashed_password = get_password_hash(user_data.password)
    user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        bio=user_data.bio,
        hashed_password=hashed_password,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return create_token_response(str(user.id), user.email)


@router.post("/login", response_model=dict)
async def login(email: str, password: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    user.last_login = datetime.utcnow()
    await db.commit()

    return create_token_response(str(user.id), user.email)


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    # Check for unique constraints
    if user_update.email and user_update.email != current_user.email:
        result = await db.execute(select(User).where(User.email == user_update.email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        current_user.email = user_update.email

    if user_update.username and user_update.username != current_user.username:
        result = await db.execute(select(User).where(User.username == user_update.username))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = user_update.username

    if user_update.full_name is not None:
        current_user.full_name = user_update.full_name
    if user_update.bio is not None:
        current_user.bio = user_update.bio
    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.put("/me/password")
async def update_password(
    password_data: UserPasswordUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    current_user.hashed_password = get_password_hash(password_data.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}


@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}