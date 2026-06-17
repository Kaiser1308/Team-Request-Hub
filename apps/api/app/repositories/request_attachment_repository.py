from app.core.exceptions import DomainError, NotFoundError
from app.db.supabase import get_supabase_admin

TABLE = "request_attachments"
COLUMNS = "id,request_id,context,status,name,object_key,content_type,size_bytes,uploaded_by,created_at,updated_at"


def create_attachment(data: dict) -> dict:
    result = get_supabase_admin().table(TABLE).insert(data).execute()
    if not result.data:
        raise DomainError("Attachment could not be created")
    return result.data[0]


def get_attachment_or_404(attachment_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .eq("id", attachment_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise NotFoundError("Attachment not found")
    return result.data[0]


def list_by_ids(attachment_ids: list[str]) -> list[dict]:
    if not attachment_ids:
        return []
    result = get_supabase_admin().table(TABLE).select(COLUMNS).in_("id", attachment_ids).execute()
    return result.data or []


def list_by_request_ids(request_ids: list[str]) -> list[dict]:
    if not request_ids:
        return []
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .in_("request_id", request_ids)
        .eq("status", "active")
        .order("created_at")
        .execute()
    )
    return result.data or []


def update_attachment(attachment_id: str, data: dict) -> dict:
    result = get_supabase_admin().table(TABLE).update(data).eq("id", attachment_id).execute()
    if not result.data:
        raise NotFoundError("Attachment not found")
    return result.data[0]


def list_cleanup_candidates(before_iso: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .is_("request_id", "null")
        .in_("status", ["pending_upload", "active"])
        .lte("created_at", before_iso)
        .execute()
    )
    return result.data or []


def count_active_by_request(request_id: str, context: str) -> int:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select("id", count="exact")
        .eq("request_id", request_id)
        .eq("context", context)
        .eq("status", "active")
        .execute()
    )
    return result.count or 0
