import logging

from app.core.config import get_settings
from app.repositories import notification_repository
from app.repositories import telegram_repository
from app.services import telegram

logger = logging.getLogger(__name__)

TELEGRAM_TYPES = {"assigned", "reassigned"}


def create_notification(
    *,
    user_id: str,
    request_id: str | None,
    notification_type: str,
    message: str,
) -> dict | None:
    notification = notification_repository.create_notification(
        user_id=user_id,
        request_id=request_id,
        notification_type=notification_type,
        message=message,
    )
    return notification


def dispatch_telegram_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        return

    user_id = notification["user_id"]
    profile = telegram_repository.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return

    notification_type = notification.get("type", "assigned")
    reassigned = notification_type == "reassigned"

    text = telegram.build_assignment_message(
        request,
        reassigned=reassigned,
        app_base_url=settings.app_base_url,
    )

    delivery = notification_repository.create_delivery(
        notification_id=notification["id"],
        user_id=user_id,
        channel="telegram",
    )

    try:
        from datetime import datetime, timezone

        provider_message_id = telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=profile["telegram_chat_id"],
            text=text,
        )
        notification_repository.mark_delivery_sent(
            delivery["id"],
            provider_message_id,
            datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.warning(
            "Telegram delivery failed for notification %s: %s",
            notification["id"],
            exc,
        )
        notification_repository.mark_delivery_failed(delivery["id"], str(exc))


def dispatch_telegram_background(user_id: str, request: dict, is_reassigned: bool) -> None:
    """Send a Telegram message directly, intended for BackgroundTasks."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        return
    profile = telegram_repository.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return
    text = telegram.build_assignment_message(
        request,
        reassigned=is_reassigned,
        app_base_url=settings.app_base_url,
    )
    try:
        telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=profile["telegram_chat_id"],
            text=text,
        )
    except Exception as exc:
        logger.warning(
            "Background Telegram dispatch failed for user %s: %s",
            user_id,
            exc,
        )


def notify_assigned(user_id: str, request: dict) -> dict | None:
    notification = create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"You were assigned a request: {request['title']}",
    )
    return notification


def notify_request_picked_up(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"Your request was picked up: {request['title']}",
    )


def notify_reassigned(user_id: str, request: dict) -> dict | None:
    notification = create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="reassigned",
        message=f"You were reassigned a request: {request['title']}",
    )
    return notification


def notify_status_changed(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="status_changed",
        message=f"Request status changed: {request['title']}",
    )


def notify_done(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="done",
        message=f"Request was completed: {request['title']}",
    )


def notify_cancelled(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="cancelled",
        message=f"Request was cancelled: {request['title']}",
    )


def list_notifications(user_id: str, unread_only: bool = False) -> list[dict]:
    return notification_repository.list_notifications(user_id, unread_only)


def mark_notification_read(notification_id: str, user_id: str) -> dict:
    return notification_repository.mark_notification_read(notification_id, user_id)


def mark_all_notifications_read(user_id: str) -> dict:
    return {"updated": notification_repository.mark_all_notifications_read(user_id)}
