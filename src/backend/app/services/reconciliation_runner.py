"""
Core reconciliation runner extracted from the HTTP router so it can be called
from both the FastAPI endpoint (legacy synchronous re-run) and the SQS worker.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.enums import JobStatus
from app.models.document import Document
from app.models.job import Job
from app.models.receipt import Receipt
from app.models.statement import BankStatement, BankStatementLine
from app.models.user import User
from app.services.reconciliation_analysis import analyze_and_store
from app.services.reconciliation_matching import (
    MatchConfig,
    _print_match_summary,
    apply_lines_to_receipt,
    apply_perfect_matches,
    apply_receipts_to_line,
)

logger = logging.getLogger(__name__)


async def run_reconciliation(
    job: Job,
    account_id: int,
    statement_id: int | None,
    db: AsyncSession,
    user: User,
    config: MatchConfig | None = None,
) -> None:
    """Load lines & receipts scoped by account (and optionally statement), run
    the matching algorithm, generate AI analysis, and update job status.

    On success ``job.status`` is set to ``completed``.
    On failure ``job.status`` is set to ``failed`` and the exception is re-raised.
    The caller is responsible for committing the session.
    """
    match_config = config if config is not None else MatchConfig()

    try:
        job.status = JobStatus.reconciling
        await db.flush()

        lines_stmt = (
            select(BankStatementLine)
            .join(
                BankStatement,
                BankStatementLine.statement_id == BankStatement.statement_id,
            )
            .join(Document, Document.statement_id == BankStatement.statement_id)
            .where(
                BankStatement.account_id == account_id,
                Document.deleted_at.is_(None),
            )
            .options(selectinload(BankStatementLine.matches))
        )
        if statement_id is not None:
            lines_stmt = lines_stmt.where(
                BankStatementLine.statement_id == statement_id
            )

        lines_result = await db.execute(lines_stmt)
        lines = list(lines_result.unique().scalars().all())

        receipts_stmt = (
            select(Receipt)
            .join(Document, Document.receipt_id == Receipt.receipt_id)
            .where(
                Document.account_id == account_id,
                Document.deleted_at.is_(None),
            )
            .options(selectinload(Receipt.matches))
        )
        if statement_id is not None:
            receipts_stmt = receipts_stmt.where(Receipt.statement_id == statement_id)

        receipts_result = await db.execute(receipts_stmt)
        receipts = list(receipts_result.unique().scalars().all())

        await apply_perfect_matches(
            job=job,
            lines=lines,
            receipts=receipts,
            db=db,
            current_user=user,
            config=match_config,
        )

        await apply_lines_to_receipt(
            job=job,
            lines=lines,
            receipts=receipts,
            db=db,
            current_user=user,
            config=match_config,
        )

        await apply_receipts_to_line(
            job=job,
            lines=lines,
            receipts=receipts,
            db=db,
            current_user=user,
            config=match_config,
        )

        await db.flush()
        for line in lines:
            await db.refresh(line, ["matches"])
        _print_match_summary(lines, receipts, config=match_config)

        await analyze_and_store(
            job=job,
            lines=lines,
            receipts=receipts,
            db=db,
            config=match_config,
            statement_id=statement_id,
        )

        job.status = JobStatus.completed
    except Exception:
        job.status = JobStatus.failed
        raise
