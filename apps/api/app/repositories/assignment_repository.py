from app.db.supabase import get_supabase_admin

ASSIGNMENT_HISTORY_COLUMNS = (
    "id,request_id,from_user_id,to_user_id,assigned_by,reason,created_at"
)


def create_assignment_history(
    *,
    request_id: str,
    from_user_id: str | None,
    to_user_id: str,
    assigned_by: str,
    reason: str | None,
) -> dict | None:
    result = (
        get_supabase_admin()
        .table("assignment_history")
        .insert(
            {
                "request_id": request_id,
                "from_user_id": from_user_id,
                "to_user_id": to_user_id,
                "assigned_by": assigned_by,
                "reason": reason,
            }
        )
        .execute()
    )
    return result.data[0] if result.data else None


def list_assignment_history(request_id: str, limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("assignment_history")
        .select(ASSIGNMENT_HISTORY_COLUMNS)
        .eq("request_id", request_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
