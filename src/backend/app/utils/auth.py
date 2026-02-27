import jwt
from fastapi import Cookie, Depends, Header, HTTPException, status
from jwt.exceptions import ExpiredSignatureError, PyJWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User

settings = get_settings()


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
) -> None:
    """
    Double Submit Cookie CSRF validation.

    Compares the value in the 'X-CSRF-Token' request header against the
    'csrf_token' cookie.  Both must be present and identical; otherwise a
    403 is raised.

    Apply this dependency to every state-changing endpoint
    (POST, PUT, PATCH, DELETE).
    """
    if not x_csrf_token or not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token missing",
        )

    if x_csrf_token != csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token mismatch",
        )
