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
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .eq("assigned_to", user_id)
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
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .is_("assigned_to", "null")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def list_done_requests(limit: int = 50, user_id: str | None = None) -> list[dict]:
    query = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .eq("status", "done")
        .order("created_at", desc=True)
    )

    if user_id is not None:
        query = query.or_(
            f"created_by.eq.{user_id},assigned_to.eq.{user_id},assigned_to.is.null"
        )

    result = query.limit(limit).execute()
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
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .or_(
            f"assigned_to.eq.{user_id},"
            f"created_by.eq.{user_id},"
            f"and(status.eq.pending,assigned_to.is.null)"
        )
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return result.data or []
