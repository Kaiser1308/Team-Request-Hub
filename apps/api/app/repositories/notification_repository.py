from fastapi import HTTPException, status

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


def list_notifications(user_id: str, unread_only: bool = False) -> list[dict]:
    query = (
        get_supabase_admin()
        .table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
    )

    if unread_only:
        query = query.eq("is_read", False)

    result = query.execute()
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

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
