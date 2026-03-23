from typing import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.enums import UserRole
from app.models.account_book import AccountBook
from app.models.account_book_member import AccountBookMember
from app.models.document import Document
from app.models.job import Job
from app.models.receipt import Receipt
from app.models.statement import BankStatement, BankStatementLine
from app.models.user import User
from app.utils.auth import get_current_user

# ---------------------------------------------------------------------------
# Global role guards (RBAC)
# ---------------------------------------------------------------------------


def require_roles(*allowed: UserRole) -> Callable:
    async def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return _check


require_developer = require_roles(UserRole.developer)
require_admin_or_dev = require_roles(UserRole.admin, UserRole.developer)
require_any = require_roles(UserRole.admin, UserRole.developer, UserRole.viewer)

# ---------------------------------------------------------------------------
# Account-book-level helpers
# ---------------------------------------------------------------------------


async def get_accessible_account_ids(user: User, db: AsyncSession) -> list[int]:
    """Return account_ids the user can access.

    Developers have implicit access to every account book.
    Admin/viewer access is determined by AccountBookMember rows.
    """
    if user.role == UserRole.developer:
        result = await db.execute(
            select(AccountBook.account_id).where(AccountBook.deleted_at.is_(None))
        )
        return list(result.scalars().all())

    result = await db.execute(
        select(AccountBookMember.account_id)
        .join(AccountBook, AccountBook.account_id == AccountBookMember.account_id)
        .where(
            AccountBookMember.user_id == user.user_id,
            AccountBook.deleted_at.is_(None),
        )
    )
    return list(result.scalars().all())


async def require_account_access(
    account_id: int,
    user: User,
    db: AsyncSession,
    *,
    write: bool = False,
) -> AccountBook:
    """Fetch an account book and verify the user has access.

    Raises 404 if the book doesn't exist and 403 if the user lacks permission.
    When *write=True*, app-level read-only users (:class:`UserRole.viewer`) are
    rejected via the same rule as document/receipt/statement writes.
    """
    account = await db.get(AccountBook, account_id)
    if not account or account.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account book not found",
        )

    if user.role == UserRole.developer:
        return account

    membership = await db.execute(
        select(AccountBookMember).where(
            AccountBookMember.account_id == account_id,
            AccountBookMember.user_id == user.user_id,
        )
    )
    member = membership.scalar_one_or_none()

    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this account book",
        )

    if write:
        _assert_can_write(user)

    return account


# ---------------------------------------------------------------------------
# Shared low-level checks
# ---------------------------------------------------------------------------


async def _user_can_access_document(
    doc: Document, user: User, db: AsyncSession
) -> bool:
    """Check whether the user may *read* this document.

    Access is granted when any of the following is true:
    - The user is a developer (implicit full access).
    - The user uploaded the document.
    - The document belongs to an account book the user is a member of.
    """
    if user.role == UserRole.developer:
        return True

    if doc.uploaded_by == user.user_id:
        return True

    if doc.account_id is not None:
        result = await db.execute(
            select(AccountBookMember.id).where(
                AccountBookMember.account_id == doc.account_id,
                AccountBookMember.user_id == user.user_id,
            )
        )
        if result.scalar_one_or_none() is not None:
            return True

    return False


def _assert_can_write(user: User) -> None:
    """Viewers are never allowed to mutate data."""
    if user.role == UserRole.viewer:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewers have read-only access",
        )


def apply_document_access_filter(filters: list, user: User) -> list:
    """Append the appropriate access-control predicate to *filters* for list queries
    that join against the ``documents`` table.

    Developers implicitly see every document.  All other roles are restricted to
    documents they uploaded themselves or that belong to an account book they are
    a member of.

    Returns the (mutated) *filters* list for convenient chaining.
    """
    if user.role != UserRole.developer:
        member_account_ids = (
            select(AccountBookMember.account_id)
            .where(AccountBookMember.user_id == user.user_id)
            .correlate(None)
            .scalar_subquery()
        )
        filters.append(
            or_(
                Document.uploaded_by == user.user_id,
                Document.account_id.in_(member_account_ids),
            )
        )
    return filters


def can_view_job(job: Job, user: User) -> bool:
    """Return True when *user* is allowed to read *job*.

    Developers can view any job; all other roles may only view jobs they created.
    """
    if user.role == UserRole.developer:
        return True
    return job.created_by == user.user_id


# ---------------------------------------------------------------------------
# Resource-level helpers (document / receipt / statement)
# ---------------------------------------------------------------------------


async def get_owned_document(
    document_id: int, user: User, db: AsyncSession, *, write: bool = False
) -> Document:
    doc = await db.get(Document, document_id)
    if not doc or doc.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Document not found")

    if not await _user_can_access_document(doc, user, db):
        raise HTTPException(
            status_code=403, detail="Not authorized to access this document"
        )

    if write:
        _assert_can_write(user)

    return doc


async def get_owned_receipt(
    receipt_id: int, user: User, db: AsyncSession, *, write: bool = False
) -> Receipt:
    stmt = (
        select(Receipt)
        .join(Document, Document.receipt_id == Receipt.receipt_id)
        .where(
            Receipt.receipt_id == receipt_id,
            Document.deleted_at.is_(None),
        )
        .options(joinedload(Receipt.document))
    )
    result = await db.execute(stmt)
    receipt = result.unique().scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    if receipt.document and not await _user_can_access_document(
        receipt.document, user, db
    ):
        raise HTTPException(status_code=404, detail="Receipt not found")

    if write:
        _assert_can_write(user)

    return receipt


async def get_owned_statement(
    statement_id: int, user: User, db: AsyncSession, *, write: bool = False
) -> BankStatement:
    stmt = (
        select(BankStatement)
        .join(Document, Document.statement_id == BankStatement.statement_id)
        .where(
            BankStatement.statement_id == statement_id,
            Document.deleted_at.is_(None),
        )
        .options(
            joinedload(BankStatement.document),
            joinedload(BankStatement.lines),
        )
    )
    result = await db.execute(stmt)
    statement = result.unique().scalar_one_or_none()
    if not statement:
        raise HTTPException(status_code=404, detail="Bank statement not found")

    if statement.document and not await _user_can_access_document(
        statement.document, user, db
    ):
        raise HTTPException(status_code=404, detail="Bank statement not found")

    if write:
        _assert_can_write(user)

    return statement


async def get_owned_statement_line(
    statement_id: int,
    line_id: int,
    user: User,
    db: AsyncSession,
    *,
    write: bool = False,
) -> BankStatementLine:
    stmt = (
        select(BankStatementLine)
        .join(
            BankStatement,
            BankStatementLine.statement_id == BankStatement.statement_id,
        )
        .join(Document, Document.statement_id == BankStatement.statement_id)
        .where(
            BankStatementLine.line_id == line_id,
            BankStatementLine.statement_id == statement_id,
            Document.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")

    doc_result = await db.execute(
        select(Document).where(
            Document.statement_id == statement_id,
            Document.deleted_at.is_(None),
        )
    )
    doc = doc_result.scalar_one_or_none()
    if not doc or not await _user_can_access_document(doc, user, db):
        raise HTTPException(status_code=404, detail="Statement line not found")

    if write:
        _assert_can_write(user)

    return line
