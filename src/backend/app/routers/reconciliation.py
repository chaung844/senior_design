"""
Reconciliation API (Tier 4).

- POST /reconciliation/start: create a job + run reconciliation in one call (preferred).
      Body: { account_id: int, statement_id: int }
      Returns: job_id, status, summary.
- POST /reconciliation/jobs/{job_id}/run: re-trigger run on an existing job (legacy).
- GET /reconciliation/jobs/{job_id}/results: summary + matches (no separate GET matches/unmatched).
- Manual matching: POST/DELETE/PATCH /reconciliation/matches.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.database import get_db
from app.enums import JobStatus, JobType, MatchStatus
from app.models.document import Document
from app.models.job import Job
from app.models.receipt import Receipt
from app.models.reconciliation import ReconciliationMatch
from app.models.statement import BankStatement, BankStatementLine
from app.models.user import User
from app.schemas.reconciliation import (
    ManualMatchCreate,
    ManualMatchUpdate,
    MatchLineSummary,
    MatchReceiptSummary,
    ReconciliationMatchDetail,
    ReconciliationResultsResponse,
    ReconciliationRunRequest,
    ReconciliationRunResponse,
    ReconciliationStartRequest,
    ReconciliationStartResponse,
    ReconciliationSummary,
)
from app.utils.access import can_view_job, require_account_access
from app.utils.auth import get_current_user, verify_csrf_token

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])


def _can_modify_job(job: Job, user: User) -> bool:
    """Same as view for now; viewers cannot call run or manual match (enforced via _assert_can_write elsewhere)."""
    return can_view_job(job, user)


async def _get_reconciliation_job(
    job_id: int,
    db: AsyncSession,
    user: User,
) -> Job:
    job = await db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.job_type != JobType.reconciliation:
        raise HTTPException(
            status_code=400,
            detail="Job is not a reconciliation job",
        )
    if not can_view_job(job, user):
        raise HTTPException(status_code=403, detail="Not authorized to view this job")
    return job


# ---------------------------------------------------------------------------
# Internal helper: run the matching algorithm for a job
# ---------------------------------------------------------------------------


async def _run_matching(
    job: Job,
    account_id: int,
    statement_id: int | None,
    db: AsyncSession,
    current_user: User,
) -> None:
    """Load lines & receipts scoped by account (and optionally statement), run
    exact-match, persist results, and mark the job completed/failed."""

    try:
        job.status = JobStatus.reconciling
        await db.flush()

        # --- statement lines ---
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

        # --- receipts ---
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

        # Simple matching: exact amount + date (transaction_date vs billing_date)
        for line in lines:
            if line.match_status != MatchStatus.unmatched:
                continue
            for receipt in receipts:
                if receipt.match_status != MatchStatus.unmatched:
                    continue
                if (
                    line.charge == receipt.charged_amount
                    and line.transaction_date == receipt.billing_date
                ):
                    match = ReconciliationMatch(
                        job_id=job.job_id,
                        line_id=line.line_id,
                        receipt_id=receipt.receipt_id,
                        match_type=MatchStatus.perfect_matched,
                        created_by=current_user.user_id,
                    )
                    db.add(match)
                    line.match_status = MatchStatus.perfect_matched
                    receipt.match_status = MatchStatus.perfect_matched
                    break

        job.status = JobStatus.completed
    except Exception:
        job.status = JobStatus.failed
        raise


# ---------------------------------------------------------------------------
# POST /reconciliation/start  –  one-call entry point for the frontend
# ---------------------------------------------------------------------------


@router.post(
    "/start",
    response_model=ReconciliationStartResponse,
    status_code=201,
)
async def start_reconciliation(
    body: ReconciliationStartRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(verify_csrf_token),
):
    """
    Create a reconciliation job **and** run the matching algorithm in a single
    call.  The frontend only needs to supply ``account_id`` and, optionally,
    ``statement_id`` to scope the run to a single statement.

    Returns the created job id, its status, and a short summary of results.
    """
    account_id = body.account_id
    statement_id = body.statement_id

    await require_account_access(account_id, current_user, db, write=True)

    # Validate the statement belongs to this account (when provided)
    if statement_id is not None:
        stmt_check = await db.execute(
            select(BankStatement).where(
                BankStatement.statement_id == statement_id,
                BankStatement.account_id == account_id,
            )
        )
        if stmt_check.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=404,
                detail="Statement not found in this account",
            )

    # Create the job
    job_name = f"Reconciliation – account {account_id}"
    if statement_id is not None:
        job_name += f" / statement {statement_id}"

    job = Job(
        name=job_name,
        job_type=JobType.reconciliation,
        status=JobStatus.pending,
        created_by=current_user.user_id,
    )
    db.add(job)
    await db.flush()  # assigns job.job_id

    # Run matching
    await _run_matching(job, account_id, statement_id, db, current_user)
    await db.commit()
    await db.refresh(job)

    # Build a lightweight summary
    match_count_result = await db.execute(
        select(func.count())
        .select_from(ReconciliationMatch)
        .where(ReconciliationMatch.job_id == job.job_id)
    )
    matched = match_count_result.scalar() or 0

    # Total lines in scope
    total_lines_stmt = (
        select(func.count())
        .select_from(BankStatementLine)
        .join(
            BankStatement, BankStatementLine.statement_id == BankStatement.statement_id
        )
        .join(Document, Document.statement_id == BankStatement.statement_id)
        .where(
            BankStatement.account_id == account_id,
            Document.deleted_at.is_(None),
        )
    )
    if statement_id is not None:
        total_lines_stmt = total_lines_stmt.where(
            BankStatementLine.statement_id == statement_id
        )
    total_lines = (await db.execute(total_lines_stmt)).scalar() or 0

    return ReconciliationStartResponse(
        job_id=job.job_id,
        status=job.status.value,
        summary=ReconciliationSummary(
            total_lines=total_lines,
            matched=matched,
            unmatched=max(0, total_lines - matched),
            bundle_matched=0,
        ),
    )


# ---------------------------------------------------------------------------
# POST /reconciliation/jobs/{job_id}/run  –  legacy / re-run entry point
# ---------------------------------------------------------------------------


@router.post(
    "/jobs/{job_id}/run",
    response_model=ReconciliationRunResponse,
    status_code=202,
)
async def run_reconciliation(
    job_id: int,
    body: ReconciliationRunRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(verify_csrf_token),
):
    """
    Re-trigger the reconciliation algorithm for an existing job.
    Prefer POST /reconciliation/start for new runs.
    """
    job = await _get_reconciliation_job(job_id, db, current_user)
    if not _can_modify_job(job, user=current_user):
        raise HTTPException(status_code=403, detail="Not authorized to run this job")

    account_id = body.account_id
    if account_id is None:
        job.status = JobStatus.reconciling
        await db.commit()
        await db.refresh(job)
        return ReconciliationRunResponse(
            job_id=job.job_id,
            status=job.status.value,
        )

    await require_account_access(account_id, current_user, db, write=True)

    statement_id = body.statement_id

    # Validate the statement belongs to this account (when provided)
    if statement_id is not None:
        stmt_check = await db.execute(
            select(BankStatement).where(
                BankStatement.statement_id == statement_id,
                BankStatement.account_id == account_id,
            )
        )
        if stmt_check.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=404,
                detail="Statement not found in this account",
            )

    await _run_matching(job, account_id, statement_id, db, current_user)
    await db.commit()
    await db.refresh(job)
    return ReconciliationRunResponse(
        job_id=job.job_id,
        status=job.status.value,
    )


@router.get("/jobs/{job_id}/results", response_model=ReconciliationResultsResponse)
async def get_reconciliation_results(
    job_id: int,
    account_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get reconciliation results: summary + full matches list.
    Unmatched items: use GET /receipts?match_status=unmatched and GET /statements/.../lines?match_status=unmatched.
    """
    job = await _get_reconciliation_job(job_id, db, current_user)
    await db.refresh(job, ["matches"])

    matches_stmt = (
        select(ReconciliationMatch)
        .where(ReconciliationMatch.job_id == job_id)
        .options(
            joinedload(ReconciliationMatch.line),
            joinedload(ReconciliationMatch.receipt),
        )
    )
    result = await db.execute(matches_stmt)
    match_rows = list(result.unique().scalars().all())

    total_lines = 0
    if account_id is not None:
        await require_account_access(account_id, current_user, db)
        count_stmt = (
            select(BankStatementLine.line_id)
            .join(
                BankStatement,
                BankStatementLine.statement_id == BankStatement.statement_id,
            )
            .join(Document, Document.statement_id == BankStatement.statement_id)
            .where(
                BankStatement.account_id == account_id,
                Document.deleted_at.is_(None),
            )
        )
        count_result = await db.execute(count_stmt)
        total_lines = len(count_result.all())
    else:
        line_ids = {m.line_id for m in match_rows}
        total_lines = len(line_ids)

    matched_line_ids = {m.line_id for m in match_rows}
    matched = len(matched_line_ids)
    unmatched = max(0, total_lines - matched)
    bundle_matched = sum(
        1 for m in match_rows if m.match_type == MatchStatus.bundle_matched
    )

    detail_list = []
    for m in match_rows:
        line = m.line
        receipt = m.receipt
        detail_list.append(
            ReconciliationMatchDetail(
                match_id=m.match_id,
                statement_line=MatchLineSummary(
                    line_id=line.line_id,
                    statement_id=line.statement_id,
                    vendor=line.vendor,
                    charge=line.charge,
                    transaction_date=line.transaction_date,
                    match_status=line.match_status.value,
                ),
                receipts=[
                    MatchReceiptSummary(
                        receipt_id=receipt.receipt_id,
                        vendor=receipt.vendor,
                        charged_amount=receipt.charged_amount,
                        billing_date=receipt.billing_date,
                        match_status=receipt.match_status.value,
                    )
                ],
                match_type=m.match_type,
            )
        )

    return ReconciliationResultsResponse(
        job_id=job.job_id,
        status=job.status.value,
        summary=ReconciliationSummary(
            total_lines=total_lines,
            matched=matched,
            unmatched=unmatched,
            bundle_matched=bundle_matched,
        ),
        matches=detail_list,
    )


