from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.notifications import NotificationOut, NotificationsReadAllOut
from app.schemas.users import CurrentUser
from app.services import notifications

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    unread_only: bool = False,
):
    require_active_current_user(current_user)
    return notifications.list_notifications(current_user.id, unread_only)


@router.post("/read-all", response_model=NotificationsReadAllOut)
async def mark_all_notifications_read(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notifications.mark_all_notifications_read(current_user.id)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notifications.mark_notification_read(notification_id, current_user.id)
