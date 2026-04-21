"""Generate vendor-sheet CSV (matched lines) for an account book and date range."""

from __future__ import annotations

import csv
from datetime import date
import io
import tempfile
import zipfile
from collections.abc import AsyncIterator
from decimal import Decimal
from typing import Any, Protocol, cast

from sqlalchemy import Select, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums import MatchStatus
from app.models.receipt import Receipt
from app.models.reconciliation import ReconciliationMatch
from app.models.statement import BankStatement, BankStatementLine
from app.schemas.export_validation import MAX_VENDOR_SHEET_ROWS_PER_PART


class VendorSheetRow(Protocol):
    invoice_ref: str | None
    charge: Decimal
    transaction_date: date
    description: str | None
    match_type: object

CSV_HEADERS = [
    "Invoice number on receipt",
    "Invoice Type",
    "Invoice Date",
    "Amount",
    "Description",
    "Match type",
]

# Tests may patch this module attribute to assert splitting without 1M rows.
MAX_ROWS_PER_FILE = MAX_VENDOR_SHEET_ROWS_PER_PART


def csv_escape_field(value: str | None) -> str:
    if value is None:
        return ""
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="")
    writer.writerow([value])
    return buf.getvalue()


def match_type_label(match_status: MatchStatus | None) -> str:
    if match_status == MatchStatus.bundle_matched:
        return "bundle match"
    return "perfect match"


def invoice_type_from_charge(charge: Decimal) -> str:
    return "Standard" if charge > 0 else "Credit-Memo"


def _vendor_sheet_base_filter(
    account_id: int,
    start_ord: int,
    end_ord: int,
) -> list[Any]:
    ym = BankStatement.year * 12 + BankStatement.month
    return [
        BankStatement.account_id == account_id,
        BankStatementLine.match_status != MatchStatus.unmatched,
        ym.between(start_ord, end_ord),
    ]


def vendor_sheet_line_count_stmt(account_id: int, start_ord: int, end_ord: int) -> Select:
    return (
        select(func.count())
        .select_from(BankStatementLine)
        .join(
            BankStatement,
            BankStatement.statement_id == BankStatementLine.statement_id,
        )
        .where(*_vendor_sheet_base_filter(account_id, start_ord, end_ord))
    )


def vendor_sheet_rows_stmt(account_id: int, start_ord: int, end_ord: int) -> Select[Any]:
    """
    One row per matched line; pick a receipt row preferring non-empty trimmed description,
    then lowest match_id (PostgreSQL DISTINCT ON).
    """
    receipt_desc = func.coalesce(Receipt.description, "")
    has_receipt_desc = func.length(func.trim(receipt_desc)) > 0
    desc_pref = case((has_receipt_desc, 0), else_=1)

    effective_match_type = func.coalesce(
        ReconciliationMatch.match_type,
        BankStatementLine.match_status,
    )

    return (
        select(
            func.coalesce(
                Receipt.invoice_number,
                BankStatementLine.reference_number,
            ).label("invoice_ref"),
            BankStatementLine.charge.label("charge"),
            BankStatementLine.transaction_date.label("transaction_date"),
            func.coalesce(
                Receipt.description,
                BankStatementLine.description,
            ).label("description"),
            effective_match_type.label("match_type"),
        )
        .distinct(BankStatementLine.line_id)
        .select_from(BankStatementLine)
        .join(
            BankStatement,
            BankStatement.statement_id == BankStatementLine.statement_id,
        )
        .outerjoin(
            ReconciliationMatch,
            ReconciliationMatch.line_id == BankStatementLine.line_id,
        )
        .outerjoin(
            Receipt,
            Receipt.receipt_id == ReconciliationMatch.receipt_id,
        )
        .where(*_vendor_sheet_base_filter(account_id, start_ord, end_ord))
        .order_by(
            BankStatementLine.line_id,
            desc_pref,
            ReconciliationMatch.match_id.asc().nulls_last(),
        )
    )


def _coerce_match_status(raw: object) -> MatchStatus | None:
    if raw is None:
        return None
    if isinstance(raw, MatchStatus):
        return raw
    return MatchStatus(str(raw))


def _format_csv_row(row: VendorSheetRow) -> str:
    charge: Decimal = row.charge
    match_status = _coerce_match_status(row.match_type)

    invoice_num = row.invoice_ref
    inv_type = invoice_type_from_charge(charge)
    inv_date = row.transaction_date.isoformat()
    amount = f"{charge:.2f}"
    desc = row.description or ""
    mtype = match_type_label(match_status)

    return ",".join(
        [
            csv_escape_field(str(invoice_num) if invoice_num is not None else ""),
            csv_escape_field(inv_type),
            csv_escape_field(inv_date),
            csv_escape_field(amount),
            csv_escape_field(desc),
            csv_escape_field(mtype),
        ]
    )


def _csv_header_line() -> str:
    return ",".join(csv_escape_field(h) for h in CSV_HEADERS)


async def stream_vendor_sheet_csv(
    db: AsyncSession,
    account_id: int,
    start_ord: int,
    end_ord: int,
) -> AsyncIterator[bytes]:
    """Stream a single CSV (no trailing-only edge cases). Header first."""
    yield (_csv_header_line() + "\n").encode("utf-8")
    stmt = vendor_sheet_rows_stmt(account_id, start_ord, end_ord)
    result = await db.stream(stmt)
    try:
        async for row in result:
            yield (_format_csv_row(row) + "\n").encode("utf-8")
    finally:
        await result.close()


async def build_vendor_sheet_zip_spooled(
    db: AsyncSession,
    account_id: int,
    start_ord: int,
    end_ord: int,
) -> tempfile.SpooledTemporaryFile[bytes]:
    """
    Build a zip with one or more CSV parts (each at most MAX_ROWS_PER_FILE data rows).
    Caller must close the returned spooled file when done streaming.
    """
    tf: tempfile.SpooledTemporaryFile[bytes] = tempfile.SpooledTemporaryFile(
        max_size=512 * 1024 * 1024,
        mode="w+b",
    )
    stmt = vendor_sheet_rows_stmt(account_id, start_ord, end_ord)
    result = await db.stream(stmt)
    part_idx = 1
    rows_in_part = 0

    try:
        with zipfile.ZipFile(
            tf,
            mode="w",
            compression=zipfile.ZIP_DEFLATED,
            allowZip64=True,
        ) as zf:
            part_name = f"vendor-sheet-part-{part_idx:03d}.csv"
            entry = cast(
                zipfile.ZipExtFile,
                zf.open(part_name, "w"),
            )
            entry.write((_csv_header_line() + "\n").encode("utf-8"))

            async for row in result:
                if rows_in_part >= MAX_ROWS_PER_FILE:
                    entry.close()
                    part_idx += 1
                    part_name = f"vendor-sheet-part-{part_idx:03d}.csv"
                    entry = cast(
                        zipfile.ZipExtFile,
                        zf.open(part_name, "w"),
                    )
                    entry.write((_csv_header_line() + "\n").encode("utf-8"))
                    rows_in_part = 0

                entry.write((_format_csv_row(row) + "\n").encode("utf-8"))
                rows_in_part += 1

            entry.close()

    finally:
        await result.close()

    tf.seek(0)
    return tf


async def vendor_sheet_row_count(
    db: AsyncSession, account_id: int, start_ord: int, end_ord: int
) -> int:
    stmt = vendor_sheet_line_count_stmt(account_id, start_ord, end_ord)
    return int((await db.execute(stmt)).scalar_one())
