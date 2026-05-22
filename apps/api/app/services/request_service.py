from fastapi import HTTPException, status

from app import notification_module
from app.core.permissions import (
    ensure_can_cancel,
    ensure_can_reassign,
    ensure_can_view_request,
    ensure_is_assignee_or_lead,
)
from app.repositories import request_repository, user_repository
from app.schemas.requests import (
    CancelRequest,
    DoneRequest,
    InternalRequestCreate,
    InternalRequestUpdate,
    ReassignRequest,
    StatusUpdateRequest,
)
from app.schemas.users import CurrentUser
from app.repositories import assignment_repository, status_log_repository
from app.services import users
from app.utils.time import utc_now_iso

CLOSED_STATUSES = {"done", "cancelled"}
DEFAULT_REQUEST_LIST_LIMIT = 50
MAX_REQUEST_LIST_LIMIT = 100
DEFAULT_HISTORY_LIST_LIMIT = 50
MAX_HISTORY_LIST_LIMIT = 100
ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"acknowledged", "cancelled"},
    "acknowledged": {"in_progress", "cancelled"},
    "in_progress": {"acknowledged", "cancelled"},
}


def is_lead(current_user: CurrentUser) -> bool:
    return current_user.role == "lead"


def ensure_open_request(request: dict) -> None:
    if request.get("status") in CLOSED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is already closed",
        )


def ensure_creator_or_lead(current_user: CurrentUser, request: dict) -> None:
    if is_lead(current_user) or request["created_by"] == current_user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only creator or lead can edit this request",
    )


def ensure_status_transition_allowed(from_status: str, to_status: str) -> None:
    if to_status == "done":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /done endpoint",
        )

    allowed_statuses = ALLOWED_STATUS_TRANSITIONS.get(from_status, set())
    if to_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status transition",
        )


def ensure_reassign_reason(request: dict, reason: str | None) -> None:
    if request.get("status") in {"acknowledged", "in_progress"} and not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason is required to reassign an active request",
        )


def ensure_done_allowed(request: dict) -> None:
    if request.get("status") != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request must be in_progress before done",
        )


def ensure_request_assigned(request: dict) -> None:
    if request.get("assigned_to") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request must be assigned before status can change",
        )


def build_status_update_data(next_status: str, now: str | None = None) -> dict:
    timestamp = now or utc_now_iso()
    data = {"status": next_status}

    if next_status == "acknowledged":
        data["acknowledged_at"] = timestamp
    elif next_status == "in_progress":
        data["started_at"] = timestamp
    elif next_status == "cancelled":
        data["cancelled_at"] = timestamp

    return data


def filter_viewable_requests(
    requests: list[dict],
    current_user: CurrentUser,
) -> list[dict]:
    viewable = []
    for request in requests:
        try:
            ensure_can_view_request(current_user, request)
        except HTTPException:
            continue
        viewable.append(request)
    return viewable


def normalize_request_list_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_REQUEST_LIST_LIMIT

    return max(1, min(limit, MAX_REQUEST_LIST_LIMIT))


def normalize_history_list_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_HISTORY_LIST_LIMIT

    return max(1, min(limit, MAX_HISTORY_LIST_LIMIT))


def enrich_requests_with_users(requests: list[dict]) -> list[dict]:
    user_ids: list[str] = []
    for request in requests:
        if request.get("created_by"):
            user_ids.append(request["created_by"])
        if request.get("assigned_to"):
            user_ids.append(request["assigned_to"])

    users_by_id = user_repository.list_user_summaries(user_ids)
    enriched = []
    for request in requests:
        item = dict(request)
        item["creator"] = users_by_id.get(request.get("created_by"))
        item["assignee"] = users_by_id.get(request.get("assigned_to"))
        enriched.append(item)
    return enriched


def enrich_request_with_users(request: dict) -> dict:
    return enrich_requests_with_users([request])[0]


def list_requests(
    view: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    normalized_limit = normalize_request_list_limit(limit)

    if view == "assigned":
        return enrich_requests_with_users(request_repository.list_assigned_requests(current_user.id, limit=normalized_limit))

    if view == "created":
        return enrich_requests_with_users(request_repository.list_created_requests(current_user.id, limit=normalized_limit))

    if view == "pool":
        return enrich_requests_with_users(request_repository.list_pool_requests(limit=normalized_limit))

    if view == "done":
        if is_lead(current_user):
            return enrich_requests_with_users(request_repository.list_done_requests(limit=normalized_limit))

        return enrich_requests_with_users(request_repository.list_done_requests(
            limit=normalized_limit,
            user_id=current_user.id,
        ))

    if view == "all":
        if not is_lead(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only leads can view all requests",
            )
        return enrich_requests_with_users(request_repository.list_all_requests(limit=normalized_limit))

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid request view",
    )


def create_request(payload: InternalRequestCreate, current_user: CurrentUser) -> dict:
    data = payload.model_dump()
    if data.get("assigned_to"):
        users.ensure_active_user(data["assigned_to"])

    data.update({"created_by": current_user.id, "status": "pending"})
    request = request_repository.create_request(data)

    if request.get("assigned_to"):
        assignment_repository.create_assignment_history(
            request_id=request["id"],
            from_user_id=None,
            to_user_id=request["assigned_to"],
            assigned_by=current_user.id,
            reason="Assigned on create",
        )
        notification_module.notify_assigned(request["assigned_to"], request)

    return enrich_request_with_users(request)


