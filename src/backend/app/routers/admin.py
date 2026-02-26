from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate, UserListResponse, UserRead, UserUpdate
from app.utils.access import require_developer
from app.utils.security import hash_password

router = APIRouter(prefix="/admin/users", tags=["admin"])


@router.get("", response_model=UserListResponse)
async def list_users(
    role: Optional[UserRole] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    filters: list = []
    if role is not None:
        filters.append(User.role == role)
    if is_active is not None:
        filters.append(User.is_active == is_active)

    total = (
        await db.execute(select(func.count()).select_from(User).where(*filters))
    ).scalar_one() if filters else (
        await db.execute(select(func.count()).select_from(User))
    ).scalar_one()

    query = select(User).order_by(User.user_id)
    if filters:
        query = query.where(*filters)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    users = result.scalars().all()

    return UserListResponse(
        users=[UserRead.model_validate(u) for u in users],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    existing = await db.execute(
        select(User).where(User.email == body.email.lower().strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        )

    password_hash = await run_in_threadpool(hash_password, body.password)

    user = User(
        name=body.name,
        email=body.email,
        password_hash=password_hash,
        role=body.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if "new_password" in update_data:
        raw_password = update_data.pop("new_password")
        user.password_hash = await run_in_threadpool(hash_password, raw_password)

    if "email" in update_data:
        dup = await db.execute(
            select(User).where(
                User.email == update_data["email"].lower().strip(),
                User.user_id != user_id,
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_developer),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user.is_active = False
    await db.commit()
