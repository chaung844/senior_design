"""
Reconciliation matching algorithms.

Matching Flow:
- Pass 1: 1-to-1 confidence-based matching
    - Pass 1a: exact amount + exact date (highest confidence, no fuzzy)
    - Pass 1b: exact amount + fuzzy vendor + date proximity (confidence scored)
- Pass 2: many lines -> 1 receipt (bundle)
- Pass 3: many receipts -> 1 line (bundle)

Confidence scoring (Pass 1b only):
- amount: exact match -> +40, else 0 total
- vendor: dynamic score — max(WRatio, partial_ratio) on domain-suffix stripped,
         alias-normalized strings, scaled linearly: round((similarity / 100) * 30)
- date:   0 days -> +30, 1-3 -> +20, 4-9 -> +10, 10-{max_date_window} -> +5,
          >{max_date_window} -> +0
- threshold: >= confidence_threshold -> perfect_matched

Bundle (Pass 2 & 3):
- max bundle size controlled by max_bundle_size (default 4)
- exact amount sum + all items must have max(WRatio, partial_ratio) >= bundle_vendor_threshold

All thresholds are runtime-configurable via MatchConfig. Module-level constants
below serve as canonical defaults and are NOT used directly by the algorithm.

See matching_flow.md for full details.
"""

import re
from dataclasses import dataclass, field
from itertools import combinations
from typing import SupportsFloat

import numpy as np
from rapidfuzz import fuzz
from scipy.optimize import linear_sum_assignment
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.enums import MatchStatus
from app.models.job import Job
from app.models.receipt import Receipt
from app.models.reconciliation import ReconciliationMatch
from app.models.statement import BankStatementLine
from app.models.user import User

# ---------------------------------------------------------------------------
# Default thresholds from config.py (used as MatchConfig defaults — do not reference directly
# inside the algorithm; use the config object instead).
# ---------------------------------------------------------------------------
settings = get_settings()


@dataclass
class MatchConfig:
    """Runtime configuration for the reconciliation matching algorithm.

    All fields default to the canonical module-level constants so that callers
    that omit the config get identical behaviour to the previous hard-coded run.

    Trade-off notes
    ---------------
    max_date_window:
        Wider window recovers delayed billing/subscription matches (true
        positives) but increases false positives when vendor names are similar
        and amounts coincide. Keep ≤ 30 for most use-cases.
    confidence_threshold:
        Lower value → more fuzzy matches accepted (fewer false negatives, more
        false positives). Raise when the receipt corpus is large and vendor
        names are ambiguous.
    bundle_vendor_threshold:
        Lower value → more split-charge bundles found but risks linking
        unrelated lines. Set to 0 only when amount matching alone is trusted.
    max_bundle_size:
        Larger value allows matching larger split payments. Combinatorial cost
        grows as O(n^k), so values above 5 can be slow on large datasets.
    min_vendor_similarity_pass1b:
        Minimum raw fuzzy vendor score (0–100) required for Pass 1b. ``0`` keeps
        legacy behaviour (date + composite score only). Raise to reduce false
        positives when amounts collide for different merchants.
    """

    max_date_window: int = field(default=settings.reconciliation_max_date_window)
    confidence_threshold: int = field(
        default=settings.reconciliation_confidence_threshold
    )
    bundle_vendor_threshold: int = field(
        default=settings.reconciliation_bundle_vendor_threshold
    )
    max_bundle_size: int = field(default=settings.reconciliation_max_bundle_size)
    min_vendor_similarity_pass1b: int = field(
        default=settings.reconciliation_min_vendor_similarity_pass1b
    )

    def __post_init__(self) -> None:
        if not (1 <= self.max_date_window <= 90):
            raise ValueError("max_date_window must be between 1 and 90")
        if not (50 <= self.confidence_threshold <= 100):
            raise ValueError("confidence_threshold must be between 50 and 100")
        if not (0 <= self.bundle_vendor_threshold <= 100):
            raise ValueError("bundle_vendor_threshold must be between 0 and 100")
        if not (2 <= self.max_bundle_size <= 6):
            raise ValueError("max_bundle_size must be between 2 and 6")
        if not (0 <= self.min_vendor_similarity_pass1b <= 100):
            raise ValueError("min_vendor_similarity_pass1b must be between 0 and 100")


