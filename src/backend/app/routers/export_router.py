"""Account-book structured data exports (CSV / ZIP)."""

import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas.export_validation import (
    InvalidExportRangeError,
    validate_month_year_range,
)
from app.services import vendor_sheet_export
from app.utils.access import require_account_access, require_any
router = APIRouter(prefix="/accounts", tags=["export"])

_FILENAME_SAFE = frozenset(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_."
)


def _ascii_filename(base: str, ext: str) -> str:
    safe = "".join(c if c in _FILENAME_SAFE else "-" for c in base)[:180]
    return f"{safe}.{ext}"


@router.get("/{account_id}/export/vendor-sheet")
async def export_account_vendor_sheet(
    account_id: int,
    start_year: Annotated[int, Query(ge=1900, le=3000)],
    start_month: Annotated[int, Query(ge=1, le=12)],
    end_year: Annotated[int, Query(ge=1900, le=3000)],
    end_month: Annotated[int, Query(ge=1, le=12)],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_any),
):
    """
    Download vendor-sheet CSV for matched statement lines in the account book,
    across statements whose (year, month) falls in the inclusive range.

    More than 1,000,000 data rows returns ``application/zip``
    with multiple CSV parts (header repeated in each part).
    """
    await require_account_access(account_id, current_user, db)

    try:
        start_ord, end_ord = validate_month_year_range(
            start_year, start_month, end_year, end_month
        )
    except InvalidExportRangeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    count = await vendor_sheet_export.vendor_sheet_row_count(
        db, account_id, start_ord, end_ord
    )

    base_name = f"vendor-sheet-{account_id}-{start_year}{start_month:02d}-{end_year}{end_month:02d}"

    if count > vendor_sheet_export.MAX_ROWS_PER_FILE:

        async def zip_chunks():
            tf = await vendor_sheet_export.build_vendor_sheet_zip_spooled(
                db, account_id, start_ord, end_ord
            )
            try:
                while True:
                    chunk = await asyncio.to_thread(tf.read, 65_536)
                    if not chunk:
                        break
                    yield chunk
            finally:
                tf.close()

        return StreamingResponse(
            zip_chunks(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{_ascii_filename(base_name, "zip")}"',
            },
        )

    return StreamingResponse(
        vendor_sheet_export.stream_vendor_sheet_csv(
            db, account_id, start_ord, end_ord
        ),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{_ascii_filename(base_name, "csv")}"',
        },
    )
