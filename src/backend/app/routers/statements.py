from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.database import get_db
from app.enums import MatchStatus, UserRole
from app.models.account_book_member import AccountBookMember
from app.models.document import Document
from app.models.statement import BankStatement, BankStatementLine
from app.models.user import User
from app.schemas.bank_statement import (
    BankStatementDetailRead,
    BankStatementListResponse,
    BankStatementRead,
)
from app.schemas.bank_statement_line import (
    BankStatementLineListResponse,
    BankStatementLineRead,
    BankStatementLineUpdate,
)
from app.schemas.document import FileUrlResponse
from app.services.aws_services import AWSService
from app.utils.access import get_owned_statement, get_owned_statement_line
from app.utils.auth import get_current_user, verify_csrf_token

router = APIRouter(prefix="/statements", tags=["statements"])

aws_service = AWSService()


def _statement_to_read(stmt: BankStatement) -> BankStatementRead:
    doc = stmt.document
    return BankStatementRead(
        statement_id=stmt.statement_id,
        account_id=stmt.account_id,
        month=stmt.month,
        year=stmt.year,
        account_number_last4=stmt.account_number_last4,
        total_amount=stmt.total_amount,
        currency=stmt.currency,
        created_at=stmt.created_at,
        document_id=doc.document_id if doc else None,
        file_name=doc.file_name if doc else None,
        line_count=len(stmt.lines) if stmt.lines else 0,
    )


def _statement_to_detail(stmt: BankStatement) -> BankStatementDetailRead:
    doc = stmt.document
    return BankStatementDetailRead(
        statement_id=stmt.statement_id,
        account_id=stmt.account_id,
        month=stmt.month,
        year=stmt.year,
        account_number_last4=stmt.account_number_last4,
        total_amount=stmt.total_amount,
        currency=stmt.currency,
        created_at=stmt.created_at,
        document_id=doc.document_id if doc else None,
        file_name=doc.file_name if doc else None,
        line_count=len(stmt.lines) if stmt.lines else 0,
        lines=[
            BankStatementLineRead.model_validate(line)
            for line in sorted(stmt.lines, key=lambda l: l.line_number)
        ]
        if stmt.lines
        else [],
    )


@router.get("", response_model=BankStatementListResponse)
async def list_statements(
    account_id: Optional[int] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_filter = [Document.deleted_at.is_(None)]

    if current_user.role == UserRole.developer:
        pass
    else:
        member_account_ids = (
            select(AccountBookMember.account_id)
            .where(AccountBookMember.user_id == current_user.user_id)
            .correlate(None)
            .scalar_subquery()
        )
        base_filter.append(
            or_(
                Document.uploaded_by == current_user.user_id,
                Document.account_id.in_(member_account_ids),
            )
        )

    if account_id is not None:
        base_filter.append(Document.account_id == account_id)

    count_stmt = (
        select(func.count())
        .select_from(BankStatement)
        .join(Document, Document.statement_id == BankStatement.statement_id)
        .where(*base_filter)
    )
    total = (await db.execute(count_stmt)).scalar_one()

    rows_stmt = (
        select(BankStatement)
        .join(Document, Document.statement_id == BankStatement.statement_id)
        .where(*base_filter)
        .options(
            joinedload(BankStatement.document),
            selectinload(BankStatement.lines),
        )
        .order_by(BankStatement.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(rows_stmt)
    statements = result.unique().scalars().all()

    return BankStatementListResponse(
        statements=[_statement_to_read(s) for s in statements],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{statement_id}", response_model=BankStatementDetailRead)
async def get_statement(
    statement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = await get_owned_statement(statement_id, current_user, db)
    return _statement_to_detail(statement)


@router.get("/{statement_id}/lines", response_model=BankStatementLineListResponse)
async def list_statement_lines(
    statement_id: int,
    match_status: Optional[MatchStatus] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await get_owned_statement(statement_id, current_user, db)

    line_filter = (BankStatementLine.statement_id == statement_id,)
    if match_status is not None:
        line_filter = (*line_filter, BankStatementLine.match_status == match_status)

    count_stmt = select(func.count()).select_from(BankStatementLine).where(*line_filter)
    total = (await db.execute(count_stmt)).scalar_one()

    rows_stmt = (
        select(BankStatementLine)
        .where(*line_filter)
        .order_by(BankStatementLine.line_number)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(rows_stmt)
    lines = result.scalars().all()

    return BankStatementLineListResponse(
        lines=[BankStatementLineRead.model_validate(line) for line in lines],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.patch(
    "/{statement_id}/lines/{line_id}",
    response_model=BankStatementLineRead,
    dependencies=[Depends(verify_csrf_token)],
)
async def update_statement_line(
    statement_id: int,
    line_id: int,
    body: BankStatementLineUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    line = await get_owned_statement_line(
        statement_id, line_id, current_user, db, write=True
    )

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field, value in update_data.items():
        setattr(line, field, value)

    await db.commit()
    await db.refresh(line)

    return BankStatementLineRead.model_validate(line)


@router.get("/{statement_id}/file-url", response_model=FileUrlResponse)
async def get_statement_file_url(
    statement_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = await get_owned_statement(statement_id, current_user, db)

    if not statement.document:
        raise HTTPException(
            status_code=404,
            detail="No document linked to this bank statement",
        )

    expires_in = 3600
    url = aws_service.generate_presigned_get_url(
        statement.document.s3_key, expires_in=expires_in
    )
    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate download URL")

    return FileUrlResponse(url=url, expires_in=expires_in)
