from app.db.supabase import get_supabase_admin

TABLE = "request_attachment_activity_logs"
COLUMNS = "id,request_id,attachment_id,actor_id,action,name,created_at"


def create_activity(data: dict) -> dict | None:
    result = get_supabase_admin().table(TABLE).insert(data).execute()
    if not result.data:
        return None
    return result.data[0]


def list_by_request(request_id: str, limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .eq("request_id", request_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
