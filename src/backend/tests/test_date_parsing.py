"""Tests for app.utils.date_parsing."""

from datetime import date

import pytest

from app.utils.date_parsing import parse_iso_date, parse_mmdd_with_year


def test_parse_iso_date() -> None:
    assert parse_iso_date("2024-06-15") == date(2024, 6, 15)


def test_parse_iso_date_invalid() -> None:
    with pytest.raises(ValueError):
        parse_iso_date("06/15/2024")
    with pytest.raises(ValueError):
        parse_iso_date(None)
    with pytest.raises(ValueError):
        parse_iso_date("n/a")


def test_parse_mmdd_year_rollover() -> None:
    stmt = date(2024, 12, 1)
    # January line on Dec statement -> next year
    assert parse_mmdd_with_year("01/15", statement_date=stmt, field_name="tx") == date(
        2025, 1, 15
    )


def test_parse_mmdd_same_year() -> None:
    # Legacy rule: year+1 only when parsed month < statement month (Dec/Jan span).
    stmt = date(2024, 3, 1)
    assert parse_mmdd_with_year("03/15", statement_date=stmt) == date(2024, 3, 15)
