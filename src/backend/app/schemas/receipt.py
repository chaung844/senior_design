from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from .user import UserRead
from typing import Optional
from decimal import Decimal
from .enums import MatchStatus

class ReceiptBase(BaseModel):
    vendor: str
    invoice_number: Optional[str] = None
    billing_date: date
    charged_amount: Decimal
    billing_to_name: str
    account_charged_last4: str = Field(..., pattern=r'^\d{4}$')
    currency: str = "USD"

class ReceiptRead(ReceiptBase):
    receipt_id: int
    uploaded_by: UserRead
    created_at: datetime
    file_path: str # S3 path
    description: Optional[str] = None
    expense_type: Optional[str] = None
    match_status: MatchStatus
    model_config = ConfigDict(from_attributes=True)