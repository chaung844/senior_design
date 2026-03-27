"""Strict Pydantic shapes for VLM YAML outputs (receipts, statement metadata)."""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, field_validator


class ReceiptParsingYAML(BaseModel):
    """Expected YAML from receipt VLM parsing."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    vendor: str
    invoice_number: str | None = None
    date: date
    total: Decimal
    purchase_desc: str | None = None

    @field_validator("date", mode="before")
    @classmethod
    def coerce_date(cls, v: Any) -> date:
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            s = v.strip()
            if s.lower() == "n/a" or s == "":
                return date.today()  # default to today if vlm cannot provide a date
            from app.utils.date_parsing import parse_iso_date

            return parse_iso_date(v, field_name="date")
        raise ValueError(f"Invalid date value: {v!r}")

    @field_validator("total", mode="before")
    @classmethod
    def coerce_total(cls, v: Any) -> Decimal:
        from app.utils.money_parsing import parse_money_amount

        return parse_money_amount(v, field_name="total")

    @field_validator("vendor", mode="before")
    @classmethod
    def vendor_required(cls, v: str) -> str:
        if not v or v.strip().lower() in ("n/a", "unknown") or v.strip() == "":
            # raise ValueError("vendor is required and must not be empty or placeholder")
            # default to "unknown"
            return "unknown vendor"
        return v.strip()

    @field_validator("invoice_number", "purchase_desc", mode="before")
    @classmethod
    def empty_to_none(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        if not s or s.lower() == "n/a":
            return None
        return s


class ReceiptCategorizationYAML(BaseModel):
    """Expected YAML from receipt expense categorization."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    expense_type: str | None = None

    @field_validator("expense_type", mode="before")
    @classmethod
    def empty_expense_to_none(cls, v: Any) -> str | None:
        if v is None:
            return None
        s = str(v).strip()
        if not s or s.lower() == "n/a":
            return None
        return s


class BankStatementMetadataYAML(BaseModel):
    """Expected YAML from bank statement metadata VLM parsing."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    statement_date: date
    last_4_digits: str

    @field_validator("statement_date", mode="before")
    @classmethod
    def coerce_statement_date(cls, v: Any) -> date:
        if isinstance(v, datetime):
            return v.date()
        if isinstance(v, date):
            return v
        if isinstance(v, str):
            from app.utils.date_parsing import parse_iso_date

            return parse_iso_date(v, field_name="statement_date")
        raise ValueError(f"Invalid statement_date: {v!r}")

    @field_validator("last_4_digits", mode="before")
    @classmethod
    def normalize_last_four(cls, v: Any) -> str:
        if v is None:
            raise ValueError("last_4_digits is required")
        digits = re.sub(r"\D", "", str(v))
        if len(digits) >= 4:
            return digits[-4:]
        if len(digits) == 0:
            raise ValueError("last_4_digits must contain digits")
        return digits.zfill(4)
