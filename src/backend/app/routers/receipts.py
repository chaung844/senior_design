from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.config import get_settings
from app.database import get_db
from app.enums import MatchStatus
from app.models.document import Document
from app.models.receipt import Receipt
from app.models.user import User
from app.schemas.document import FileUrlResponse
from app.schemas.receipt import ReceiptListResponse, ReceiptRead, ReceiptUpdate
from app.services.aws_services import AWSService, generate_file_url, get_aws_service
from app.utils.access import apply_document_access_filter, get_owned_receipt
from app.utils.auth import get_current_user, verify_csrf_token

router = APIRouter(prefix="/receipts", tags=["receipts"])


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
        statement_id=receipt.statement_id,
        document_id=doc.document_id if doc else None,
        file_name=doc.file_name if doc else None,
    )


@router.get("", response_model=ReceiptListResponse)
async def list_receipts(
    match_status: Optional[MatchStatus] = Query(default=None),
    account_id: Optional[int] = Query(default=None),
    statement_id: Optional[int] = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_filter: list[ColumnElement[bool]] = [Document.deleted_at.is_(None)]

    apply_document_access_filter(base_filter, current_user)

    if match_status is not None:
        base_filter.append(Receipt.match_status == match_status)
    if account_id is not None:
        base_filter.append(Document.account_id == account_id)
    if statement_id is not None:
        base_filter.append(Receipt.statement_id == statement_id)

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


@router.patch(
    "/{receipt_id}",
    response_model=ReceiptRead,
    dependencies=[Depends(verify_csrf_token)],
)
async def update_receipt(
    receipt_id: int,
    body: ReceiptUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    receipt = await get_owned_receipt(receipt_id, current_user, db, write=True)

    _RECEIPT_WRITABLE_FIELDS = {
        "vendor",
        "invoice_number",
        "billing_date",
        "charged_amount",
        "currency",
        "description",
        "expense_type",
    }

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    for field, value in update_data.items():
        if field not in _RECEIPT_WRITABLE_FIELDS:
            raise HTTPException(
                status_code=422,
                detail=f"Field '{field}' is not updatable",
            )
        setattr(receipt, field, value)

    await db.commit()
    await db.refresh(receipt, attribute_names=["document"])

    return _receipt_to_read(receipt)


@router.get("/{receipt_id}/file-url", response_model=FileUrlResponse)
async def get_receipt_file_url(
    receipt_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    aws_service: AWSService = Depends(get_aws_service),
):
    receipt = await get_owned_receipt(receipt_id, current_user, db)

    s3_key = receipt.document.s3_key if receipt.document else None
    url = await generate_file_url(
        s3_key,
        aws_service,
        not_found_detail="No document linked to this receipt",
    )

    settings = get_settings()
    return FileUrlResponse(url=url, expires_in=settings.s3_presigned_url_expire_minutes)
