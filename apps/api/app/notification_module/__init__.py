"""Notification module — public interface.

Callers import from here. Internal modules (_store, _telegram, _webhook)
are not part of the public API.
"""

import logging

from app.core.config import get_settings
from app.notification_module import _email, _store, _telegram, _web_push, _webhook

logger = logging.getLogger(__name__)

TELEGRAM_TYPES = {"assigned", "reassigned"}

CHANNELS = ("telegram", "email", "web_push")


def list_notification_preferences(user_id: str) -> list[dict]:
    return _store.list_notification_preferences(user_id)


def update_notification_preferences(user_id: str, updates: dict[str, bool]) -> list[dict]:
    return _store.update_notification_preferences(user_id, updates)


def upsert_web_push_subscription(*, user_id: str, endpoint: str, p256dh: str, auth: str, user_agent: str | None) -> dict:
    return _store.upsert_web_push_subscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        user_agent=user_agent,
    )


def revoke_web_push_subscription(user_id: str, subscription_id: str) -> dict:
    _store.revoke_web_push_subscription(user_id, subscription_id)
    return {"revoked": True}


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


def mark_notifications_read_by_type(user_id: str, types: list[str]) -> dict:
    return {"updated": _store.mark_notifications_read_by_type(user_id, types)}


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
    logger.info("dispatch_telegram_delivery called for notification %s", notification.get("id"))
    if not settings.telegram_bot_token:
        logger.warning("Telegram bot token not configured, skipping delivery")
        return

    user_id = notification["user_id"]
    profile = _store.get_user_telegram_profile(user_id)
    logger.info("Telegram profile for user %s: %s", user_id, profile)
    if not profile or not profile.get("telegram_chat_id"):
        logger.warning("No telegram_chat_id for user %s, skipping delivery", user_id)
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


def dispatch_external_delivery(*, notification: dict, request: dict) -> None:
    preferences = {
        row["channel"]: row["enabled"]
        for row in _store.list_notification_preferences(notification["user_id"])
    }
    if preferences.get("telegram", True):
        dispatch_telegram_delivery(notification=notification, request=request)
    if preferences.get("email", True):
        dispatch_email_delivery(notification=notification, request=request)
    if preferences.get("web_push", True):
        dispatch_web_push_delivery(notification=notification, request=request)


def dispatch_email_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from_email:
        return
    user_id = notification["user_id"]
    to_email = _store.get_user_email(user_id)
    if not to_email:
        return
    delivery = _store.create_delivery(
        notification_id=notification["id"],
        user_id=user_id,
        channel="email",
    )
    try:
        from datetime import datetime, timezone

        message = _email.build_assignment_email(
            request,
            reassigned=notification.get("type") == "reassigned",
            app_base_url=settings.app_base_url,
            lang="vi",
        )
        provider_message_id = _email.send_email(
            host=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            from_email=settings.smtp_from_email,
            from_name=settings.smtp_from_name,
            to_email=to_email,
            subject=message["subject"],
            text=message["text"],
        )
        _store.mark_delivery_sent(delivery["id"], provider_message_id, datetime.now(timezone.utc).isoformat())
    except Exception as exc:
        logger.warning("Email delivery failed for notification %s: %s", notification["id"], exc)
        _store.mark_delivery_failed(delivery["id"], str(exc))


def dispatch_web_push_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_subject:
        return
    user_id = notification["user_id"]
    subscriptions = _store.list_active_web_push_subscriptions(user_id)
    if not subscriptions:
        return
    payload = _web_push.build_web_push_payload(
        request,
        notification_id=notification["id"],
        reassigned=notification.get("type") == "reassigned",
        app_base_url=settings.app_base_url,
        lang="vi",
    )
    for subscription in subscriptions:
        delivery = _store.create_delivery(
            notification_id=notification["id"],
            user_id=user_id,
            channel="web_push",
        )
        try:
            from datetime import datetime, timezone

            _web_push.send_web_push(
                endpoint=subscription["endpoint"],
                p256dh=subscription["p256dh"],
                auth=subscription["auth"],
                vapid_private_key=settings.vapid_private_key,
                vapid_subject=settings.vapid_subject,
                payload=payload,
            )
            used_at = datetime.now(timezone.utc).isoformat()
            _store.touch_web_push_subscription(subscription["id"], used_at)
            _store.mark_delivery_sent(delivery["id"], None, used_at)
        except Exception as exc:
            logger.warning("Web Push delivery failed for notification %s: %s", notification["id"], exc)
            _store.mark_delivery_failed(delivery["id"], str(exc))


def dispatch_assignment_background(user_id: str, request: dict, is_reassigned: bool) -> None:
    logger.info("dispatch_assignment_background called for user %s, request %s", user_id, request.get("id"))
    notification_type = "reassigned" if is_reassigned else "assigned"
    real_notification = create_notification(
        user_id=user_id,
        request_id=request.get("id"),
        notification_type=notification_type,
        message=f"You were {'re' if is_reassigned else ''}assigned a request: {request.get('title', '')}",
    )
    if real_notification:
        dispatch_external_delivery(notification=real_notification, request=request)
    else:
        logger.warning("Could not create notification record for user %s, request %s", user_id, request.get("id"))


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
