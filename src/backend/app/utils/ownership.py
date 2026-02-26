from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.document import Document
from app.models.receipt import Receipt
from app.models.statement import BankStatement, BankStatementLine
from app.models.user import User


async def get_owned_receipt(receipt_id: int, user: User, db: AsyncSession) -> Receipt:
    stmt = (
        select(Receipt)
        .join(Document, Document.receipt_id == Receipt.receipt_id)
        .where(
            Receipt.receipt_id == receipt_id,
            Document.uploaded_by == user.user_id,
            Document.deleted_at.is_(None),
        )
        .options(joinedload(Receipt.document))
    )
    result = await db.execute(stmt)
    receipt = result.unique().scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt


async def get_owned_statement(
    statement_id: int, user: User, db: AsyncSession
) -> BankStatement:
    stmt = (
        select(BankStatement)
        .join(Document, Document.statement_id == BankStatement.statement_id)
        .where(
            BankStatement.statement_id == statement_id,
            Document.uploaded_by == user.user_id,
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
    return statement


async def get_owned_statement_line(
    statement_id: int, line_id: int, user: User, db: AsyncSession
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
            Document.uploaded_by == user.user_id,
            Document.deleted_at.is_(None),
        )
    )
    result = await db.execute(stmt)
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")
    return line
