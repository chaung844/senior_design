from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

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


class ReconciliationConfig(BaseModel):
    """Tunable parameters for a single reconciliation run.

    All fields are optional — omitting them (or the entire object) causes the
    algorithm to use its built-in defaults, preserving backward compatibility.

    Attributes
    ----------
    max_date_window:
        Maximum number of days between a bank-statement transaction date and a
        receipt billing date for the pair to receive a non-zero date score.
        Pairs beyond this window score 0 on the date component and will not
        reach the confidence threshold under normal vendor scores.
        Trade-off: wider window catches delayed billing/subscription charges
        (more true positives) but increases false positives when vendors are
        similar and amounts coincide.
    confidence_threshold:
        Minimum combined confidence score (0–100) required to accept a fuzzy
        match in Pass 1b.  The score is composed of: amount match (+40),
        vendor similarity (0–30), date proximity (0–30).
        Trade-off: lower threshold → more matches accepted (fewer false
        negatives, more false positives).
    bundle_vendor_threshold:
        Minimum vendor fuzzy-similarity score (0–100) required for every
        line/receipt in a bundle match (Pass 2 & 3).
        Trade-off: lower value finds more split-charge bundles but risks
        associating unrelated transactions.
    max_bundle_size:
        Maximum number of lines (Pass 2) or receipts (Pass 3) that can be
        combined into a single bundle match.
        Trade-off: larger value covers bigger split payments at the cost of
        combinatorial search growth and higher false-positive risk.
    """

    max_date_window: int = Field(
        default=14,
        ge=1,
        le=90,
        description="Max days between transaction and receipt dates for a non-zero date score.",
    )
    confidence_threshold: int = Field(
        default=80,
        ge=50,
        le=100,
        description="Minimum confidence score (0–100) to accept a fuzzy 1-to-1 match.",
    )
    bundle_vendor_threshold: int = Field(
        default=60,
        ge=0,
        le=100,
        description="Minimum vendor similarity score required for each item in a bundle match.",
    )
    max_bundle_size: int = Field(
        default=4,
        ge=2,
        le=6,
        description="Maximum number of lines or receipts that can form a single bundle match.",
    )


class ReconciliationStartRequest(BaseModel):
    """Single-call endpoint: create a job + run reconciliation in one step."""

    account_id: int
    statement_id: int
    config: ReconciliationConfig = Field(
        default_factory=ReconciliationConfig,
        description="Optional algorithm configuration. Omit to use default settings.",
    )


class ReconciliationStartResponse(BaseModel):
    job_id: int
    status: str
    summary: Optional["ReconciliationSummary"] = None


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


# --- AI-generated reconciliation summary (per-line analysis) ---


class CandidateReceiptDetail(BaseModel):
    receipt_id: int
    vendor: str
    charged_amount: Decimal
    billing_date: date
    confidence: int
    rejection_reasons: list[str]


class ReconciliationLineSummaryRead(BaseModel):
    """One unmatched line with AI analysis and top candidate receipts."""

    id: int
    job_id: int
    line_id: int
    statement_id: int
    line_vendor: str
    line_charge: Decimal
    line_date: date
    line_description: str
    top_candidates: list[CandidateReceiptDetail]
    ai_analysis: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReconciliationAISummaryResponse(BaseModel):
    job_id: int
    statement_id: int
    summaries: list[ReconciliationLineSummaryRead]
    total: int
