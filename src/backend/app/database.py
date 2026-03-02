import logging

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings

logger = logging.getLogger("matcha.db")

settings = get_settings()
DATABASE_URL = settings.database_url.get_secret_value()

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.debug,
    future=True,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=5,
    max_overflow=10,
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
    autoflush=False,
)


async def get_db():
    """
    FastAPI dependency that yields an async database session.

    7.6 — Explicit rollback on error:
    If the route handler raises *any* exception after the session was opened,
    we explicitly roll back before closing so that:
      - any un-flushed changes are discarded, and
      - the connection is returned to the pool in a clean state even when
        the handler called ``session.flush()`` mid-request.

    The ``finally`` block always closes the session (and returns the
    underlying connection to the pool), regardless of success or failure.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            # Roll back any pending or partially-flushed transaction so the
            # connection goes back to the pool in a consistent state.
            try:
                await session.rollback()
            except Exception as rollback_exc:
                # Rollback itself can fail (e.g. if the connection was already
                # dropped).  Log it but do not mask the original exception.
                logger.warning(
                    "session.rollback() raised during error handling: %s",
                    rollback_exc,
                )
            raise
        # Happy path: the route already called db.commit() where needed.
        # We intentionally do NOT auto-commit here — route handlers are
        # responsible for explicit commits so that partial writes are never
        # silently persisted.
