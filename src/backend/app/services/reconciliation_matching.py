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

from rapidfuzz import fuzz
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import MatchStatus
from app.models.job import Job
from app.models.receipt import Receipt
from app.models.reconciliation import ReconciliationMatch
from app.models.statement import BankStatementLine
from app.models.user import User

# ---------------------------------------------------------------------------
# Default thresholds (used as MatchConfig defaults — do not reference directly
# inside the algorithm; use the config object instead).
# ---------------------------------------------------------------------------
CONFIDENCE_THRESHOLD = 80
BUNDLE_VENDOR_THRESHOLD = 60


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
    """

    max_date_window: int = field(default=14)
    confidence_threshold: int = field(default=CONFIDENCE_THRESHOLD)
    bundle_vendor_threshold: int = field(default=BUNDLE_VENDOR_THRESHOLD)
    max_bundle_size: int = field(default=4)

    def __post_init__(self) -> None:
        if not (1 <= self.max_date_window <= 90):
            raise ValueError("max_date_window must be between 1 and 90")
        if not (50 <= self.confidence_threshold <= 100):
            raise ValueError("confidence_threshold must be between 50 and 100")
        if not (0 <= self.bundle_vendor_threshold <= 100):
            raise ValueError("bundle_vendor_threshold must be between 0 and 100")
        if not (2 <= self.max_bundle_size <= 6):
            raise ValueError("max_bundle_size must be between 2 and 6")


# vendor aliases for known bank abbreviations
VENDOR_ALIASES = {
    "amzn": "amazon",
}


def _clean_vendor(v: str) -> str:
    v = v.strip().lower()
    v = re.sub(r"\.(com|net|org|io|co).*$", "", v)
    v = VENDOR_ALIASES.get(v, v)
    return v.strip()


def _vendor_similarity(lv: str, rv: str) -> float:
    if not lv or not rv:
        return 0.0
    return max(fuzz.WRatio(lv, rv), fuzz.partial_ratio(lv, rv))


def _vendor_score(line: BankStatementLine, receipt: Receipt) -> int:
    lv = _clean_vendor(
        line.vendor or ""
    )  # compare with line desciption for more context
    rv = _clean_vendor(receipt.vendor or "")
    return round((_vendor_similarity(lv, rv) / 100) * 30)


def _date_score(
    line: BankStatementLine,
    receipt: Receipt,
    config: MatchConfig | None = None,
) -> int:
    max_window = config.max_date_window if config is not None else 14
    days_diff = abs((line.transaction_date - receipt.billing_date).days)
    if days_diff == 0:
        return 30
    elif days_diff <= 3:
        return 20
    elif days_diff <= 9:
        return 10
    elif days_diff <= max_window:
        return 5
    else:
        return 0


def calculate_confidence(
    line: BankStatementLine,
    receipt: Receipt,
    config: MatchConfig | None = None,
) -> int:
    if line.charge != receipt.charged_amount:
        return 0
    return 40 + _vendor_score(line, receipt) + _date_score(line, receipt, config)


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

    # --- Pass 1a: exact amount + exact date ---
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
                break

    # --- Pass 1b: exact amount + fuzzy vendor + date proximity ---
    candidates = []
    for line in lines:
        if line.match_status != MatchStatus.unmatched:
            continue
        for receipt in receipts:
            if receipt.match_status != MatchStatus.unmatched:
                continue
            score = calculate_confidence(line, receipt, cfg)
            if score >= cfg.confidence_threshold:
                candidates.append((score, line, receipt))

    candidates.sort(key=lambda x: x[0], reverse=True)

    for score, line, receipt in candidates:
        if (
            line.match_status != MatchStatus.unmatched
            or receipt.match_status != MatchStatus.unmatched
        ):
            continue
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
        rv = _clean_vendor(receipt.vendor or "")

        for size in range(2, cfg.max_bundle_size + 1):
            for subset in combinations(unmatched_lines, size):
                if sum(line.charge for line in subset) != receipt.charged_amount:
                    continue
                vendor_ok = all(
                    _vendor_similarity(_clean_vendor(line.vendor or ""), rv)
                    >= cfg.bundle_vendor_threshold
                    for line in subset
                )
                if not vendor_ok:
                    continue
                matched_subset = subset
                break
            if matched_subset:
                break

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
        lv = _clean_vendor(line.vendor or "")

        for size in range(2, cfg.max_bundle_size + 1):
            for subset in combinations(unmatched_receipts, size):
                if sum(r.charged_amount for r in subset) != line.charge:
                    continue
                vendor_ok = all(
                    _vendor_similarity(_clean_vendor(r.vendor or ""), lv)
                    >= cfg.bundle_vendor_threshold
                    for r in subset
                )
                if not vendor_ok:
                    continue
                matched_subset = subset
                break
            if matched_subset:
                break

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
) -> None:
    receipt_map = {r.receipt_id: r for r in receipts}

    print("\n" + "=" * 100)
    print(f"{'RECONCILIATION MATCH SUMMARY':^100}")
    print("=" * 100)
    print(
        f"{'LINE ID':<8} {'STATUS':<18} {'AMOUNT':>10} {'DATE':<12} {'VENDOR':<30} {'MATCHED RECEIPTS'}"
    )
    print("-" * 100)

    for line in lines:
        status = line.match_status.value
        print(
            f"{line.line_id:<8} {status:<18} {float(line.charge):>10.2f} "
            f"{str(line.transaction_date):<12} {(line.vendor or '')[:28]:<30}"
        )

        # find matched receipts via the matches relationship
        for match in line.matches or []:
            receipt = receipt_map.get(match.receipt_id)
            if not receipt:
                continue
            confidence = calculate_confidence(line, receipt)
            print(
                f"{'':8} {'-> receipt ' + str(receipt.receipt_id):<18} "
                f"{float(receipt.charged_amount):>10.2f} "
                f"{str(receipt.billing_date):<12} "
                f"{(receipt.vendor or '')[:28]:<30} "
                f"confidence={confidence}"
            )

    print("=" * 100)
    unmatched_lines = sum(1 for ln in lines if ln.match_status == MatchStatus.unmatched)
    print(
        f"  Lines: {len(lines)} total | {len(lines) - unmatched_lines} matched | {unmatched_lines} unmatched"
    )
    print("=" * 100 + "\n")
