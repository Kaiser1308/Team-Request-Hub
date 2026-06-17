from datetime import datetime, timezone

from app.core.exceptions import ConflictError, DomainError, NotFoundError

from app.db.supabase import get_supabase_admin

REQUESTS_TABLE = "internal_requests"
REQUEST_DETAIL_COLUMNS = "*"
REQUEST_LIST_COLUMNS = ",".join(
    [
        "id",
        "title",
        "description",
        "tags",
        "priority",
        "status",
        "created_by",
        "assigned_to",
        "reference_links",
        "reply",
        "acknowledged_at",
        "started_at",
        "done_at",
        "cancelled_at",
        "created_at",
        "updated_at",
        "purge_after",
    ]
)


def get_request_or_404(request_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_DETAIL_COLUMNS)
        .eq("id", request_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise NotFoundError("Request not found")

    return result.data[0]


def list_assigned_requests(user_id: str, limit: int = 50) -> list[dict]:
    assignment_result = (
        get_supabase_admin()
        .table("request_assignees")
        .select("request_id")
        .eq("user_id", user_id)
        .order("assigned_at", desc=True)
        .limit(limit)
        .execute()
    )
    request_ids = [row["request_id"] for row in (assignment_result.data or [])]
    if not request_ids:
        return []

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .in_("id", request_ids)
        .neq("status", "done")
        .neq("status", "cancelled")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def list_created_requests(user_id: str, limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .eq("created_by", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def list_pool_requests(limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .rpc("list_pool_requests", {"result_limit": limit})
        .execute()
    )
    return result.data or []


def list_done_requests(limit: int = 50, user_id: str | None = None) -> list[dict]:
    result = (
        get_supabase_admin()
        .rpc(
            "list_done_requests",
            {"result_limit": limit, "current_user_id": user_id},
        )
        .execute()
    )
    return result.data or []


def list_all_requests(limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def list_requests_ready_for_purge(now_iso: str | None = None) -> list[dict]:
    if now_iso is None:
        now_iso = datetime.now(timezone.utc).isoformat()
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select("id")
        .in_("status", ["done", "cancelled"])
        .not_.is_("purge_after", "null")
        .lte("purge_after", now_iso)
        .execute()
    )
    return result.data or []


def delete_request(request_id: str) -> None:
    get_supabase_admin().table(REQUESTS_TABLE).delete().eq("id", request_id).execute()


def create_request(data: dict) -> dict:
    result = get_supabase_admin().table(REQUESTS_TABLE).insert(data).execute()

    if not result.data:
        raise DomainError("Request could not be created")

    return result.data[0]


def update_request(request_id: str, data: dict) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update(data)
        .eq("id", request_id)
        .execute()
    )

    if not result.data:
        raise NotFoundError("Request not found")

    return result.data[0]


def assign_if_unassigned(request_id: str, user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update({"assigned_to": user_id, "status": "pending"})
        .eq("id", request_id)
        .is_("assigned_to", "null")
        .execute()
    )

    if not result.data:
        raise ConflictError("Request was already assigned")

    return result.data[0]


def get_dashboard_data(user_id: str) -> list[dict]:
    """Fetch all dashboard-relevant requests for a user in one DB round-trip."""
    result = (
        get_supabase_admin()
        .rpc(
            "get_dashboard_data",
            {"current_user_id": user_id, "result_limit": 200},
        )
        .execute()
    )
    return result.data or []
