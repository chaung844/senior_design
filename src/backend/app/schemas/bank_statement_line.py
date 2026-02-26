from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.enums import MatchStatus


class BankStatementLineRead(BaseModel):
    line_id: int
    statement_id: int
    line_number: int
    reference_number: str
    transaction_date: date
    posting_date: date
    description: str
    vendor: str
    mcc: Optional[str] = None
    charge: Decimal
    currency: str
    match_status: MatchStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BankStatementLineUpdate(BaseModel):
    description: Optional[str] = None
    vendor: Optional[str] = None
    charge: Optional[Decimal] = None
    transaction_date: Optional[date] = None
    posting_date: Optional[date] = None
    mcc: Optional[str] = None


class BankStatementLineListResponse(BaseModel):
    lines: list[BankStatementLineRead]
    total: int
    offset: int
    limit: int
