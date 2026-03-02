from typing import TYPE_CHECKING, List

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.enums import JobStatus
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.reconciliation import ReconciliationMatch
    from app.models.user import User


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    job_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status_enum", native_enum=False),
        nullable=False,
        default=JobStatus.pending,
    )
    created_by: Mapped[int] = mapped_column(
        ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False
    )

    creator: Mapped["User"] = relationship("User", back_populates="jobs_created")
    matches: Mapped[List["ReconciliationMatch"]] = relationship(
        "ReconciliationMatch", back_populates="job", cascade="all, delete-orphan"
    )
