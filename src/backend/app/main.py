import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.config import get_settings
from app.database import engine
from app.routers import (
    accounts,
    admin,
    auth,
    documents,
    jobs,
    receipts,
    reconciliation,
    statements,
)
from app.utils.limiter import limiter as _limiter

logger = logging.getLogger("matcha.access")

settings = get_settings()


# ---------------------------------------------------------------------------
# 7.1 — Lifespan: replaces deprecated @app.on_event("startup/shutdown")
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────
    logger.info("Application startup: database engine initialised.")
    yield
    # ── Shutdown ─────────────────────────────────────────────────────────
    logger.info("Application shutdown: disposing database engine…")
    await engine.dispose()
    logger.info("Database engine disposed.")


app = FastAPI(title="Matcha Backend", lifespan=lifespan)

# ---------------------------------------------------------------------------
# 7.2 — Register the rate-limiter state and its 429 exception handler so that
#        the @limiter.limit() decorators in the routers take effect globally.
#        The limiter is imported from app.utils.limiter so that this instance
#        and every router decorator share the same object and counter storage.
# ---------------------------------------------------------------------------
app.state.limiter = _limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# 7.3 — Request / response logging middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    start = time.perf_counter()
    response: Response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "%s %s -> %d (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    # Expose timing in a header so it is visible in browser dev-tools too.
    response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
    return response


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,  # type: ignore[arg-type]
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=[
        "Content-Type",
        "Accept",
        "Authorization",
        "X-CSRF-Token",
    ],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(jobs.router)
app.include_router(receipts.router)
app.include_router(reconciliation.router)
app.include_router(statements.router)
app.include_router(accounts.router)
app.include_router(admin.router)


# ---------------------------------------------------------------------------
# 7.1 — Health endpoint (pings the database)
# ---------------------------------------------------------------------------
@app.get("/health", tags=["ops"])
async def health_check():
    """
    Liveness + readiness probe.

    Returns 200 with ``{"status": "ok"}`` when the API and its database
    connection are both healthy.  Returns 503 if the database cannot be
    reached so that load balancers and orchestrators can route accordingly.
    """
    from fastapi import HTTPException

    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.error("Health check DB ping failed: %s", exc)
        raise HTTPException(status_code=503, detail="Database unavailable") from exc

    return {"status": "ok"}


@app.get("/", tags=["ops"])
def read_root():
    return {"message": "System Operational"}
