from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.enums import MatchStatus


class ReconciliationMatchRead(BaseModel):
    match_id: int
    job_id: Optional[int] = None
    line_id: int
    receipt_id: int
    match_type: MatchStatus
    # confidence_score: Optional[Decimal] = None
    matched_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReconciliationMatchListResponse(BaseModel):
    matches: list[ReconciliationMatchRead]
    total: int
    offset: int
    limit: int