# Scoring weights for Pass 1b (amount gate + soft pair = 100 max).
AMOUNT_SCORE = 40
VENDOR_SOFT_MAX = 30
DATE_SOFT_MAX = 30

# Cost sentinel for assignment problems (must exceed any real confidence cost).
_INVALID_ASSIGNMENT_COST = 1_000_000_000.0

# vendor aliases for known bank abbreviations
VENDOR_ALIASES = {
    "amzn": "amazon",
}


def _clean_vendor(v: str) -> str:
    """
    Clean a vendor name by stripping whitespace, converting to lowercase,
    removing domain suffixes, and applying vendor aliases.
    """
    v = v.strip().lower()
    v = re.sub(r"\.(com|net|org|io|co).*$", "", v)
    v = VENDOR_ALIASES.get(v, v)
    return v.strip()


def _vendor_similarity(lv: str, rv: str) -> float:
    """
    Calculate the similarity between two vendor names using fuzzy matching.
    Returns a float between 0 and 100.
    """
    if not lv or not rv:
        return 0.0
    return max(fuzz.WRatio(lv, rv), fuzz.partial_ratio(lv, rv))


def _line_vendor_similarity(line: BankStatementLine, receipt_vendor: str) -> float:
    """Best fuzzy match of receipt vendor against the line's normalized vendor and description."""
    rv = _clean_vendor(receipt_vendor)
    if not rv:
        return 0.0
    lv = _clean_vendor(line.vendor or "")
    ld = _clean_vendor(line.description or "")
    a = _vendor_similarity(lv, rv) if lv else 0.0
    b = _vendor_similarity(ld, rv) if ld else 0.0
    return max(a, b)


def line_vendor_similarity(line: BankStatementLine, receipt: Receipt) -> float:
    """Public wrapper: similarity used for Pass 1 scoring and bundles (vendor + description)."""
    return _line_vendor_similarity(line, receipt.vendor or "")


def _vendor_score_from_similarity(sim: float) -> int:
    return round((sim / 100.0) * VENDOR_SOFT_MAX)


def _vendor_score(line: BankStatementLine, receipt: Receipt) -> int:
    """
    Vendor soft score from unified line–receipt vendor similarity.
    Returns an integer between 0 and VENDOR_SOFT_MAX.
    """
    return _vendor_score_from_similarity(
        _line_vendor_similarity(line, receipt.vendor or "")
    )


def _date_score(
    line: BankStatementLine,
    receipt: Receipt,
    config: MatchConfig | None = None,
) -> int:
    """
    Calculate a date score based on the absolute difference between transaction date and billing date.
    Returns an integer between 0 and DATE_SOFT_MAX.
    Buckets: 0 days -> +30; 1–3 -> +20; 4–9 -> +10; 10–max_date_window -> +5; else 0.
    """
    max_window = config.max_date_window if config is not None else 14
    days_diff = abs((line.transaction_date - receipt.billing_date).days)
    if days_diff == 0:
        return DATE_SOFT_MAX
    if 1 <= days_diff <= 3:
        return 20
    if 4 <= days_diff <= 9:
        return 10
    if 10 <= days_diff <= max_window:
        return 5
    return 0


def calculate_soft_pair_score(
    line: BankStatementLine,
    receipt: Receipt,
    config: MatchConfig | None = None,
) -> int:
    """Vendor + date only (0..60) when amount matches and vendor floor passes; else 0."""
    cfg = config if config is not None else MatchConfig()
    if line.charge != receipt.charged_amount:
        return 0
    if (
        _line_vendor_similarity(line, receipt.vendor or "")
        < cfg.min_vendor_similarity_pass1b
    ):
        return 0
    return _vendor_score(line, receipt) + _date_score(line, receipt, cfg)


def calculate_confidence(
    line: BankStatementLine,
    receipt: Receipt,
    config: MatchConfig | None = None,
) -> int:
    """
    Full confidence: amount gate + soft pair (vendor + date). Returns 0–100 (or 0 if ineligible).
    """
    cfg = config if config is not None else MatchConfig()
    if line.charge != receipt.charged_amount:
        return 0
    if (
        _line_vendor_similarity(line, receipt.vendor or "")
        < cfg.min_vendor_similarity_pass1b
    ):
        return 0
    return AMOUNT_SCORE + _vendor_score(line, receipt) + _date_score(line, receipt, cfg)


def _days_diff(line: BankStatementLine, receipt: Receipt) -> int:
    return abs((line.transaction_date - receipt.billing_date).days)


