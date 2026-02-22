from datetime import date
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import MatchStatus
from app.models.base import Base, TimestampMixin


class BankStatement(Base, TimestampMixin):
    __tablename__ = "bank_statements"

    statement_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("account_books.account_id"), nullable=False
    )
    month: Mapped[int] = mapped_column(nullable=False)
    year: Mapped[int] = mapped_column(nullable=False)
    account_number_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD", server_default="USD"
    )
    document: Mapped[Optional["Document"]] = relationship(
        "Document", back_populates="bank_statement", uselist=False
    )
    lines: Mapped[List["BankStatementLine"]] = relationship(
        "BankStatementLine",
        back_populates="bank_statement",
        cascade="all, delete-orphan",
    )
    account: Mapped["AccountBook"] = relationship(
        "AccountBook", back_populates="bank_statements"
    )


class BankStatementLine(Base, TimestampMixin):
    __tablename__ = "bank_statement_lines"

    line_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    statement_id: Mapped[int] = mapped_column(
        ForeignKey("bank_statements.statement_id", ondelete="CASCADE"), nullable=False
    )
    line_number: Mapped[int] = mapped_column(nullable=False)
    reference_number: Mapped[str] = mapped_column(String(255), nullable=False)
    transaction_date: Mapped[date] = mapped_column(nullable=False)
    posting_date: Mapped[date] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    vendor: Mapped[str] = mapped_column(
        String(255), nullable=False
    )  # normalized vendor name from description.
    mcc: Mapped[str] = mapped_column(String(10), nullable=True)
    charge: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD", server_default="USD"
    )

    match_status: Mapped[MatchStatus] = mapped_column(
        Enum(MatchStatus, name="statement_line_match_status_enum", native_enum=False),
        nullable=False,
        default=MatchStatus.unmatched,
    )

    bank_statement: Mapped["BankStatement"] = relationship(
        "BankStatement", back_populates="lines"
    )
