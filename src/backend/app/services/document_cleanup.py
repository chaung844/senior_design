from __future__ import annotations

from collections.abc import Sequence
from typing import List

from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import MatchStatus
from app.models.document import Document
from app.models.receipt import Receipt
from app.models.reconciliation import ReconciliationMatch
from app.models.statement import BankStatementLine
from app.services.aws_services import AWSService


async def cleanup_receipt_document(doc: Document, db: AsyncSession) -> None:
    if doc.receipt_id is None:
        return

    matches_result = await db.execute(
        select(ReconciliationMatch).where(
            ReconciliationMatch.receipt_id == doc.receipt_id
        )
    )
    matches = matches_result.scalars().all()

    affected_line_ids = {m.line_id for m in matches}

    for match in matches:
        await db.delete(match)

    await db.flush()

    for line_id in affected_line_ids:
        remaining = (
            await db.execute(
                select(func.count())
                .select_from(ReconciliationMatch)
                .where(ReconciliationMatch.line_id == line_id)
            )
        ).scalar_one()
        if remaining == 0:
            line = await db.get(BankStatementLine, line_id)
            if line:
                line.match_status = MatchStatus.unmatched


async def cleanup_bank_statement_document(
    doc: Document, db: AsyncSession
) -> List[Document]:
    if doc.statement_id is None:
        return []

    lines_result = await db.execute(
        select(BankStatementLine).where(
            BankStatementLine.statement_id == doc.statement_id
        )
    )
    lines = lines_result.scalars().all()

    line_ids = [line.line_id for line in lines]
    affected_receipt_ids: set[int] = set()

    if line_ids:
        matches_result = await db.execute(
            select(ReconciliationMatch).where(
                ReconciliationMatch.line_id.in_(line_ids)
            )
        )
        matches = matches_result.scalars().all()
        affected_receipt_ids = {m.receipt_id for m in matches}

        for match in matches:
            await db.delete(match)

        await db.flush()

    for line in lines:
        line.match_status = MatchStatus.unmatched

    for receipt_id in affected_receipt_ids:
        remaining = (
            await db.execute(
                select(func.count())
                .select_from(ReconciliationMatch)
                .where(ReconciliationMatch.receipt_id == receipt_id)
            )
        ).scalar_one()
        if remaining == 0:
            receipt = await db.get(Receipt, receipt_id)
            if receipt:
                receipt.match_status = MatchStatus.unmatched

    receipt_docs_result = await db.execute(
        select(Document)
        .join(Receipt, Document.receipt_id == Receipt.receipt_id)
        .where(
            Receipt.statement_id == doc.statement_id,
            Document.deleted_at.is_(None),
        )
    )
    receipt_docs = list(receipt_docs_result.scalars().all())
    for receipt_doc in receipt_docs:
        receipt_doc.soft_delete()

    return receipt_docs


async def soft_delete_documents_and_commit(
    docs: List[Document], db: AsyncSession
) -> None:
    for doc in docs:
        doc.soft_delete()
    await db.commit()


def schedule_s3_deletes(
    background_tasks: BackgroundTasks,
    aws_service: AWSService,
    docs: Sequence[Document],
) -> None:
    for doc in docs:
        background_tasks.add_task(aws_service.async_delete_s3_object, doc.s3_key)