def candidate_pair_sort_key(
    line: BankStatementLine,
    receipt: Receipt,
    confidence: int,
    config: MatchConfig,
) -> tuple:
    """Deterministic ordering: confidence desc, days asc, vendor similarity desc, ids asc."""
    days = _days_diff(line, receipt)
    sim = _line_vendor_similarity(line, receipt.vendor or "")
    return (-confidence, days, -sim, line.line_id, receipt.receipt_id)


def _pass1a_assignment_pairs(
    lines: list[BankStatementLine],
    receipts: list[Receipt],
) -> list[tuple[BankStatementLine, Receipt]]:
    """Maximum-cardinality matching for exact amount + exact date (unmatched items only)."""
    ul = sorted(
        (ln for ln in lines if ln.match_status == MatchStatus.unmatched),
        key=lambda x: x.line_id,
    )
    ur = sorted(
        (r for r in receipts if r.match_status == MatchStatus.unmatched),
        key=lambda x: x.receipt_id,
    )
    if not ul or not ur:
        return []
    n, m = len(ul), len(ur)
    cost = np.full((n, m), _INVALID_ASSIGNMENT_COST, dtype=np.float64)
    for i, line in enumerate(ul):
        for j, receipt in enumerate(ur):
            if (
                line.charge == receipt.charged_amount
                and line.transaction_date == receipt.billing_date
            ):
                cost[i, j] = -1.0
    row_ind, col_ind = linear_sum_assignment(cost)
    out: list[tuple[BankStatementLine, Receipt]] = []
    for ri, cj in zip(row_ind, col_ind, strict=True):
        if cost[ri, cj] >= _INVALID_ASSIGNMENT_COST / 2:
            continue
        out.append((ul[ri], ur[cj]))
    return out


def _pass1b_assignment_pairs(
    lines: list[BankStatementLine],
    receipts: list[Receipt],
    cfg: MatchConfig,
) -> list[tuple[BankStatementLine, Receipt]]:
    """Maximum total confidence for eligible 1:1 pairs (amount + threshold + vendor floor)."""
    ul = sorted(
        (ln for ln in lines if ln.match_status == MatchStatus.unmatched),
        key=lambda x: x.line_id,
    )
    ur = sorted(
        (r for r in receipts if r.match_status == MatchStatus.unmatched),
        key=lambda x: x.receipt_id,
    )
    if not ul or not ur:
        return []
    n, m = len(ul), len(ur)
    cost = np.full((n, m), _INVALID_ASSIGNMENT_COST, dtype=np.float64)
    for i, line in enumerate(ul):
        for j, receipt in enumerate(ur):
            conf = calculate_confidence(line, receipt, cfg)
            if conf >= cfg.confidence_threshold:
                cost[i, j] = -float(conf)
    row_ind, col_ind = linear_sum_assignment(cost)
    out: list[tuple[BankStatementLine, Receipt]] = []
    for ri, cj in zip(row_ind, col_ind, strict=True):
        if cost[ri, cj] >= _INVALID_ASSIGNMENT_COST / 2:
            continue
        line, receipt = ul[ri], ur[cj]
        conf = calculate_confidence(line, receipt, cfg)
        if conf < cfg.confidence_threshold:
            continue
        out.append((line, receipt))
    return out


async def apply_perfect_matches(
    job: Job,
    lines: list[BankStatementLine],
    receipts: list[Receipt],
    db: AsyncSession,
    current_user: User,
    config: MatchConfig | None = None,
) -> None:
    """
    Pass 1: perfect matching.
    1a: exact amount + exact date
    1b: exact amount + fuzzy vendor + date proximity (confidence scored)
    """
    cfg = config if config is not None else MatchConfig()

    # --- Pass 1a: exact amount + exact date (maximum cardinality, deterministic) ---
    for line, receipt in _pass1a_assignment_pairs(lines, receipts):
        db.add(
            ReconciliationMatch(
                job_id=job.job_id,
                line_id=line.line_id,
                receipt_id=receipt.receipt_id,
                match_type=MatchStatus.perfect_matched,
                created_by=current_user.user_id,
            )
        )
        line.match_status = MatchStatus.perfect_matched
        receipt.match_status = MatchStatus.perfect_matched

    # --- Pass 1b: exact amount + fuzzy vendor + date proximity (max total confidence) ---
    for line, receipt in _pass1b_assignment_pairs(lines, receipts, cfg):
        db.add(
            ReconciliationMatch(
                job_id=job.job_id,
                line_id=line.line_id,
                receipt_id=receipt.receipt_id,
                match_type=MatchStatus.perfect_matched,
                created_by=current_user.user_id,
            )
        )
        line.match_status = MatchStatus.perfect_matched
        receipt.match_status = MatchStatus.perfect_matched