def get_request_detail(request_id: str, current_user: CurrentUser) -> dict:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    return enrich_request_with_users(request)


def update_request(
    request_id: str,
    payload: InternalRequestUpdate,
    current_user: CurrentUser,
) -> dict:
    request = request_repository.get_request_or_404(request_id)
    ensure_creator_or_lead(current_user, request)
    ensure_open_request(request)

    data = payload.model_dump(exclude_unset=True)
    if not data:
        return enrich_request_with_users(request)

    return enrich_request_with_users(request_repository.update_request(request_id, data))


def self_assign_request(request_id: str, current_user: CurrentUser) -> dict:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    ensure_open_request(request)

    if request.get("assigned_to") is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is already assigned",
        )

    updated_request = request_repository.assign_if_unassigned(request_id, current_user.id)
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=None,
        to_user_id=current_user.id,
        assigned_by=current_user.id,
        reason=None,
    )
    if updated_request["created_by"] != current_user.id:
        notification_module.notify_request_picked_up(
            updated_request["created_by"],
            updated_request,
        )

    return enrich_request_with_users(updated_request)


def reassign_request(
    request_id: str,
    payload: ReassignRequest,
    current_user: CurrentUser,
) -> dict:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_reassign(current_user, request)
    ensure_open_request(request)
    ensure_reassign_reason(request, payload.reason)
    users.ensure_active_user(payload.assigned_to)

    data = {
        "assigned_to": payload.assigned_to,
        "status": "pending",
        "acknowledged_at": None,
        "started_at": None,
    }
    updated_request = request_repository.update_request(request_id, data)
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=request.get("assigned_to"),
        to_user_id=payload.assigned_to,
        assigned_by=current_user.id,
        reason=payload.reason,
    )

    if request.get("status") in {"acknowledged", "in_progress"}:
        status_log_repository.create_status_log(
            request_id=request_id,
            from_status=request.get("status"),
            to_status="pending",
            changed_by=current_user.id,
            reason=payload.reason,
        )

    notification_module.notify_reassigned(payload.assigned_to, updated_request)
    if updated_request["created_by"] != current_user.id:
        notification_module.notify_reassigned(updated_request["created_by"], updated_request)

    return enrich_request_with_users(updated_request)


def update_status(
    request_id: str,
    payload: StatusUpdateRequest,
    current_user: CurrentUser,
) -> dict:
    request = request_repository.get_request_or_404(request_id)
    if payload.status == "cancelled":
        ensure_can_cancel(current_user, request)
    else:
        ensure_is_assignee_or_lead(current_user, request)
        ensure_request_assigned(request)

    ensure_open_request(request)
    ensure_status_transition_allowed(request.get("status"), payload.status)

    updated_request = request_repository.update_request(
        request_id,
        build_status_update_data(payload.status),
    )
    status_log_repository.create_status_log(
        request_id=request_id,
        from_status=request.get("status"),
        to_status=payload.status,
        changed_by=current_user.id,
        reason=payload.reason,
    )

    if updated_request["created_by"] != current_user.id:
        notification_module.notify_status_changed(updated_request["created_by"], updated_request)

    return enrich_request_with_users(updated_request)


def mark_done(
    request_id: str,
    payload: DoneRequest,
    current_user: CurrentUser,
) -> dict:
    request = request_repository.get_request_or_404(request_id)
    ensure_is_assignee_or_lead(current_user, request)
    ensure_open_request(request)
    ensure_done_allowed(request)

    updated_request = request_repository.update_request(
        request_id,
        {"status": "done", "reply": payload.reply, "done_at": utc_now_iso()},
    )
    status_log_repository.create_status_log(
        request_id=request_id,
        from_status=request.get("status"),
        to_status="done",
        changed_by=current_user.id,
        reason=None,
    )

    if updated_request["created_by"] != current_user.id:
        notification_module.notify_done(updated_request["created_by"], updated_request)

    return enrich_request_with_users(updated_request)


def cancel_request(
    request_id: str,
    payload: CancelRequest,
    current_user: CurrentUser,
) -> dict:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_cancel(current_user, request)
    ensure_open_request(request)

    updated_request = request_repository.update_request(
        request_id,
        {"status": "cancelled", "cancelled_at": utc_now_iso()},
    )
    status_log_repository.create_status_log(
        request_id=request_id,
        from_status=request.get("status"),
        to_status="cancelled",
        changed_by=current_user.id,
        reason=payload.reason,
    )

    if updated_request.get("assigned_to") and updated_request["assigned_to"] != current_user.id:
        notification_module.notify_cancelled(updated_request["assigned_to"], updated_request)

    return enrich_request_with_users(updated_request)


def list_assignment_history(
    request_id: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    normalized_limit = normalize_history_list_limit(limit)
    return assignment_repository.list_assignment_history(request_id, limit=normalized_limit)


def list_status_logs(
    request_id: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    normalized_limit = normalize_history_list_limit(limit)
    return status_log_repository.list_status_logs(request_id, limit=normalized_limit)
