from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.db.supabase import get_supabase_admin
from app.schemas.notifications import NotificationOut
from app.schemas.users import CurrentUser

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    supabase = get_supabase_admin()

    result = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", current_user.id)
        .order("created_at", desc=True)
        .execute()
    )

    return result.data or []


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    supabase = get_supabase_admin()

    result = (
        supabase.table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("user_id", current_user.id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return result.data[0]
