from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """Adds ``created_at`` and ``updated_at`` columns to any ORM model."""

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SoftDeleteMixin:
    """
    7.5 — Centralised soft-delete support.

    Any model that inherits from this mixin gets a ``deleted_at`` column and
    two helpers:

    * ``is_deleted``  — instance-level property; ``True`` when the row is
                        soft-deleted.
    * ``soft_delete(now)`` — sets ``deleted_at`` to the supplied timestamp
                             (defaults to the current UTC time).

    **How to filter in queries:**

    Always use the SQLAlchemy column expression directly in ``.where()``::

        # ✅ Correct — filters out soft-deleted rows
        stmt = select(Document).where(Document.deleted_at.is_(None))

        # ✅ Helper expression for convenience
        stmt = select(Document).where(Document.not_deleted())

    The ``not_deleted()`` classmethod returns a ready-made ``ColumnElement``
    so you never have to remember the raw ``deleted_at.is_(None)`` idiom::

        base_filter = [Document.not_deleted(), AccountBook.not_deleted()]

    **Why not a query-level default?**

    SQLAlchemy's ``with_loader_criteria()`` / mapper-level filter-by can add
    a global default, but they interact subtly with joins and eager-loads.
    An explicit, cheap classmethod keeps queries transparent and debuggable
    while still providing a single, typo-proof call site.
    """

    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        nullable=True,
        default=None,
        index=True,  # speeds up the IS NULL check on large tables
    )

    @property
    def is_deleted(self) -> bool:
        """Return ``True`` if this row has been soft-deleted."""
        return self.deleted_at is not None

    def soft_delete(self, now: Optional[datetime] = None) -> None:
        """
        Mark this row as deleted.

        Parameters
        ----------
        now:
            The timestamp to record.  When omitted, the current UTC time is
            used.  Pass an explicit value in tests for deterministic results.
        """
        if now is None:
            from datetime import timezone

            now = datetime.now(timezone.utc)
        self.deleted_at = now

    @classmethod
    def not_deleted(cls):
        """
        Return a SQLAlchemy column expression that filters out soft-deleted rows.

        Usage::

            stmt = select(Document).where(Document.not_deleted())

        This is equivalent to ``Document.deleted_at.is_(None)`` but gives a
        single, searchable call site so that future changes (e.g. adding a
        boolean ``is_active`` column) only need to be made in one place.
        """
        return cls.deleted_at.is_(None)
