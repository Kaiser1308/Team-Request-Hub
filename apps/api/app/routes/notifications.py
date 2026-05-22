from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.notifications import NotificationOut, NotificationsReadAllOut
from app.schemas.users import CurrentUser
from app import notification_module

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    unread_only: bool = False,
    limit: int = 50,
):
    require_active_current_user(current_user)
    return notification_module.list_notifications(current_user.id, unread_only, limit)


@router.post("/read-all", response_model=NotificationsReadAllOut)
async def mark_all_notifications_read(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.mark_all_notifications_read(current_user.id)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.mark_notification_read(notification_id, current_user.id)
