from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

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


class BankStatementLineCreate(BaseModel):
    """Request body for manually adding a new line to a statement.

    ``line_number`` is auto-assigned by the server (MAX + 1).
    ``reference_number`` defaults to ``"MANUAL"`` when not supplied.
    """

    transaction_date: date
    posting_date: date
    description: str = Field(..., max_length=512)
    vendor: str = Field(..., max_length=255)
    charge: Decimal
    currency: str = Field(default="USD", min_length=3, max_length=3)
    mcc: Optional[str] = Field(default=None, max_length=10)
    reference_number: str = Field(default="MANUAL", max_length=255)


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
