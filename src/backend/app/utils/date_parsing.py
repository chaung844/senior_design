"""Strict date parsing for LLM outputs and statement line text."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any


def parse_iso_date(raw: Any, *, field_name: str = "date") -> date:
    """Parse YYYY-MM-DD. Raises on missing or invalid input."""
    if raw is None:
        raise ValueError(f"Missing required field '{field_name}'")

    s = str(raw).strip()
    if not s or s.lower() == "n/a":
        raise ValueError(f"Missing required field '{field_name}'")

    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except ValueError as e:
        raise ValueError(
            f"Invalid date for '{field_name}': expected YYYY-MM-DD, got {raw!r}"
        ) from e


def parse_mmdd_with_year(
    raw: Any,
    *,
    statement_date: date,
    field_name: str = "date",
) -> date:
    """Parse MM/DD and infer calendar year from statement_date.

    If parsed month < statement_date.month, use statement_date.year + 1
    (statements spanning Dec–Jan).
    """
    if raw is None:
        raise ValueError(f"Missing required field '{field_name}'")

    s = str(raw).strip()
    if not s or s.lower() == "n/a":
        raise ValueError(f"Missing required field '{field_name}'")

    parts = s.split("/")
    if len(parts) != 2:
        raise ValueError(
            f"Invalid date for '{field_name}': expected MM/DD, got {raw!r}"
        )

    try:
        month = int(parts[0])
        day = int(parts[1])
    except ValueError as e:
        raise ValueError(
            f"Invalid date for '{field_name}': expected MM/DD, got {raw!r}"
        ) from e

    year = statement_date.year
    if month < statement_date.month:
        year += 1

    try:
        return date(year, month, day)
    except ValueError as e:
        raise ValueError(
            f"Invalid calendar date for '{field_name}': {month}/{day}/{year}"
        ) from e
