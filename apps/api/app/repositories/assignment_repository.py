from app.db.supabase import get_supabase_admin


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


def list_assignment_history(request_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("assignment_history")
        .select("*")
        .eq("request_id", request_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []
