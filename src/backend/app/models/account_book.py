from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import AccountType
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.account_book_member import AccountBookMember
    from app.models.statement import BankStatement
    from app.models.user import User


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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, default=None)

    user: Mapped["User"] = relationship(back_populates="account_books")
    bank_statements: Mapped[List["BankStatement"]] = relationship(
        "BankStatement", back_populates="account", cascade="all, delete-orphan"
    )
    members: Mapped[List["AccountBookMember"]] = relationship(
        "AccountBookMember", back_populates="account_book", cascade="all, delete-orphan"
    )