async def apply_lines_to_receipt(
    job: Job,
    lines: list[BankStatementLine],
    receipts: list[Receipt],
    db: AsyncSession,
    current_user: User,
    config: MatchConfig | None = None,
) -> None:
    """
    Pass 2: many lines -> 1 receipt (bundle).
    Exact amount sum + lines must have fuzzy vendor score >= bundle_vendor_threshold.
    """
    cfg = config if config is not None else MatchConfig()
    unmatched_lines = [
        line for line in lines if line.match_status == MatchStatus.unmatched
    ]

    for receipt in receipts:
        if receipt.match_status != MatchStatus.unmatched:
            continue

        matched_subset = None
        best_key: tuple | None = None

        for size in range(2, cfg.max_bundle_size + 1):
            for subset in combinations(unmatched_lines, size):
                if sum(line.charge for line in subset) != receipt.charged_amount:
                    continue
                sims = [
                    _line_vendor_similarity(line, receipt.vendor or "")
                    for line in subset
                ]
                if not all(s >= cfg.bundle_vendor_threshold for s in sims):
                    continue
                avg_sim = sum(sims) / len(sims)
                min_sim = min(sims)
                key = (avg_sim, min_sim, tuple(sorted(ln.line_id for ln in subset)))
                if best_key is None or key > best_key:
                    best_key = key
                    matched_subset = subset

        if not matched_subset:
            continue

        for line in matched_subset:
            db.add(
                ReconciliationMatch(
                    job_id=job.job_id,
                    line_id=line.line_id,
                    receipt_id=receipt.receipt_id,
                    match_type=MatchStatus.bundle_matched,
                    created_by=current_user.user_id,
                )
            )
            line.match_status = MatchStatus.bundle_matched
            unmatched_lines.remove(line)

        receipt.match_status = MatchStatus.bundle_matched


async def apply_receipts_to_line(
    job: Job,
    lines: list[BankStatementLine],
    receipts: list[Receipt],
    db: AsyncSession,
    current_user: User,
    config: MatchConfig | None = None,
) -> None:
    """
    Pass 3: many receipts -> 1 line (bundle).
    Exact amount sum + receipts must have fuzzy vendor score >= bundle_vendor_threshold.
    """
    cfg = config if config is not None else MatchConfig()
    unmatched_receipts = [
        r for r in receipts if r.match_status == MatchStatus.unmatched
    ]

    for line in lines:
        if line.match_status != MatchStatus.unmatched:
            continue

        matched_subset = None
        best_key: tuple | None = None

        for size in range(2, cfg.max_bundle_size + 1):
            for subset in combinations(unmatched_receipts, size):
                if sum(r.charged_amount for r in subset) != line.charge:
                    continue
                sims = [_line_vendor_similarity(line, r.vendor or "") for r in subset]
                if not all(s >= cfg.bundle_vendor_threshold for s in sims):
                    continue
                avg_sim = sum(sims) / len(sims)
                min_sim = min(sims)
                key = (avg_sim, min_sim, tuple(sorted(r.receipt_id for r in subset)))
                if best_key is None or key > best_key:
                    best_key = key
                    matched_subset = subset

        if not matched_subset:
            continue

        for receipt in matched_subset:
            db.add(
                ReconciliationMatch(
                    job_id=job.job_id,
                    line_id=line.line_id,
                    receipt_id=receipt.receipt_id,
                    match_type=MatchStatus.bundle_matched,
                    created_by=current_user.user_id,
                )
            )
            receipt.match_status = MatchStatus.bundle_matched
            unmatched_receipts.remove(receipt)

        line.match_status = MatchStatus.bundle_matched


