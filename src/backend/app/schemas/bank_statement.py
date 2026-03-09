from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.bank_statement_line import BankStatementLineRead

# A month is considered reconciled when its match rate meets or exceeds this threshold (%).
RECONCILE_THRESHOLD = 90.0


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
    matched_count: int = 0
    unmatched_count: int = 0
    match_rate: float = 0.0
    reconciled: bool = False

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def _compute_derived(self) -> "BankStatementRead":
        """Derive match_rate and reconciled from raw counts after construction."""
        if self.line_count > 0:
            self.match_rate = round((self.matched_count / self.line_count) * 1000) / 10
            self.reconciled = self.match_rate >= RECONCILE_THRESHOLD
        else:
            self.match_rate = 0.0
            self.reconciled = False
        return self


class BankStatementDetailRead(BankStatementRead):
    lines: list[BankStatementLineRead] = []


class BankStatementUpdate(BaseModel):
    month: Optional[int] = Field(default=None, ge=1, le=12)
    year: Optional[int] = Field(default=None, ge=2000, le=2100)
    account_number_last4: Optional[str] = Field(
        default=None, min_length=4, max_length=4
    )
    currency: Optional[str] = Field(default=None, min_length=3, max_length=3)
    total_amount: Optional[Decimal] = None


class BankStatementListResponse(BaseModel):
    statements: list[BankStatementRead]
    total: int
    offset: int
    limit: int
