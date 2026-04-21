"""Validation for account-book export query parameters."""

MAX_EXPORT_MONTH_SPAN_INCLUSIVE = 120
MAX_VENDOR_SHEET_ROWS_PER_PART = 1_000_000


class InvalidExportRangeError(ValueError):
    """Raised when start/end month-year parameters are invalid."""


def month_year_to_ordinal(year: int, month: int) -> int:
    return year * 12 + month


def validate_month_year_range(
    start_year: int,
    start_month: int,
    end_year: int,
    end_month: int,
) -> tuple[int, int]:
    """
    Validate inclusive [start, end] month-year range.

    Returns ``(start_ord, end_ord)`` where ordinal is ``year * 12 + month``
    for range comparisons in SQL.

    Raises:
        InvalidExportRangeError: invalid month values, inverted range, or span > 10 years.
    """
    if not 1 <= start_month <= 12:
        raise InvalidExportRangeError("start_month must be between 1 and 12")
    if not 1 <= end_month <= 12:
        raise InvalidExportRangeError("end_month must be between 1 and 12")

    start_ord = month_year_to_ordinal(start_year, start_month)
    end_ord = month_year_to_ordinal(end_year, end_month)

    if start_ord > end_ord:
        raise InvalidExportRangeError("start date must be on or before end date")

    inclusive_span = end_ord - start_ord + 1
    if inclusive_span > MAX_EXPORT_MONTH_SPAN_INCLUSIVE:
        raise InvalidExportRangeError(
            f"date range may not exceed {MAX_EXPORT_MONTH_SPAN_INCLUSIVE} months"
        )

    return start_ord, end_ord
