from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import Enum, String, event, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import UserRole
from app.models.base import Base, TimestampMixin
from app.models.reconciliation import ReconciliationMatch

if TYPE_CHECKING:
    from app.models.account_book import AccountBook
    from app.models.account_book_member import AccountBookMember
    from app.models.document import Document
    from app.models.job import Job


class User(Base, TimestampMixin):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", native_enum=False),
        nullable=False,
        default=UserRole.viewer,
    )
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True)

    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    uploaded_documents: Mapped[List["Document"]] = relationship(
        "Document", back_populates="uploader", cascade="save-update, merge"
    )

    account_books: Mapped[List["AccountBook"]] = relationship(
        "AccountBook", back_populates="user", cascade="save-update, merge"
    )

    account_memberships: Mapped[List["AccountBookMember"]] = relationship(
        "AccountBookMember", back_populates="user", cascade="all, delete-orphan"
    )

    jobs_created: Mapped[List["Job"]] = relationship(
        "Job", back_populates="creator", cascade="save-update, merge"
    )

    reconciliation_matches_created: Mapped[List["ReconciliationMatch"]] = relationship(
        "ReconciliationMatch",
        back_populates="created_by_user",
        foreign_keys=[ReconciliationMatch.created_by],
    )
    reconciliation_matches_updated: Mapped[List["ReconciliationMatch"]] = relationship(
        "ReconciliationMatch",
        back_populates="updated_by_user",
        foreign_keys=[ReconciliationMatch.updated_by],
    )

    def __repr__(self) -> str:
        return (
            f"<User(user_id={self.user_id}, email='{self.email}', role='{self.role}')>"
        )


@event.listens_for(User, "before_insert")
def normalize_email(mapper, connection, target):
    if target.email:
        target.email = target.email.lower().strip()
