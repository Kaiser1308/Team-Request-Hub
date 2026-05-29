from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.core.auth import get_current_user, require_active_current_user
from app.core.config import get_settings
from app.schemas.notifications import (
    NotificationOut,
    NotificationPreferenceOut,
    NotificationsReadAllOut,
    NotificationsReadByTypeIn,
    NotificationPreferencesUpdateIn,
    WebPushPublicKeyOut,
    WebPushSubscriptionIn,
    WebPushSubscriptionOut,
    WebPushSubscriptionRevokeOut,
)
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


@router.post("/read-by-type", response_model=NotificationsReadAllOut)
async def mark_notifications_read_by_type(
    body: NotificationsReadByTypeIn,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.mark_notifications_read_by_type(
        current_user.id, body.types
    )


@router.get("/preferences", response_model=list[NotificationPreferenceOut])
async def list_notification_preferences(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.list_notification_preferences(current_user.id)


@router.patch("/preferences", response_model=list[NotificationPreferenceOut])
async def update_notification_preferences(
    body: NotificationPreferencesUpdateIn,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    updates = body.model_dump(exclude_none=True)
    return notification_module.update_notification_preferences(current_user.id, updates)


@router.get("/web-push/vapid-public-key", response_model=WebPushPublicKeyOut)
async def get_web_push_public_key(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    public_key = get_settings().vapid_public_key
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Web Push is not configured",
        )
    return {"public_key": public_key}


@router.post("/web-push/subscriptions", response_model=WebPushSubscriptionOut)
async def upsert_web_push_subscription(
    body: WebPushSubscriptionIn,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_agent: str | None = Header(None),
):
    require_active_current_user(current_user)
    return notification_module.upsert_web_push_subscription(
        user_id=current_user.id,
        endpoint=body.endpoint,
        p256dh=body.keys.p256dh,
        auth=body.keys.auth,
        user_agent=user_agent,
    )


@router.delete("/web-push/subscriptions/{subscription_id}", response_model=WebPushSubscriptionRevokeOut)
async def revoke_web_push_subscription(
    subscription_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.revoke_web_push_subscription(current_user.id, subscription_id)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.mark_notification_read(notification_id, current_user.id)
