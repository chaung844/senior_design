from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import JobStatus, JobType
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.reconciliation import ReconciliationMatch
    from app.models.user import User


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    job_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    job_type: Mapped[JobType] = mapped_column(
        Enum(JobType, name="job_type_enum", native_enum=False),
        nullable=False,
        default=JobType.reconciliation,
    )
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status_enum", native_enum=False),
        nullable=False,
        default=JobStatus.pending,
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False
    )
    document_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("documents.document_id", ondelete="SET NULL"),
        nullable=True,
    )

    creator: Mapped["User"] = relationship("User", back_populates="jobs_created")
    document: Mapped[Optional["Document"]] = relationship("Document")
    matches: Mapped[List["ReconciliationMatch"]] = relationship(
        "ReconciliationMatch", back_populates="job", cascade="all, delete-orphan"
    )
