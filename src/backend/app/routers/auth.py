from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordRequestForm
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRead
from app.utils.auth import create_csrf_token, get_current_user, verify_csrf_token
from app.utils.jwt import create_access_token
from app.utils.security import verify_password

settings = get_settings()

# ---------------------------------------------------------------------------
# 7.2 — Rate limiting
# ---------------------------------------------------------------------------
# The limiter is keyed by the client's remote IP address.  The state is
# stored in-memory (default), which is sufficient for a single-process
# deployment.  For multi-process / multi-replica deployments swap the
# storage backend to Redis via:
#
#   Limiter(key_func=get_remote_address, storage_uri="redis://redis:6379")
#
# and register it on the FastAPI app in main.py:
#
#   from slowapi import _rate_limit_exceeded_handler
#   from slowapi.errors import RateLimitExceeded
#   app.state.limiter = limiter
#   app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Authenticate the user and establish a session via HttpOnly cookies.

    On success two cookies are set:
    - ``access_token``  — signed JWT, HttpOnly so JS cannot read it.
    - ``csrf_token``    — random hex token, readable by JS for the
                          Double Submit Cookie CSRF pattern.

    No credentials are returned in the response body.

    Rate limited to 10 attempts per minute per IP address (7.2).  Exceeding
    this limit returns HTTP 429 Too Many Requests.
    """
    email = form_data.username.lower().strip()

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    is_verified = await run_in_threadpool(
        verify_password, form_data.password, user.password_hash
    )
    if not is_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(data={"sub": str(user.user_id)})
    csrf_token = create_csrf_token(user.user_id)

    # HttpOnly — the JWT is never accessible from JavaScript.
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
    )

    # NOT HttpOnly — the frontend must be able to read this value and send
    # it back in the X-CSRF-Token header on every state-changing request.
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
    )

    return {"message": "Login successful"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    response: Response,
    _current_user: User = Depends(get_current_user),
    _csrf: None = Depends(verify_csrf_token),
):
    """
    Invalidate the session by clearing both auth cookies.

    The endpoint is protected so that an unauthenticated caller cannot
    trigger unnecessary cookie-clearing round-trips, and CSRF validation
    is applied because logout is a state-changing POST request.
    """
    response.delete_cookie(
        key="access_token", httponly=True, secure=settings.cookie_secure, samesite="lax"
    )
    response.delete_cookie(
        key="csrf_token", httponly=False, secure=settings.cookie_secure, samesite="lax"
    )

    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return current_user
