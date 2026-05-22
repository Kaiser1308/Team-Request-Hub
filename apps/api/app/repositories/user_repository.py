from app.core.exceptions import BadRequestError, NotFoundError

from app.db.supabase import get_supabase_admin


def get_user_or_404(user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .select("id,email,name,avatar_url,role,is_active,created_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise NotFoundError("User not found")

    return result.data[0]


def ensure_active_user(user_id: str) -> None:
    user = get_user_or_404(user_id)
    if user.get("is_active") is False:
        raise BadRequestError("User is inactive")


def list_users() -> list[dict]:
    result = (
        get_supabase_admin()
        .table("users")
        .select("id,email,name,avatar_url,role,is_active,created_at")
        .order("name")
        .execute()
    )
    return result.data or []


def list_active_users() -> list[dict]:
    result = (
        get_supabase_admin()
        .table("users")
        .select("id,email,name,avatar_url,role,is_active,created_at")
        .eq("is_active", True)
        .order("name")
        .execute()
    )
    return result.data or []


def update_user_role(user_id: str, role: str) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update({"role": role})
        .eq("id", user_id)
        .execute()
    )

    if not result.data:
        raise NotFoundError("User not found")

    return result.data[0]


def update_user_active_state(user_id: str, is_active: bool) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update({"is_active": is_active})
        .eq("id", user_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return result.data[0]


def update_user_language(user_id: str, language: str) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update({"preferred_language": language})
        .eq("id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


def get_user_profile_or_404(user_id: str) -> dict:
    return get_user_or_404(user_id)


def list_user_summaries(user_ids: list[str]) -> dict[str, dict]:
    unique_ids = sorted(set(user_ids))
    if not unique_ids:
        return {}

    result = (
        get_supabase_admin()
        .table("users")
        .select("id,email,name,avatar_url")
        .in_("id", unique_ids)
        .execute()
    )
    return {item["id"]: item for item in result.data or []}
