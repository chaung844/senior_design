from datetime import date
from typing import List

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import AccountType
from app.models.base import Base, TimestampMixin


class AccountBook(Base, TimestampMixin):
    __tablename__ = "account_books"

    account_id: Mapped[int] = mapped_column(primary_key=True)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_name: Mapped[str] = mapped_column(String(100), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType), nullable=False, default=AccountType.credit_card
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="USD", server_default="USD"
    )
    account_number_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    created_at: Mapped[date] = mapped_column(default=date.today)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    user: Mapped["User"] = relationship(back_populates="account_books")

    transactions: Mapped[List["Transaction"]] = relationship(
        back_populates="account_book"
    )
