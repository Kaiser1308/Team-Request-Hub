from fastapi import HTTPException, status

from app.db.supabase import get_supabase_admin

REQUESTS_TABLE = "internal_requests"


def get_request_or_404(request_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select("*")
        .eq("id", request_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    return result.data[0]


def list_assigned_requests(user_id: str, limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select("*")
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
        .select("*")
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
        .select("*")
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
        .select("*")
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
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def create_request(data: dict) -> dict:
    result = get_supabase_admin().table(REQUESTS_TABLE).insert(data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Request could not be created",
        )

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

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
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request was already assigned",
        )

    return result.data[0]


def get_dashboard_data(user_id: str) -> list[dict]:
    """Fetch all dashboard-relevant requests for a user in one DB round-trip."""
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select("*")
        .or_(
            f"assigned_to.eq.{user_id},"
            f"created_by.eq.{user_id},"
            f"and(status.eq.pending,assigned_to.is.null),"
            f"and(status.eq.done,or(created_by.eq.{user_id},assigned_to.eq.{user_id}))"
        )
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return result.data or []
