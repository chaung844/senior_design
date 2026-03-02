from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.enums import MatchStatus


class ReconciliationMatchRead(BaseModel):
    match_id: int
    job_id: Optional[int] = None
    line_id: int
    receipt_id: int
    match_type: MatchStatus
    # confidence_score: Optional[Decimal] = None
    matched_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReconciliationMatchListResponse(BaseModel):
    matches: list[ReconciliationMatchRead]
    total: int
    offset: int
    limit: int


# --- Reconciliation run and results (Tier 4) ---


class ReconciliationStartRequest(BaseModel):
    """Single-call endpoint: create a job + run reconciliation in one step."""

    account_id: int
    statement_id: int


class ReconciliationStartResponse(BaseModel):
    job_id: int
    status: str
    summary: "ReconciliationSummary"


class ReconciliationRunRequest(BaseModel):
    """Optional scope for run. When job_documents exists, scope can come from job."""

    account_id: Optional[int] = None
    statement_id: Optional[int] = None


class ReconciliationRunResponse(BaseModel):
    job_id: int
    status: str


class ReconciliationSummary(BaseModel):
    total_lines: int
    matched: int
    unmatched: int
    bundle_matched: int


class MatchReceiptSummary(BaseModel):
    receipt_id: int
    vendor: str
    charged_amount: Decimal
    billing_date: date
    match_status: str


class MatchLineSummary(BaseModel):
    line_id: int
    statement_id: int
    vendor: str
    charge: Decimal
    transaction_date: date
    match_status: str


class ReconciliationMatchDetail(BaseModel):
    """One match row: one statement line + one receipt."""

    match_id: int
    statement_line: MatchLineSummary
    receipts: list[MatchReceiptSummary]
    match_type: MatchStatus


class ReconciliationResultsResponse(BaseModel):
    job_id: int
    status: str
    summary: ReconciliationSummary
    matches: list[ReconciliationMatchDetail]
    # Pagination metadata (7.4)
    total_matches: int
    offset: int
    limit: int


class ManualMatchCreate(BaseModel):
    line_id: int
    receipt_ids: list[int]
    match_type: MatchStatus = MatchStatus.manual


class ManualMatchUpdate(BaseModel):
    """Switch which receipt(s) are linked (e.g. single match: one receipt_id)."""

    receipt_id: int
