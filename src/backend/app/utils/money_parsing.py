"""Strict parsing of monetary amounts for statements and receipts.

Convention:
- Debits / charges: positive
- Credits / refunds: negative
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any


def parse_money_amount(raw: Any, *, field_name: str = "amount") -> Decimal:
    """Parse a money string into a signed Decimal (2 decimal places).

    Recognizes:
    - Leading minus
    - Parentheses for credits: (10.34) -> -10.34
    - Trailing CR / CREDIT (case-insensitive) -> negative magnitude
    - Strips $, commas, whitespace

    Raises:
        ValueError: missing, invalid, or non-finite amount.
    """
    if raw is None:
        raise ValueError(f"Missing required field '{field_name}'")

    s = str(raw).strip()
    if not s or s.lower() == "n/a":
        raise ValueError(f"Missing required field '{field_name}'")

    lower = s.lower()
    credit_suffix = bool(re.search(r"\b(cr|credit)\b", lower))
    # Strip credit words for numeric extraction
    s_clean = re.sub(r"\b(cr|credit)\b", "", lower, flags=re.IGNORECASE).strip()

    negative = False
    if s_clean.startswith("-"):
        negative = True
        s_clean = s_clean[1:].strip()
    elif s_clean.startswith("(") and s_clean.endswith(")"):
        negative = True
        s_clean = s_clean[1:-1].strip()

    if credit_suffix:
        negative = True

    # Keep digits and single decimal point
    s_clean = s_clean.replace("$", "").replace(",", "").strip()
    s_clean = re.sub(r"[^0-9.]", "", s_clean)

    if not s_clean or s_clean == ".":
        raise ValueError(f"Cannot parse '{field_name}': no numeric value in {raw!r}")

    parts = s_clean.split(".")
    if len(parts) > 2:
        raise ValueError(f"Cannot parse '{field_name}': invalid number {raw!r}")

    try:
        value = Decimal(s_clean)
    except InvalidOperation as e:
        raise ValueError(f"Cannot parse '{field_name}': {raw!r}") from e

    if value.is_nan() or value.is_infinite():
        raise ValueError(f"Invalid '{field_name}': non-finite value {raw!r}")

    if negative:
        value = -value

    return value.quantize(Decimal("0.01"))
