from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.enums import MatchStatus
from app.models.document import Document
from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.document import FileUrlResponse
from app.schemas.receipt import ReceiptListResponse, ReceiptRead, ReceiptUpdate
from app.services.aws_services import AWSService
from app.utils.auth import get_current_user
from app.utils.ownership import get_owned_receipt

router = APIRouter(prefix="/receipts", tags=["receipts"])

aws_service = AWSService()


def _receipt_to_read(receipt: Receipt) -> ReceiptRead:
    doc = receipt.document
    return ReceiptRead(
        receipt_id=receipt.receipt_id,
        vendor=receipt.vendor,
        invoice_number=receipt.invoice_number,
        billing_date=receipt.billing_date,
        charged_amount=receipt.charged_amount,
        currency=receipt.currency,
        description=receipt.description,
        expense_type=receipt.expense_type,
        match_status=receipt.match_status,
        created_at=receipt.created_at,
        document_id=doc.document_id if doc else None,
        file_name=doc.file_name if doc else None,
    )


@router.get("", response_model=ReceiptListResponse)
async def list_receipts(
    match_status: Optional[MatchStatus] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_filter = (
        Document.uploaded_by == current_user.user_id,
        Document.deleted_at.is_(None),
    )
    if match_status is not None:
        base_filter = (*base_filter, Receipt.match_status == match_status)

    count_stmt = (
        select(func.count())
        .select_from(Receipt)
        .join(Document, Document.receipt_id == Receipt.receipt_id)
        .where(*base_filter)
    )
    total = (await db.execute(count_stmt)).scalar_one()

    rows_stmt = (
        select(Receipt)
        .join(Document, Document.receipt_id == Receipt.receipt_id)
        .where(*base_filter)
        .options(joinedload(Receipt.document))
        .order_by(Receipt.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(rows_stmt)
    receipts = result.unique().scalars().all()

    return ReceiptListResponse(
        receipts=[_receipt_to_read(r) for r in receipts],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.get("/{receipt_id}", response_model=ReceiptRead)
async def get_receipt(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    receipt = await get_owned_receipt(receipt_id, current_user, db)
    return _receipt_to_read(receipt)


@router.patch("/{receipt_id}", response_model=ReceiptRead)
async def update_receipt(
    receipt_id: int,
    body: ReceiptUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    receipt = await get_owned_receipt(receipt_id, current_user, db)

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field, value in update_data.items():
        setattr(receipt, field, value)

    await db.commit()
    await db.refresh(receipt, attribute_names=["document"])

    return _receipt_to_read(receipt)


@router.get("/{receipt_id}/file-url", response_model=FileUrlResponse)
async def get_receipt_file_url(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    receipt = await get_owned_receipt(receipt_id, current_user, db)

    if not receipt.document:
        raise HTTPException(
            status_code=404, detail="No document linked to this receipt"
        )

    expires_in = 3600
    url = aws_service.generate_presigned_get_url(
        receipt.document.s3_key, expires_in=expires_in
    )
    if not url:
        raise HTTPException(
            status_code=500, detail="Failed to generate download URL"
        )

    return FileUrlResponse(url=url, expires_in=expires_in)
