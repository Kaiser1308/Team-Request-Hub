"""Internal: notification, delivery, and telegram DB access."""

from app.core.exceptions import NotFoundError
from app.db.supabase import get_supabase_admin


def create_notification(
    *,
    user_id: str,
    request_id: str | None,
    notification_type: str,
    message: str,
) -> dict | None:
    result = (
        get_supabase_admin()
        .table("notifications")
        .insert(
            {
                "user_id": user_id,
                "request_id": request_id,
                "type": notification_type,
                "message": message,
            }
        )
        .execute()
    )
    return result.data[0] if result.data else None


def list_notifications(user_id: str, unread_only: bool = False, limit: int = 50) -> list[dict]:
    query = (
        get_supabase_admin()
        .table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
    )

    if unread_only:
        query = query.eq("is_read", False)

    result = query.limit(limit).execute()
    return result.data or []


def mark_notification_read(notification_id: str, user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise NotFoundError("Notification not found")

    return result.data[0]


def mark_all_notifications_read(user_id: str) -> int:
    result = (
        get_supabase_admin()
        .table("notifications")
        .update({"is_read": True})
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    return len(result.data or [])


def mark_notifications_read_by_type(user_id: str, types: list[str]) -> int:
    result = (
        get_supabase_admin()
        .table("notifications")
        .update({"is_read": True})
        .eq("user_id", user_id)
        .eq("is_read", False)
        .in_("type", types)
        .execute()
    )
    return len(result.data or [])


def create_delivery(*, notification_id: str, user_id: str, channel: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notification_deliveries")
        .insert(
            {
                "notification_id": notification_id,
                "user_id": user_id,
                "channel": channel,
                "status": "pending",
            }
        )
        .execute()
    )
    return result.data[0]


def mark_delivery_sent(delivery_id: str, provider_message_id: str | None, sent_at: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notification_deliveries")
        .update(
            {
                "status": "sent",
                "provider_message_id": provider_message_id,
                "error_message": None,
                "sent_at": sent_at,
            }
        )
        .eq("id", delivery_id)
        .execute()
    )
    return result.data[0]


def mark_delivery_failed(delivery_id: str, error_message: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notification_deliveries")
        .update({"status": "failed", "error_message": error_message})
        .eq("id", delivery_id)
        .execute()
    )
    return result.data[0]


def create_link_token(user_id: str, token: str, expires_at: str) -> dict:
    result = (
        get_supabase_admin()
        .table("telegram_link_tokens")
        .insert({"user_id": user_id, "token": token, "expires_at": expires_at})
        .execute()
    )
    return result.data[0]


def get_valid_link_token(token: str, now: str) -> dict | None:
    result = (
        get_supabase_admin()
        .table("telegram_link_tokens")
        .select("*")
        .eq("token", token)
        .is_("used_at", "null")
        .gt("expires_at", now)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def mark_link_token_used(token_id: str, used_at: str) -> None:
    (
        get_supabase_admin()
        .table("telegram_link_tokens")
        .update({"used_at": used_at})
        .eq("id", token_id)
        .execute()
    )


def get_user_telegram_profile(user_id: str) -> dict | None:
    result = (
        get_supabase_admin()
        .table("users")
        .select("id, telegram_chat_id, telegram_username, telegram_linked_at, preferred_language")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def link_telegram_user(
    user_id: str,
    chat_id: str,
    username: str | None,
    linked_at: str,
) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update(
            {
                "telegram_chat_id": chat_id,
                "telegram_username": username,
                "telegram_linked_at": linked_at,
            }
        )
        .eq("id", user_id)
        .execute()
    )
    return result.data[0]


def unlink_telegram_user(user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update(
            {
                "telegram_chat_id": None,
                "telegram_username": None,
                "telegram_linked_at": None,
            }
        )
        .eq("id", user_id)
        .execute()
    )
    return result.data[0]


CHANNELS = ("telegram", "email", "web_push")


def list_notification_preferences(user_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("notification_preferences")
        .select("channel, enabled")
        .eq("user_id", user_id)
        .execute()
    )
    rows = {row["channel"]: row for row in (result.data or [])}
    return [
        {"channel": channel, "enabled": rows.get(channel, {}).get("enabled", True)}
        for channel in CHANNELS
    ]


def update_notification_preferences(user_id: str, updates: dict[str, bool]) -> list[dict]:
    rows = [
        {"user_id": user_id, "channel": channel, "enabled": enabled}
        for channel, enabled in updates.items()
        if channel in CHANNELS
    ]
    if rows:
        (
            get_supabase_admin()
            .table("notification_preferences")
            .upsert(rows, on_conflict="user_id,channel")
            .execute()
        )
    return list_notification_preferences(user_id)


def upsert_web_push_subscription(
    *,
    user_id: str,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str | None,
) -> dict:
    result = (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .upsert(
            {
                "user_id": user_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth": auth,
                "user_agent": user_agent,
                "revoked_at": None,
            },
            on_conflict="endpoint",
        )
        .execute()
    )
    return result.data[0]


def list_active_web_push_subscriptions(user_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", user_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return result.data or []


def revoke_web_push_subscription(user_id: str, subscription_id: str) -> None:
    from datetime import datetime, timezone

    (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .update({"revoked_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", subscription_id)
        .eq("user_id", user_id)
        .execute()
    )


def touch_web_push_subscription(subscription_id: str, used_at: str) -> None:
    (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .update({"last_used_at": used_at})
        .eq("id", subscription_id)
        .execute()
    )


def get_user_email(user_id: str) -> str | None:
    result = (
        get_supabase_admin()
        .table("users")
        .select("email")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0].get("email")
