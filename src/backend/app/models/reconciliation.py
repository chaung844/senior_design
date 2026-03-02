from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import MatchStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.job import Job
    from app.models.receipt import Receipt
    from app.models.statement import BankStatementLine
    from app.models.user import User


class ReconciliationMatch(Base, TimestampMixin):
    __tablename__ = "reconciliation_matches"
    __table_args__ = (
        UniqueConstraint(
            "line_id", "receipt_id", name="uq_reconciliation_line_receipt"
        ),
    )

    match_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("jobs.job_id", ondelete="SET NULL"), nullable=True
    )
    line_id: Mapped[int] = mapped_column(
        ForeignKey("bank_statement_lines.line_id", ondelete="CASCADE"), nullable=False
    )
    receipt_id: Mapped[int] = mapped_column(
        ForeignKey("receipts.receipt_id", ondelete="CASCADE"), nullable=False
    )

    reconciliation_ref: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )
    match_type: Mapped[MatchStatus] = mapped_column(
        Enum(
            MatchStatus,
            name="reconciliation_match_status_enum",
            native_enum=False,
        ),
        nullable=False,
    )
    # confidence_score: Mapped[Optional[Decimal]] = mapped_column(
    #     Numeric(5, 4), nullable=True
    # )

    matched_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    created_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True
    )

    job: Mapped[Optional["Job"]] = relationship("Job", back_populates="matches")
    line: Mapped["BankStatementLine"] = relationship(
        "BankStatementLine", back_populates="matches"
    )
    receipt: Mapped["Receipt"] = relationship("Receipt", back_populates="matches")
    created_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="reconciliation_matches_created",
    )
    updated_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by],
        back_populates="reconciliation_matches_updated",
    )
