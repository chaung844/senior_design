from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.statement import BankStatementLine


class ReconciliationLineSummary(Base):
    """AI-generated analysis for an unmatched statement line after reconciliation."""

    __tablename__ = "reconciliation_line_summaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        ForeignKey("jobs.job_id", ondelete="CASCADE"), nullable=False
    )
    line_id: Mapped[int] = mapped_column(
        ForeignKey("bank_statement_lines.line_id", ondelete="CASCADE"), nullable=False
    )
    statement_id: Mapped[int] = mapped_column(
        Integer, nullable=False, index=True
    )
    top_candidates: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    ai_analysis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    job: Mapped["Job"] = relationship("Job", backref="line_summaries")
    line: Mapped["BankStatementLine"] = relationship("BankStatementLine")
