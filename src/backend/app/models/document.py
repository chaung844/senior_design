from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import DocumentStatus, DocumentType
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.receipt import Receipt
    from app.models.statement import BankStatement
    from app.models.user import User


class Document(Base, TimestampMixin):
    __tablename__ = "documents"

    document_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    uploaded_by: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.user_id", ondelete="SET NULL"),
    )
    file_name: Mapped[str] = mapped_column(String(255))
    document_type: Mapped[DocumentType] = mapped_column(
        Enum(DocumentType, name="document_type_enum", native_enum=False),
        nullable=False,
    )
    s3_key: Mapped[str] = mapped_column(
        String(512), unique=True, nullable=False
    )  # S3 path
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status_enum", native_enum=False),
        nullable=False,
        default=DocumentStatus.pending_upload,
    )
    error_message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    account_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("account_books.account_id", ondelete="SET NULL"),
        nullable=True,
    )
    receipt_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("receipts.receipt_id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    statement_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("bank_statements.statement_id", ondelete="SET NULL"),
        nullable=True,
        unique=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )
    # Relationships
    uploader: Mapped[Optional["User"]] = relationship(
        "User", back_populates="uploaded_documents"
    )
    receipt: Mapped[Optional["Receipt"]] = relationship(
        "Receipt", back_populates="document"
    )
    bank_statement: Mapped[Optional["BankStatement"]] = relationship(
        "BankStatement", back_populates="document"
    )
