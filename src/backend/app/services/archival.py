"""
Statement archival service.

Identifies statements that have exceeded their account book's retention
period and archives them: sets status to ``archived``, records the
timestamp, and purges associated S3 objects (statement PDF + receipt files).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.enums import StatementStatus
from app.models.account_book import AccountBook
from app.models.document import Document
from app.models.receipt import Receipt
from app.models.statement import BankStatement
from app.services.aws_services import AWSService

logger = logging.getLogger(__name__)


@dataclass
class ArchivalReport:
    """Summary returned after an archival run."""

    statements_archived: int = 0
    s3_objects_deleted: int = 0
    s3_delete_errors: int = 0
    errors: list[str] = field(default_factory=list)


def _statement_expiry_date(statement: BankStatement, archive_after_months: int) -> date:
    """Return the date on which *statement* becomes eligible for archival.

    The reference point is the first day of the month **after** the
    statement's billing period.  For example, a January 2025 statement
    (month=1, year=2025) with ``archive_after_months=18`` expires on
    2026-08-01.
    """
    ref_month = statement.month + 1
    ref_year = statement.year
    if ref_month > 12:
        ref_month = 1
        ref_year += 1

    total_months = ref_year * 12 + (ref_month - 1) + archive_after_months
    expiry_year, expiry_month = divmod(total_months, 12)
    expiry_month += 1
    if expiry_month > 12:
        expiry_month = 1
        expiry_year += 1

    return date(expiry_year, expiry_month, 1)


async def get_archivable_statements(db: AsyncSession) -> list[BankStatement]:
    """Return active statements whose retention period has elapsed."""
    today = date.today()

    stmt = (
        select(BankStatement)
        .join(AccountBook, BankStatement.account_id == AccountBook.account_id)
        .where(
            BankStatement.status == StatementStatus.active,
            AccountBook.deleted_at.is_(None),
        )
        .options(
            joinedload(BankStatement.document),
            joinedload(BankStatement.account),
        )
    )
    result = await db.execute(stmt)
    candidates = result.unique().scalars().all()

    eligible: list[BankStatement] = []
    for s in candidates:
        archive_months = s.account.archive_after_months
        if _statement_expiry_date(s, archive_months) <= today:
            eligible.append(s)

    return eligible


async def _collect_s3_keys(
    statement: BankStatement, db: AsyncSession
) -> list[str]:
    """Gather all S3 keys associated with *statement* (its own doc + receipt docs)."""
    keys: list[str] = []

    if statement.document and statement.document.s3_key:
        keys.append(statement.document.s3_key)

    receipt_docs_result = await db.execute(
        select(Document)
        .join(Receipt, Document.receipt_id == Receipt.receipt_id)
        .where(
            Receipt.statement_id == statement.statement_id,
            Document.deleted_at.is_(None),
        )
    )
    for doc in receipt_docs_result.scalars().all():
        if doc.s3_key:
            keys.append(doc.s3_key)

    return keys


async def _purge_s3_objects(
    keys: Sequence[str], aws_service: AWSService
) -> tuple[int, int]:
    """Delete S3 objects. Returns (deleted_count, error_count)."""
    deleted = 0
    errors = 0
    for key in keys:
        try:
            await aws_service.async_delete_s3_object(key)
            deleted += 1
            logger.info("Purged S3 object: %s", key)
        except Exception:
            errors += 1
            logger.warning("Failed to delete S3 object: %s", key, exc_info=True)
    return deleted, errors


async def archive_statement(
    statement: BankStatement,
    db: AsyncSession,
    aws_service: AWSService,
) -> tuple[int, int]:
    """Archive a single statement and purge its S3 objects.

    Returns ``(s3_deleted, s3_errors)``.
    """
    s3_keys = await _collect_s3_keys(statement, db)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    statement.status = StatementStatus.archived
    statement.archived_at = now

    deleted, errors = await _purge_s3_objects(s3_keys, aws_service)

    logger.info(
        "Archived statement %d (account %d, %d/%d): purged %d S3 objects (%d errors)",
        statement.statement_id,
        statement.account_id,
        statement.month,
        statement.year,
        deleted,
        errors,
    )
    return deleted, errors


async def archive_eligible_statements(
    db: AsyncSession,
    aws_service: AWSService,
    *,
    dry_run: bool = False,
) -> ArchivalReport:
    """Find and archive all statements past their retention period.

    Each statement is committed individually for fault isolation.
    When *dry_run* is ``True`` no changes are persisted and no S3 objects
    are deleted.
    """
    report = ArchivalReport()

    eligible = await get_archivable_statements(db)
    logger.info(
        "Archival run: %d statement(s) eligible%s",
        len(eligible),
        " (dry run)" if dry_run else "",
    )

    for statement in eligible:
        if dry_run:
            s3_keys = await _collect_s3_keys(statement, db)
            logger.info(
                "[DRY RUN] Would archive statement %d (account %d, %d/%d) "
                "and purge %d S3 object(s)",
                statement.statement_id,
                statement.account_id,
                statement.month,
                statement.year,
                len(s3_keys),
            )
            report.statements_archived += 1
            report.s3_objects_deleted += len(s3_keys)
            continue

        try:
            deleted, errors = await archive_statement(statement, db, aws_service)
            await db.commit()
            report.statements_archived += 1
            report.s3_objects_deleted += deleted
            report.s3_delete_errors += errors
        except Exception as exc:
            await db.rollback()
            msg = f"Failed to archive statement {statement.statement_id}: {exc}"
            logger.error(msg, exc_info=True)
            report.errors.append(msg)

    return report
