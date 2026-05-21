from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser

security = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> CurrentUser:
    token = credentials.credentials
    supabase = get_supabase_admin()

    try:
        auth_result = supabase.auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    auth_user = getattr(auth_result, "user", None)
    user_id = getattr(auth_user, "id", None)
    email = getattr(auth_user, "email", None)

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = (
        supabase.table("users")
        .select("*")
        .eq("id", user_id)
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found",
        )

    return CurrentUser(
        id=result.data["id"],
        email=result.data.get("email") or email,
        name=result.data.get("name"),
        avatar_url=result.data.get("avatar_url"),
        role=result.data["role"],
        is_active=result.data.get("is_active", True),
    )


def require_active_current_user(current_user: CurrentUser) -> CurrentUser:
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending lead approval",
        )
    return current_user