@router.post("/matches")
async def create_manual_match(
    body: ManualMatchCreate,
    job_id: Optional[int] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(verify_csrf_token),
):
    """Manually create a match between a statement line and one or more receipts."""
    if job_id is not None:
        await _get_reconciliation_job(job_id, db, current_user)

    from app.utils.access import get_owned_receipt, get_owned_statement_line

    line = await db.get(BankStatementLine, body.line_id)
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")
    line = await get_owned_statement_line(
        line.statement_id,
        body.line_id,
        current_user,
        db,
        write=True,
    )

    created = []
    for rid in body.receipt_ids:
        receipt = await get_owned_receipt(rid, current_user, db, write=True)
        existing = await db.execute(
            select(ReconciliationMatch).where(
                ReconciliationMatch.line_id == body.line_id,
                ReconciliationMatch.receipt_id == rid,
            )
        )
        if existing.scalar_one_or_none() is not None:
            continue
        match = ReconciliationMatch(
            job_id=job_id,
            line_id=body.line_id,
            receipt_id=rid,
            match_type=body.match_type,
            created_by=current_user.user_id,
        )
        db.add(match)
        line.match_status = body.match_type
        receipt.match_status = body.match_type
        created.append(match)
    await db.commit()
    return {"created": len(created), "match_type": body.match_type.value}


