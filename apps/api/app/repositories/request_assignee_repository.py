from app.core.exceptions import DomainError, NotFoundError
from app.db.supabase import get_supabase_admin

REQUEST_ASSIGNEES_TABLE = "request_assignees"


def list_assignee_ids(request_id: str) -> list[str]:
    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .select("user_id")
        .eq("request_id", request_id)
        .order("assigned_at", desc=False)
        .execute()
    )
    return [row["user_id"] for row in (result.data or [])]


def list_assignee_ids_by_request_ids(request_ids: list[str]) -> dict[str, list[str]]:
    if not request_ids:
        return {}

    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .select("request_id,user_id,assigned_at")
        .in_("request_id", request_ids)
        .order("assigned_at", desc=False)
        .execute()
    )
    data: dict[str, list[str]] = {request_id: [] for request_id in request_ids}
    for row in (result.data or []):
        data.setdefault(row["request_id"], []).append(row["user_id"])
    return data


def add_assignees(request_id: str, user_ids: list[str], assigned_by: str) -> list[dict]:
    unique_ids = list(dict.fromkeys(user_ids))
    if not unique_ids:
        return []
    payload = [
        {"request_id": request_id, "user_id": user_id, "assigned_by": assigned_by}
        for user_id in unique_ids
    ]
    result = get_supabase_admin().table(REQUEST_ASSIGNEES_TABLE).insert(payload).execute()
    if len(result.data or []) != len(unique_ids):
        raise DomainError("Request assignees could not be created")
    return result.data


def add_assignee(request_id: str, user_id: str, assigned_by: str) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .insert({"request_id": request_id, "user_id": user_id, "assigned_by": assigned_by})
        .execute()
    )
    if not result.data:
        raise DomainError("User is already assigned to this request")
    return result.data[0]


def remove_assignee(request_id: str, user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .delete()
        .eq("request_id", request_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise NotFoundError("Assignee not found on request")
    return result.data[0]
