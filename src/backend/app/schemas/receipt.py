from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.enums import MatchStatus


class ReceiptRead(BaseModel):
    receipt_id: int
    vendor: str
    invoice_number: Optional[str] = None
    billing_date: date
    charged_amount: Decimal
    currency: str
    description: Optional[str] = None
    expense_type: Optional[str] = None
    match_status: MatchStatus
    created_at: datetime
    statement_id: Optional[int] = None
    document_id: Optional[int] = None
    file_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ReceiptUpdate(BaseModel):
    vendor: Optional[str] = None
    invoice_number: Optional[str] = None
    billing_date: Optional[date] = None
    charged_amount: Optional[Decimal] = None
    currency: Optional[str] = None
    description: Optional[str] = None
    expense_type: Optional[str] = None


class ReceiptListResponse(BaseModel):
    receipts: list[ReceiptRead]
    total: int
    offset: int
    limit: int
