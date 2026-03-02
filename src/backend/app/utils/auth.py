import hashlib
import hmac
import secrets

import jwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from jwt.exceptions import ExpiredSignatureError, PyJWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User

settings = get_settings()

# Length (in bytes) of the random CSRF nonce — 32 bytes → 64-char hex string.
_CSRF_NONCE_BYTES = 32
_CSRF_SEPARATOR = "."


def create_csrf_token(user_id: int | str) -> str:
    """
    Create an HMAC-signed CSRF token bound to a specific user.

    The token format is ``<nonce>.<signature>`` where the signature is
    HMAC-SHA256(jwt_secret, nonce + ":" + str(user_id)).  This ensures the
    token is cryptographically tied to the user session and cannot be reused
    across users.
    """
    nonce = secrets.token_hex(_CSRF_NONCE_BYTES)
    signature = _sign_csrf(nonce, str(user_id))
    return f"{nonce}{_CSRF_SEPARATOR}{signature}"


def _sign_csrf(nonce: str, user_id: str) -> str:
    """Produce the HMAC-SHA256 signature for a CSRF nonce + user_id."""
    message = f"{nonce}:{user_id}".encode()
    return hmac.new(
        settings.jwt_secret_key.get_secret_value().encode(),
        message,
        hashlib.sha256,
    ).hexdigest()


async def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Extract and validate the JWT from the HttpOnly 'access_token' cookie.
    Raises 401 if the cookie is absent, the token is invalid, or the user
    cannot be found / is inactive.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
    )

    if access_token is None:
        raise credentials_exception

    try:
        payload = jwt.decode(
            access_token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception

    except (PyJWTError, ExpiredSignatureError):
        raise credentials_exception

    user = await db.get(User, int(user_id))
    if user is None or not user.is_active:
        raise credentials_exception

    return user


async def verify_csrf_token(
    x_csrf_token: str | None = Header(default=None, alias="X-CSRF-Token"),
    csrf_token: str | None = Cookie(default=None),
    access_token: str | None = Cookie(default=None),
) -> None:
    """
    Double Submit Cookie CSRF validation — session-bound variant.

    Compares the value in the 'X-CSRF-Token' request header against the
    'csrf_token' cookie using constant-time comparison.  Both must be
    present and identical.

    Additionally, the CSRF token's HMAC signature is verified against the
    user ID extracted from the JWT ``access_token`` cookie, ensuring the
    CSRF token is cryptographically bound to the current session.

    Raises 403 if any check fails.
    """
    if not x_csrf_token or not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )

    # 1. Constant-time comparison of header vs cookie (double submit check).
    if not hmac.compare_digest(x_csrf_token, csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token mismatch",
        )

    # 2. Verify the token is bound to the current user session.
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF validation requires an active session",
        )

    try:
        payload = jwt.decode(
            access_token,
            settings.jwt_secret_key.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
        )
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF token cannot be verified — invalid session",
            )
    except (PyJWTError, ExpiredSignatureError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token cannot be verified — invalid session",
        )

    # Split the CSRF token into nonce and signature.
    if _CSRF_SEPARATOR not in csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token format invalid",
        )

    nonce, provided_sig = csrf_token.split(_CSRF_SEPARATOR, 1)
    expected_sig = _sign_csrf(nonce, user_id)

    if not hmac.compare_digest(provided_sig, expected_sig):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token not bound to current session",
        )
