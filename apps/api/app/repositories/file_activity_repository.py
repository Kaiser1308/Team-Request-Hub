from app.db.supabase import get_supabase_admin

TABLE = "file_activity_logs"
COLUMNS = "id,actor_id,file_id,action,target_type,old_path,new_path,metadata,created_at"


def create_activity(data: dict) -> dict | None:
    result = get_supabase_admin().table(TABLE).insert(data).execute()

    if not result.data:
        return None

    return result.data[0]


def list_activity(file_id: str | None = None, limit: int = 50) -> list[dict]:
    query = get_supabase_admin().table(TABLE).select(COLUMNS).order("created_at", desc=True)

    if file_id is not None:
        query = query.eq("file_id", file_id)

    result = query.limit(limit).execute()
    return result.data or []
