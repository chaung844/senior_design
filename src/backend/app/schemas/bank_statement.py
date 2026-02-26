from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.bank_statement_line import BankStatementLineRead


class BankStatementRead(BaseModel):
    statement_id: int
    account_id: int
    month: int
    year: int
    account_number_last4: str
    total_amount: Decimal
    currency: str
    created_at: datetime
    document_id: Optional[int] = None
    file_name: Optional[str] = None
    line_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class BankStatementDetailRead(BankStatementRead):
    lines: list[BankStatementLineRead] = []


class BankStatementListResponse(BaseModel):
    statements: list[BankStatementRead]
    total: int
    offset: int
    limit: int