@router.delete("/matches/{match_id}")
async def delete_match(
    match_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(verify_csrf_token),
):
    """Remove a match and reset line/receipt match_status to unmatched if they have no other matches."""
    from app.utils.access import get_owned_receipt, get_owned_statement_line

    match = await db.get(ReconciliationMatch, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")

    line_id = match.line_id
    receipt_id = match.receipt_id
    line = await db.get(BankStatementLine, line_id)
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")
    await get_owned_statement_line(
        line.statement_id,
        line_id,
        current_user,
        db,
        write=True,
    )
    await get_owned_receipt(receipt_id, current_user, db, write=True)

    await db.delete(match)
    await db.flush()

    # Reset match_status if no other matches remain for this line
    remaining_line = await db.execute(
        select(func.count())
        .select_from(ReconciliationMatch)
        .where(ReconciliationMatch.line_id == line_id)
    )
    if remaining_line.scalar() == 0:
        line.match_status = MatchStatus.unmatched
    receipt = await db.get(Receipt, receipt_id)
    if receipt:
        remaining_receipt = await db.execute(
            select(func.count())
            .select_from(ReconciliationMatch)
            .where(ReconciliationMatch.receipt_id == receipt_id)
        )
        if remaining_receipt.scalar() == 0:
            receipt.match_status = MatchStatus.unmatched

    await db.commit()
    return {"deleted": match_id}


@router.patch("/matches/{match_id}")
async def update_match(
    match_id: int,
    body: ManualMatchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(verify_csrf_token),
):
    """Switch which receipt is linked for this match."""
    from app.utils.access import get_owned_receipt, get_owned_statement_line

    match = await db.get(ReconciliationMatch, match_id)
    if match is None:
        raise HTTPException(status_code=404, detail="Match not found")
    line = await db.get(BankStatementLine, match.line_id)
    if not line:
        raise HTTPException(status_code=404, detail="Statement line not found")
    await get_owned_statement_line(
        line.statement_id,
        match.line_id,
        current_user,
        db,
        write=True,
    )
    await get_owned_receipt(body.receipt_id, current_user, db, write=True)

    old_receipt_id = match.receipt_id
    match.receipt_id = body.receipt_id
    match.updated_by = current_user.user_id

    old_receipt = await db.get(Receipt, old_receipt_id)
    if old_receipt:
        other = await db.execute(
            select(ReconciliationMatch).where(
                ReconciliationMatch.receipt_id == old_receipt_id,
                ReconciliationMatch.match_id != match_id,
            )
        )
        if other.scalar_one_or_none() is None:
            old_receipt.match_status = MatchStatus.unmatched
    new_receipt = await db.get(Receipt, body.receipt_id)
    if new_receipt:
        new_receipt.match_status = match.match_type

    await db.commit()
    return {"updated": match_id}
