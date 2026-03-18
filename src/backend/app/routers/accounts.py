from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.enums import AccountBookRole, UserRole
from app.models.account_book import AccountBook
from app.models.account_book_member import AccountBookMember
from app.models.user import User
from app.schemas.account_book import (
    AccountBookCreate,
    AccountBookListResponse,
    AccountBookRead,
    AccountBookUpdate,
    MemberAdd,
    MemberListResponse,
    MemberRead,
)
from app.schemas.user import UserRead
from app.utils.access import (
    apply_patch_fields,
    get_accessible_account_ids,
    require_account_access,
    require_admin_or_dev,
    require_any,
)
from app.utils.auth import verify_csrf_token

router = APIRouter(prefix="/accounts", tags=["accounts"])

_ACCOUNT_WRITABLE_FIELDS = {
    "bank_name",
    "account_name",
    "account_type",
    "currency",
    "account_number_last4",
}


# ── User lookup (for member management) ─────────────────────────────


@router.get("/members/lookup", response_model=UserRead)
async def lookup_user_by_email(
    email: str = Query(..., description="Exact email address to look up"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    result = await db.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=404, detail="No active user found with that email"
        )
    return user


def _account_to_read(account: AccountBook) -> AccountBookRead:
    return AccountBookRead(
        account_id=account.account_id,
        bank_name=account.bank_name,
        account_name=account.account_name,
        account_type=account.account_type,
        currency=account.currency,
        account_number_last4=account.account_number_last4,
        user_id=account.user_id,
        created_at=account.created_at,
        updated_at=account.updated_at,
        member_count=len(account.members) if account.members else 0,
    )


# ── Account Book CRUD ────────────────────────────────────────────────


@router.post(
    "",
    response_model=AccountBookRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf_token)],
)
async def create_account_book(
    body: AccountBookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    account = AccountBook(
        bank_name=body.bank_name,
        account_name=body.account_name,
        account_type=body.account_type,
        currency=body.currency,
        account_number_last4=body.account_number_last4,
        user_id=current_user.user_id,
    )
    db.add(account)
    await db.flush()

    owner_member = AccountBookMember(
        account_id=account.account_id,
        user_id=current_user.user_id,
        role=AccountBookRole.owner,
    )
    db.add(owner_member)
    await db.commit()
    await db.refresh(account, attribute_names=["members"])

    return _account_to_read(account)


@router.get("", response_model=AccountBookListResponse)
async def list_account_books(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any),
):
    accessible_ids = await get_accessible_account_ids(current_user, db)

    if not accessible_ids:
        return AccountBookListResponse(accounts=[], total=0, offset=offset, limit=limit)

    base_filter = (
        AccountBook.account_id.in_(accessible_ids),
        AccountBook.deleted_at.is_(None),
    )

    total = (
        await db.execute(
            select(func.count()).select_from(AccountBook).where(*base_filter)
        )
    ).scalar_one()

    query = (
        select(AccountBook)
        .where(*base_filter)
        .options(selectinload(AccountBook.members))
        .order_by(AccountBook.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    accounts = result.unique().scalars().all()

    return AccountBookListResponse(
        accounts=[_account_to_read(a) for a in accounts],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{account_id}", response_model=AccountBookRead)
async def get_account_book(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any),
):
    account = await require_account_access(account_id, current_user, db)
    await db.refresh(account, attribute_names=["members"])
    return _account_to_read(account)


@router.patch(
    "/{account_id}",
    response_model=AccountBookRead,
    dependencies=[Depends(verify_csrf_token)],
)
async def update_account_book(
    account_id: int,
    body: AccountBookUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    account = await require_account_access(account_id, current_user, db, write=True)

    update_data = body.model_dump(exclude_unset=True)
    apply_patch_fields(account, update_data, _ACCOUNT_WRITABLE_FIELDS)

    await db.commit()
    await db.refresh(account)
    return _account_to_read(account)


@router.delete(
    "/{account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf_token)],
)
async def delete_account_book(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    account = await require_account_access(account_id, current_user, db, write=True)
    account.soft_delete()
    await db.commit()
    return Response(status_code=204)


# ── Account Book Members ─────────────────────────────────────────────


@router.get("/{account_id}/members", response_model=MemberListResponse)
async def list_members(
    account_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    await require_account_access(account_id, current_user, db)

    query = (
        select(AccountBookMember)
        .where(AccountBookMember.account_id == account_id)
        .options(selectinload(AccountBookMember.user))
        .order_by(AccountBookMember.created_at)
    )
    result = await db.execute(query)
    members = result.unique().scalars().all()

    return MemberListResponse(
        members=[
            MemberRead(
                id=m.id,
                account_id=m.account_id,
                user_id=m.user_id,
                user_name=m.user.name,
                user_email=m.user.email,
                role=m.role,
                created_at=m.created_at,
            )
            for m in members
        ],
        total=len(members),
    )


@router.post(
    "/{account_id}/members",
    response_model=MemberRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf_token)],
)
async def add_member(
    account_id: int,
    body: MemberAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    await require_account_access(account_id, current_user, db, write=True)

    target_user = await db.get(User, body.user_id)
    if not target_user or not target_user.is_active:
        raise HTTPException(status_code=404, detail="User not found or inactive")

    if target_user.role == UserRole.developer:
        raise HTTPException(
            status_code=400,
            detail="Developers have implicit access; they cannot be added as members",
        )

    if current_user.role == UserRole.admin and target_user.role == UserRole.admin:
        raise HTTPException(
            status_code=403,
            detail="Admins cannot add other admins. Delegate to a developer.",
        )

    existing = await db.execute(
        select(AccountBookMember).where(
            AccountBookMember.account_id == account_id,
            AccountBookMember.user_id == body.user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this account book",
        )

    member = AccountBookMember(
        account_id=account_id,
        user_id=body.user_id,
        role=AccountBookRole.viewer,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return MemberRead(
        id=member.id,
        account_id=member.account_id,
        user_id=member.user_id,
        user_name=target_user.name,
        user_email=target_user.email,
        role=member.role,
        created_at=member.created_at,
    )


@router.delete(
    "/{account_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf_token)],
)
async def remove_member(
    account_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_dev),
):
    await require_account_access(account_id, current_user, db, write=True)

    result = await db.execute(
        select(AccountBookMember).where(
            AccountBookMember.account_id == account_id,
            AccountBookMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if member.role == AccountBookRole.owner:
        raise HTTPException(status_code=400, detail="Cannot remove the owner")

    await db.delete(member)
    await db.commit()
    return Response(status_code=204)
