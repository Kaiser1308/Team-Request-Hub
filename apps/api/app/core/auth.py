from typing import Annotated
from time import monotonic

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.db.supabase import get_supabase_admin
from app.repositories import user_repository
from app.schemas.users import CurrentUser

security = HTTPBearer()
CURRENT_USER_CACHE_TTL_SECONDS = 30
_current_user_cache: dict[str, tuple[float, CurrentUser]] = {}


def clear_current_user_cache() -> None:
    _current_user_cache.clear()


def decode_supabase_access_token(token: str) -> tuple[str, str | None]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_iss": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return user_id, email


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> CurrentUser:
    token = credentials.credentials
    cached_user = _get_cached_current_user(token)
    if cached_user is not None:
        return cached_user

    user_id, token_email = decode_supabase_access_token(token)
    profile = user_repository.get_user_profile_or_404(user_id)

    current_user = CurrentUser(
        id=profile["id"],
        email=profile.get("email") or token_email,
        name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
        role=profile["role"],
        is_active=profile.get("is_active", True),
    )
    _current_user_cache[token] = (
        monotonic() + CURRENT_USER_CACHE_TTL_SECONDS,
        current_user,
    )
    return current_user


def _get_cached_current_user(token: str) -> CurrentUser | None:
    cached = _current_user_cache.get(token)
    if cached is None:
        return None

    expires_at, current_user = cached
    if expires_at <= monotonic():
        _current_user_cache.pop(token, None)
        return None

    return current_user


def require_active_current_user(current_user: CurrentUser) -> CurrentUser:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending lead approval",
        )
    return current_user
