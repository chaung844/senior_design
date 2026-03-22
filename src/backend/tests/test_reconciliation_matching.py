"""Unit tests for reconciliation scoring and assignment helpers."""

from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

import pytest

from app.enums import MatchStatus
from app.services.reconciliation_matching import (
    AMOUNT_SCORE,
    DATE_SOFT_MAX,
    VENDOR_SOFT_MAX,
    MatchConfig,
    _date_score,
    _pass1a_assignment_pairs,
    _pass1b_assignment_pairs,
    calculate_confidence,
    calculate_soft_pair_score,
    candidate_pair_sort_key,
    line_vendor_similarity,
)


def _line(
    line_id: int = 1,
    description: str = "",
    vendor: str = "",
    charge: str = "10.00",
    transaction_date: date | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        line_id=line_id,
        statement_id=1,
        description=description,
        vendor=vendor,
        charge=Decimal(charge),
        transaction_date=transaction_date or date(2024, 1, 1),
        match_status=MatchStatus.unmatched,
    )


def _receipt(
    receipt_id: int = 1,
    vendor: str = "amazon",
    charged_amount: str = "10.00",
    billing_date: date | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        receipt_id=receipt_id,
        vendor=vendor,
        charged_amount=Decimal(charged_amount),
        billing_date=billing_date or date(2024, 1, 1),
        match_status=MatchStatus.unmatched,
    )


@pytest.mark.parametrize(
    ("days_delta", "expected"),
    [
        (0, DATE_SOFT_MAX),
        (2, 20),
        (3, 20),
        (5, 10),
        (9, 10),
        (10, 5),
        (14, 5),
        (15, 0),
    ],
)
def test_date_score_buckets(days_delta: int, expected: int) -> None:
    cfg = MatchConfig(max_date_window=14)
    base = date(2024, 6, 15)
    line = _line(transaction_date=base)
    receipt = _receipt(billing_date=base + timedelta(days=days_delta))
    assert _date_score(line, receipt, cfg) == expected


def test_soft_pair_and_confidence_same_vendor_perfect_date() -> None:
    cfg = MatchConfig()
    line = _line(description="AMAZON.COM", vendor="amazon", charge="42.00")
    receipt = _receipt(
        vendor="Amazon", charged_amount="42.00", billing_date=line.transaction_date
    )
    soft = calculate_soft_pair_score(line, receipt, cfg)
    assert 0 < soft <= VENDOR_SOFT_MAX + DATE_SOFT_MAX
    assert calculate_confidence(line, receipt, cfg) == AMOUNT_SCORE + soft


def test_confidence_zero_when_amount_differs() -> None:
    cfg = MatchConfig()
    line = _line(description="amazon", vendor="amazon", charge="1.00")
    receipt = _receipt(vendor="amazon", charged_amount="2.00")
    assert calculate_confidence(line, receipt, cfg) == 0
    assert calculate_soft_pair_score(line, receipt, cfg) == 0


def test_min_vendor_floor_blocks_confidence() -> None:
    cfg = MatchConfig(min_vendor_similarity_pass1b=95)
    line = _line(description="unrelated text", vendor="other", charge="10.00")
    receipt = _receipt(vendor="amazon", charged_amount="10.00")
    assert calculate_confidence(line, receipt, cfg) == 0


def test_line_vendor_similarity_uses_best_of_vendor_and_description() -> None:
    line = _line(
        description="POS PURCHASE UNKNOWN",
        vendor="starbucks",
        charge="5.00",
    )
    receipt = _receipt(vendor="Starbucks Store", charged_amount="5.00")
    sim = line_vendor_similarity(line, receipt)
    assert sim >= 80.0


def test_candidate_pair_sort_key_deterministic_tie_breaks() -> None:
    """Same score and date distance: lower receipt_id sorts first (stable ordering)."""
    cfg = MatchConfig()
    d = date(2024, 1, 10)
    line = _line(line_id=1, description="amazon", vendor="amazon", transaction_date=d)
    r1 = _receipt(receipt_id=1, vendor="amazon", charged_amount="10.00", billing_date=d)
    r2 = _receipt(receipt_id=2, vendor="amazon", charged_amount="10.00", billing_date=d)
    c1 = calculate_confidence(line, r1, cfg)
    c2 = calculate_confidence(line, r2, cfg)
    assert c1 == c2
    k1 = candidate_pair_sort_key(line, r1, c1, cfg)
    k2 = candidate_pair_sort_key(line, r2, c2, cfg)
    assert k1 < k2


def test_candidate_pair_sort_key_orders_closer_date_ahead_when_higher_confidence() -> (
    None
):
    """Closer billing date yields higher confidence here; sort key ranks it first."""
    cfg = MatchConfig()
    line = _line(
        line_id=1,
        description="amazon",
        vendor="amazon",
        transaction_date=date(2024, 1, 1),
    )
    close = _receipt(
        receipt_id=5,
        vendor="amazon",
        charged_amount="10.00",
        billing_date=date(2024, 1, 2),
    )
    far = _receipt(
        receipt_id=6,
        vendor="amazon",
        charged_amount="10.00",
        billing_date=date(2024, 1, 5),
    )
    c_close = calculate_confidence(line, close, cfg)
    c_far = calculate_confidence(line, far, cfg)
    assert c_close > c_far
    k_close = candidate_pair_sort_key(line, close, c_close, cfg)
    k_far = candidate_pair_sort_key(line, far, c_far, cfg)
    assert k_close < k_far


def test_pass1a_maximum_matching_resolves_conflict() -> None:
    """Two lines and two receipts all with same amount+date: should match both, not one."""
    d = date(2024, 3, 1)
    lines = [
        _line(line_id=10, description="a", charge="5.00", transaction_date=d),
        _line(line_id=20, description="b", charge="5.00", transaction_date=d),
    ]
    receipts = [
        _receipt(receipt_id=100, vendor="x", charged_amount="5.00", billing_date=d),
        _receipt(receipt_id=200, vendor="y", charged_amount="5.00", billing_date=d),
    ]
    pairs = _pass1a_assignment_pairs(lines, receipts)
    assert len(pairs) == 2
    used_lines = {p[0].line_id for p in pairs}
    used_rcp = {p[1].receipt_id for p in pairs}
    assert used_lines == {10, 20}
    assert used_rcp == {100, 200}


def test_pass1b_max_weight_matching() -> None:
    """Hungarian should prefer total confidence over greedy local choice."""
    cfg = MatchConfig(confidence_threshold=75, max_date_window=30)
    base = date(2024, 4, 1)
    lines = [
        _line(
            line_id=1,
            description="amazon",
            vendor="amazon",
            charge="10.00",
            transaction_date=base,
        ),
        _line(
            line_id=2,
            description="target",
            vendor="target",
            charge="10.00",
            transaction_date=base,
        ),
    ]
    receipts = [
        _receipt(
            receipt_id=1, vendor="amazon", charged_amount="10.00", billing_date=base
        ),
        _receipt(
            receipt_id=2, vendor="target", charged_amount="10.00", billing_date=base
        ),
    ]
    pairs = _pass1b_assignment_pairs(lines, receipts, cfg)
    assert len(pairs) == 2
    by_line = {p[0].line_id: p[1].receipt_id for p in pairs}
    assert by_line[1] == 1
    assert by_line[2] == 2
