from app.db.supabase import get_supabase_admin


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
        .select("id, telegram_chat_id, telegram_username, telegram_linked_at")
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