## NOTES:
## - confidence score is only meaningful for Pass 1b (fuzzy vendor + date proximity)
## - Pass 1a matches may show any confidence score depending on how well vendor align
## - bundle matches (Pass 2 & 3) always show confidence=0 since individual line charge != receipt total
def _print_match_summary(
    lines: list[BankStatementLine],
    receipts: list[Receipt],
    config: MatchConfig | None = None,
) -> None:
    console = Console()
    cfg = config if config is not None else MatchConfig()
    receipt_map = {r.receipt_id: r for r in receipts}
    unmatched_receipts = [
        r for r in receipts if r.match_status == MatchStatus.unmatched
    ]

    def _money(value: SupportsFloat) -> str:
        return f"{float(value):.2f}"

    def _date_days_diff(line: BankStatementLine, receipt: Receipt) -> int:
        return abs((line.transaction_date - receipt.billing_date).days)

    console.print()
    console.rule("[bold cyan]RECONCILIATION MATCH DECISION TRACE[/bold cyan]")
    console.print(
        "Config:"
        f" max_date_window={cfg.max_date_window},"
        f" confidence_threshold={cfg.confidence_threshold},"
        f" min_vendor_similarity_pass1b={cfg.min_vendor_similarity_pass1b},"
        f" bundle_vendor_threshold={cfg.bundle_vendor_threshold},"
        f" max_bundle_size={cfg.max_bundle_size}",
        style="dim",
    )
    console.rule(style="dim")

    for line in lines:
        line_vendor = _clean_vendor(line.vendor or "")
        is_matched = line.match_status != MatchStatus.unmatched
        header_style = "green" if is_matched else "red"
        status_badge = (
            "[bold green]MATCHED[/bold green]"
            if is_matched
            else "[bold red]UNMATCHED[/bold red]"
        )
        console.print(
            f"[Line {line.line_id}] status={line.match_status.value}, "
            f"amount={_money(line.charge)}, date={line.transaction_date}, "
            f"vendor='{line.description[:10] or ''}...' (normalized='{line_vendor}') "
            f"{status_badge}",
            style=header_style,
        )

        matched = line.matches or []
        if matched:
            console.print(
                f"  -> MATCHED via {len(matched)} link(s):", style="bold green"
            )
            for match in matched:
                receipt = receipt_map.get(match.receipt_id)
                if not receipt:
                    console.print(
                        f"     - receipt_id={match.receipt_id}: missing from loaded receipt list",
                        style="yellow",
                    )
                    continue

                amount_exact = line.charge == receipt.charged_amount
                vendor_similarity = line_vendor_similarity(line, receipt)
                vendor_score = _vendor_score(line, receipt)
                days_diff = _date_days_diff(line, receipt)
                date_score = _date_score(line, receipt, cfg)
                soft_pair = calculate_soft_pair_score(line, receipt, cfg)
                confidence = calculate_confidence(line, receipt, cfg)
                amount_score = AMOUNT_SCORE if amount_exact else 0

                if match.match_type == MatchStatus.bundle_matched:
                    reasoning = (
                        "bundle rule accepted this relation "
                        "(exact sum across grouped items + vendor threshold checks)"
                    )
                elif (
                    amount_exact
                    and line.transaction_date == receipt.billing_date
                    and match.match_type == MatchStatus.perfect_matched
                ):
                    reasoning = "pass 1a accepted (exact amount + exact date)"
                else:
                    reasoning = (
                        "pass 1b accepted "
                        f"(confidence={confidence} >= {cfg.confidence_threshold})"
                    )

                detail = Table(show_header=False, box=None, pad_edge=False)
                detail.add_column("k", style="cyan", width=14)
                detail.add_column("v")
                detail.add_row(
                    "receipt",
                    f"{receipt.receipt_id} ({match.match_type.value}) "
                    f"amount={_money(receipt.charged_amount)} date={receipt.billing_date}",
                )
                detail.add_row("vendor", f"{receipt.vendor or ''}")
                detail.add_row("reason", reasoning)
                detail.add_row(
                    "components",
                    f"amount_exact={amount_exact} (score={amount_score}), "
                    f"vendor_similarity={vendor_similarity:.1f} (score={vendor_score}), "
                    f"date_diff_days={days_diff} (score={date_score}), "
                    f"soft_pair={soft_pair}, "
                    f"total_confidence={confidence}",
                )
                console.print(Panel(detail, border_style="green"))
        else:
            console.print(
                "  -> UNMATCHED: no persisted match relation for this line.",
                style="bold red",
            )
            same_amount_candidates = [
                r for r in unmatched_receipts if r.charged_amount == line.charge
            ]
            if not same_amount_candidates:
                console.print(
                    "     rejection: no currently-unmatched receipt has the exact same amount "
                    f"({_money(line.charge)}).",
                    style="red",
                )
            else:
                console.print(
                    f"     amount gate: found {len(same_amount_candidates)} "
                    "currently-unmatched receipt(s) with same amount.",
                    style="yellow",
                )

            # Show top candidate receipts with explicit rejection reasons.
            candidate_rows = []
            for receipt in unmatched_receipts:
                vendor_similarity = line_vendor_similarity(line, receipt)
                vendor_score = _vendor_score(line, receipt)
                days_diff = _date_days_diff(line, receipt)
                date_score = _date_score(line, receipt, cfg)
                amount_exact = line.charge == receipt.charged_amount
                amount_score = AMOUNT_SCORE if amount_exact else 0
                confidence = calculate_confidence(line, receipt, cfg)
                candidate_rows.append(
                    (
                        confidence,
                        amount_exact,
                        vendor_similarity,
                        days_diff,
                        receipt,
                        amount_score,
                        vendor_score,
                        date_score,
                    )
                )

            candidate_rows.sort(
                key=lambda row: candidate_pair_sort_key(line, row[4], row[0], cfg),
            )
            top_candidates = candidate_rows[:3]

            if not top_candidates:
                console.print(
                    "     rejection: no unmatched receipts left to evaluate.",
                    style="red",
                )
            else:
                console.print("     top candidate rejections:", style="bold red")
                for (
                    confidence,
                    amount_exact,
                    vendor_similarity,
                    days_diff,
                    receipt,
                    amount_score,
                    vendor_score,
                    date_score,
                ) in top_candidates:
                    rejection_reasons = []
                    if not amount_exact:
                        rejection_reasons.append("amount mismatch (fails pass 1)")
                    if days_diff > cfg.max_date_window:
                        rejection_reasons.append(
                            f"date outside max_date_window ({days_diff} > {cfg.max_date_window})"
                        )
                    if confidence < cfg.confidence_threshold:
                        rejection_reasons.append(
                            f"confidence below threshold ({confidence} < {cfg.confidence_threshold})"
                        )
                    if (
                        amount_exact
                        and days_diff <= cfg.max_date_window
                        and confidence < cfg.confidence_threshold
                        and vendor_similarity < cfg.bundle_vendor_threshold
                    ):
                        rejection_reasons.append(
                            "weak vendor similarity; unlikely to satisfy bundle vendor checks"
                        )
                    if not rejection_reasons:
                        rejection_reasons.append(
                            "candidate not chosen by global ordering / already consumed by another relation"
                        )

                    detail = Table(show_header=False, box=None, pad_edge=False)
                    detail.add_column("k", style="magenta", width=14)
                    detail.add_column("v")
                    detail.add_row(
                        "receipt",
                        f"{receipt.receipt_id} amount={_money(receipt.charged_amount)} "
                        f"date={receipt.billing_date}",
                    )
                    detail.add_row("vendor", f"{receipt.vendor or ''}")
                    soft_pair = calculate_soft_pair_score(line, receipt, cfg)
                    detail.add_row(
                        "components",
                        f"amount_exact={amount_exact} (score={amount_score}), "
                        f"vendor_similarity={vendor_similarity:.1f} (score={vendor_score}), "
                        f"date_diff_days={days_diff} (score={date_score}), "
                        f"soft_pair={soft_pair}, "
                        f"total_confidence={confidence}",
                    )
                    detail.add_row("rejection", ", ".join(rejection_reasons))
                    console.print(Panel(detail, border_style="red"))

        console.rule(style="dim")

    unmatched_lines = sum(1 for ln in lines if ln.match_status == MatchStatus.unmatched)
    matched_lines = len(lines) - unmatched_lines
    unmatched_receipts_count = sum(
        1 for r in receipts if r.match_status == MatchStatus.unmatched
    )
    matched_receipts_count = len(receipts) - unmatched_receipts_count
    totals_style = (
        "bold yellow" if unmatched_lines or unmatched_receipts_count else "bold green"
    )
    console.print(
        "Totals:"
        f" lines={len(lines)} (matched={matched_lines}, unmatched={unmatched_lines}) |"
        f" receipts={len(receipts)} (matched={matched_receipts_count}, unmatched={unmatched_receipts_count})",
        style=totals_style,
    )
    console.rule(style="cyan")
    console.print()
