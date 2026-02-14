from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from .user import UserRead
from decimal import Decimal

class BankStatementBase(BaseModel):
    month: date
    account_holder: str
    account_number_last4: str = Field(..., pattern=r'^\d{4}$') 
    total_amount: Decimal
    currency: str = "USD"

class BankStatementRead(BankStatementBase):
    statement_id: int
    uploaded_by: UserRead
    created_at: datetime
    file_path: str # S3 path
    model_config = ConfigDict(from_attributes=True)