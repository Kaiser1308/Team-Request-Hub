from datetime import datetime, timezone

from app.core.exceptions import DomainError, NotFoundError

from app.db.supabase import get_supabase_admin

TABLE = "team_files"
COLUMNS = "id,name,path,parent_path,is_directory,object_key,size_bytes,content_type,extension,status,uploaded_by,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at,purge_after"


def list_children(parent_path: str, include_deleted: bool = False) -> list[dict]:
    query = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .eq("parent_path", parent_path)
        .order("is_directory", desc=True)
        .order("name")
    )

    if not include_deleted:
        query = query.neq("status", "deleted").neq("status", "purged")

    result = query.execute()
    return result.data or []


def search_by_name(query_text: str, include_deleted: bool = False, limit: int = 50) -> list[dict]:
    query = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .ilike("name", f"%{query_text}%")
        .order("name")
        .limit(limit)
    )

    if not include_deleted:
        query = query.neq("status", "deleted").neq("status", "purged")

    result = query.execute()
    return result.data or []


def get_file_or_404(file_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .eq("id", file_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise NotFoundError("File not found")

    return result.data[0]


def get_by_path(path: str) -> dict | None:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .eq("path", path)
        .limit(1)
        .execute()
    )

    if not result.data:
        return None

    return result.data[0]


def create_file(data: dict) -> dict:
    result = get_supabase_admin().table(TABLE).insert(data).execute()

    if not result.data:
        raise DomainError("File could not be created")

    return result.data[0]


def update_file(file_id: str, data: dict) -> dict:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .update(data)
        .eq("id", file_id)
        .execute()
    )

    if not result.data:
        raise NotFoundError("File not found")

    return result.data[0]


def update_descendants(path_prefix: str, data: dict) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .update(data)
        .like("path", f"{path_prefix}%")
        .execute()
    )

    return result.data or []


def list_deleted_ready_for_purge(now_iso: str | None = None) -> list[dict]:
    if now_iso is None:
        now_iso = datetime.now(timezone.utc).isoformat()
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .eq("status", "deleted")
        .not_.is_("purge_after", "null")
        .lte("purge_after", now_iso)
        .execute()
    )
    return result.data or []
