from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import MatchStatus
from app.models.base import Base, TimestampMixin


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
    document: Mapped[Optional["Document"]] = relationship(
        "Document", backref="receipt", uselist=False, cascade="all, delete-orphan"
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

    uploaded_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"),
    )

    uploader: Mapped[Optional["User"]] = relationship(
        "User", back_populates="uploaded_receipts"
    )
