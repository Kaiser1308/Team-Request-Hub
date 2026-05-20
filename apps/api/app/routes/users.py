from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.users import CurrentUser, UserOut

router = APIRouter()


@router.get("/me", response_model=CurrentUser)
async def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return current_user


@router.get("", response_model=list[UserOut])
async def list_users(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    supabase = get_supabase_admin()

    result = (
        supabase.table("users")
        .select("id,email,name,avatar_url,role,created_at")
        .order("name")
        .execute()
    )

    return result.data or []
