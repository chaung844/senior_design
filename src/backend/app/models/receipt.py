from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import MatchStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.statement import BankStatement
    from app.models.reconciliation import ReconciliationMatch


class Receipt(Base, TimestampMixin):
    __tablename__ = "receipts"

    receipt_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    vendor: Mapped[str] = mapped_column(String(255), nullable=False)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    billing_date: Mapped[date] = mapped_column(nullable=False)
    charged_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD", server_default="USD"
    )
    description: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    expense_type: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True
    )  # might need to change to enum later

    match_status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="receipt_match_status_enum", native_enum=False),
        nullable=False,
        default=MatchStatus.unmatched,
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    document: Mapped[Optional["Document"]] = relationship(
        "Document", back_populates="receipt", uselist=False
    )
    statement_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("bank_statements.statement_id", ondelete="SET NULL"),
        nullable=True,
    )
    bank_statement: Mapped[Optional["BankStatement"]] = relationship(
        "BankStatement", back_populates="receipts"
    )
    matches: Mapped[List["ReconciliationMatch"]] = relationship(
        "ReconciliationMatch", back_populates="receipt", cascade="all, delete-orphan"
    )
