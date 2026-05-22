from app.db.supabase import get_supabase_admin

STATUS_LOG_COLUMNS = "id,request_id,from_status,to_status,changed_by,reason,created_at"


def create_status_log(
    *,
    request_id: str,
    from_status: str | None,
    to_status: str,
    changed_by: str,
    reason: str | None,
) -> dict | None:
    result = (
        get_supabase_admin()
        .table("request_status_logs")
        .insert(
            {
                "request_id": request_id,
                "from_status": from_status,
                "to_status": to_status,
                "changed_by": changed_by,
                "reason": reason,
            }
        )
        .execute()
    )
    return result.data[0] if result.data else None


def list_status_logs(request_id: str, limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("request_status_logs")
        .select(STATUS_LOG_COLUMNS)
        .eq("request_id", request_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
