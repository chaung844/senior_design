"""Tests for app.utils.money_parsing."""

from decimal import Decimal

import pytest

from app.utils.money_parsing import parse_money_amount


def test_debit_positive() -> None:
    assert parse_money_amount("10.34") == Decimal("10.34")
    assert parse_money_amount("$1,234.56") == Decimal("1234.56")


def test_credit_parentheses() -> None:
    assert parse_money_amount("(10.34)") == Decimal("-10.34")


def test_credit_minus() -> None:
    assert parse_money_amount("-10.34") == Decimal("-10.34")


def test_credit_cr_suffix() -> None:
    assert parse_money_amount("10.34 CR") == Decimal("-10.34")
    assert parse_money_amount("5.00 credit") == Decimal("-5.00")


def test_invalid_raises() -> None:
    for bad in ("", "n/a", "N/A", None, "nan", "ten dollars"):
        with pytest.raises(ValueError):
            parse_money_amount(bad)
