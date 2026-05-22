"""Notification module — public interface.

Callers import from here. Internal modules (_store, _telegram, _webhook)
are not part of the public API.
"""

import logging

from app.core.config import get_settings
from app.notification_module import _store, _telegram, _webhook

logger = logging.getLogger(__name__)

TELEGRAM_TYPES = {"assigned", "reassigned"}


def create_notification(
    *,
    user_id: str,
    request_id: str | None,
    notification_type: str,
    message: str,
) -> dict | None:
    return _store.create_notification(
        user_id=user_id,
        request_id=request_id,
        notification_type=notification_type,
        message=message,
    )


def list_notifications(user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]:
    return _store.list_notifications(user_id, unread_only, limit)


def mark_notification_read(notification_id: str, user_id: str) -> dict:
    return _store.mark_notification_read(notification_id, user_id)


def mark_all_notifications_read(user_id: str) -> dict:
    return {"updated": _store.mark_all_notifications_read(user_id)}


def get_telegram_profile(user_id: str) -> dict | None:
    return _store.get_user_telegram_profile(user_id)


def link_telegram(user_id: str, chat_id: str, username: str | None, linked_at: str) -> dict:
    return _store.link_telegram_user(user_id, chat_id, username, linked_at)


def unlink_telegram(user_id: str) -> dict:
    return _store.unlink_telegram_user(user_id)


def create_link_token(user_id: str, token: str, expires_at: str) -> dict:
    return _store.create_link_token(user_id, token, expires_at)


def dispatch_telegram_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        return

    user_id = notification["user_id"]
    profile = _store.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return

    notification_type = notification.get("type", "assigned")
    reassigned = notification_type == "reassigned"
    lang = (profile.get("preferred_language") or "vi")

    text = _telegram.build_assignment_message(
        request,
        reassigned=reassigned,
        app_base_url=settings.app_base_url,
        lang=lang,
    )

    delivery = _store.create_delivery(
        notification_id=notification["id"],
        user_id=user_id,
        channel="telegram",
    )

    try:
        from datetime import datetime, timezone

        provider_message_id = _telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=profile["telegram_chat_id"],
            text=text,
        )
        _store.mark_delivery_sent(
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
        _store.mark_delivery_failed(delivery["id"], str(exc))


def dispatch_telegram_background(user_id: str, request: dict, is_reassigned: bool) -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        return
    profile = _store.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return
    lang = profile.get("preferred_language") or "vi"
    text = _telegram.build_assignment_message(
        request,
        reassigned=is_reassigned,
        app_base_url=settings.app_base_url,
        lang=lang,
    )
    try:
        _telegram.send_telegram_message(
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
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"You were assigned a request: {request['title']}",
    )


def notify_request_picked_up(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"Your request was picked up: {request['title']}",
    )


def notify_reassigned(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="reassigned",
        message=f"You were reassigned a request: {request['title']}",
    )


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


def handle_webhook(body: dict, secret_token: str | None) -> dict:
    return _webhook.handle_webhook(body, secret_token)
