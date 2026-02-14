from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from decimal import Decimal
from app.enums import MatchStatus

class BankStatementLineBase(BaseModel):
    line_number: int
    reference_number: str
    transaction_date: date
    posting_date: date
    description: str
    mcc: str
    charge: Decimal

class BankStatementLineRead(BankStatementLineBase):
    line_id: int
    statement_id: int
    created_at: datetime
    match_status: MatchStatus
    model_config = ConfigDict(from_attributes=True)
