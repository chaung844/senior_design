from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.enums import MatchStatus

from .user import UserRead


class ReceiptBase(BaseModel):
    vendor: str
    invoice_number: Optional[str] = None
    billing_date: date
    charged_amount: Decimal
    currency: str = "USD"


class ReceiptRead(ReceiptBase):
    receipt_id: int
    uploaded_by: UserRead
    created_at: datetime
    file_path: str  # S3 path
    description: Optional[str] = None
    expense_type: Optional[str] = None
    match_status: MatchStatus
    model_config = ConfigDict(from_attributes=True)
