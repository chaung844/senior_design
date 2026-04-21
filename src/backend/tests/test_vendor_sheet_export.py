"""Unit tests for vendor sheet export validation and formatting."""

from datetime import date
from decimal import Decimal

import pytest

from app.enums import MatchStatus
from app.schemas.export_validation import (
    InvalidExportRangeError,
    MAX_EXPORT_MONTH_SPAN_INCLUSIVE,
    validate_month_year_range,
)
from app.services.vendor_sheet_export import (
    CSV_HEADERS,
    _coerce_match_status,
    _csv_header_line,
    _format_csv_row,
    csv_escape_field,
    invoice_type_from_charge,
    match_type_label,
)


def test_validate_month_year_range_ok() -> None:
    assert validate_month_year_range(2024, 1, 2024, 12) == (2024 * 12 + 1, 2024 * 12 + 12)


def test_validate_rejects_start_after_end() -> None:
    with pytest.raises(InvalidExportRangeError, match="on or before"):
        validate_month_year_range(2024, 6, 2024, 5)


def test_validate_rejects_invalid_month() -> None:
    with pytest.raises(InvalidExportRangeError, match="start_month"):
        validate_month_year_range(2024, 0, 2024, 1)
    with pytest.raises(InvalidExportRangeError, match="end_month"):
        validate_month_year_range(2024, 1, 2024, 13)


def test_validate_span_cap() -> None:
    with pytest.raises(InvalidExportRangeError, match="exceed"):
        validate_month_year_range(2020, 1, 2030, 1)

    start_ord, end_ord = validate_month_year_range(2020, 1, 2029, 12)
    assert end_ord - start_ord + 1 == MAX_EXPORT_MONTH_SPAN_INCLUSIVE


def test_csv_escape_simple() -> None:
    assert csv_escape_field("hello") == "hello"


def test_csv_escape_comma_quote_newline() -> None:
    assert csv_escape_field("a,b") == '"a,b"'
    assert csv_escape_field('say "hi"') == '"say ""hi"""'
    out = csv_escape_field("line1\nline2")
    assert out.startswith('"') and "\n" in out


def test_match_type_labels() -> None:
    assert match_type_label(MatchStatus.bundle_matched) == "bundle match"
    assert match_type_label(MatchStatus.perfect_matched) == "perfect match"
    assert match_type_label(MatchStatus.manual) == "perfect match"
    assert match_type_label(None) == "perfect match"


def test_invoice_type_from_charge() -> None:
    assert invoice_type_from_charge(Decimal("10.00")) == "Standard"
    assert invoice_type_from_charge(Decimal("-5.00")) == "Credit-Memo"


def test_coerce_match_status() -> None:
    assert _coerce_match_status(MatchStatus.bundle_matched) == MatchStatus.bundle_matched
    assert _coerce_match_status("bundle_matched") == MatchStatus.bundle_matched


def test_csv_header_matches_statement_export_columns() -> None:
    expected = [
        "Invoice number on receipt",
        "Invoice Type",
        "Invoice Date",
        "Amount",
        "Description",
        "Match type",
    ]
    assert CSV_HEADERS == expected
    assert _csv_header_line().split(",") == [
        "Invoice number on receipt",
        "Invoice Type",
        "Invoice Date",
        "Amount",
        "Description",
        "Match type",
    ]


def test_format_csv_row_uses_row_mapping() -> None:
    row = _MockRow(
        invoice_ref="INV-1",
        charge=Decimal("12.34"),
        transaction_date=date(2024, 3, 15),
        description='Desc, with comma',
        match_type=MatchStatus.perfect_matched,
    )
    line = _format_csv_row(row)
    assert line.startswith("INV-1,Standard,2024-03-15,12.34,")
    assert line.endswith(",perfect match")
    assert '"Desc, with comma"' in line


def test_csv_part_split_schedule() -> None:
    """How many zip parts are needed for n data rows with a given cap (header-only part counts as 1 file always)."""

    def num_parts(n_rows: int, max_data_rows_per_part: int) -> int:
        if max_data_rows_per_part <= 0:
            raise ValueError
        if n_rows == 0:
            return 1
        parts = 1
        filled = 0
        for _ in range(n_rows):
            if filled >= max_data_rows_per_part:
                parts += 1
                filled = 0
            filled += 1
        return parts

    assert num_parts(0, 3) == 1
    assert num_parts(1, 3) == 1
    assert num_parts(3, 3) == 1
    assert num_parts(4, 3) == 2
    assert num_parts(6, 3) == 2
    assert num_parts(7, 3) == 3


class _MockRow:
    """Minimal row protocol for _format_csv_row."""

    __slots__ = ("invoice_ref", "charge", "transaction_date", "description", "match_type")

    def __init__(
        self,
        *,
        invoice_ref: str,
        charge: Decimal,
        transaction_date: date,
        description: str,
        match_type: MatchStatus,
    ) -> None:
        self.invoice_ref = invoice_ref
        self.charge = charge
        self.transaction_date = transaction_date
        self.description = description
        self.match_type = match_type
