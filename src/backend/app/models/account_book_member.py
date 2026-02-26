from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import AccountBookRole
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.account_book import AccountBook
    from app.models.user import User


class AccountBookMember(Base, TimestampMixin):
    __tablename__ = "account_book_members"
    __table_args__ = (
        UniqueConstraint("account_id", "user_id", name="uq_account_book_member"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("account_books.account_id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[AccountBookRole] = mapped_column(
        Enum(AccountBookRole, name="account_book_role_enum", native_enum=False),
        nullable=False,
        default=AccountBookRole.viewer,
    )

    account_book: Mapped["AccountBook"] = relationship(
        "AccountBook", back_populates="members"
    )
    user: Mapped["User"] = relationship("User", back_populates="account_memberships")
