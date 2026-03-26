"""Tests for PDF statement charge cell parsing."""

from decimal import Decimal

from app.utils.pdf_plumber import parse_statement_charge


def test_parse_statement_charge_delegates_sign_rules() -> None:
    assert parse_statement_charge("42.00") == Decimal("42.00")
    assert parse_statement_charge("(1.50)") == Decimal("-1.50")
