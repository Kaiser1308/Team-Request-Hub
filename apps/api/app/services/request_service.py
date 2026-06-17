import logging

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app import notification_module
from app.core.exceptions import ForbiddenError
from app.core.permissions import (
    ensure_can_cancel,
    ensure_can_reassign,
    ensure_can_view_request,
    ensure_is_assignee_or_lead,
)
from app.repositories import request_attachment_repository, request_repository
from app.schemas.requests import (
    CancelRequest,
    DoneRequest,
    InternalRequestCreate,
    InternalRequestUpdate,
    ReassignRequest,
    StatusUpdateRequest,
)
from app.schemas.users import CurrentUser
from app.repositories import (
    assignment_repository,
    request_assignee_repository,
    status_log_repository,
)
from app.services import minio_storage, request_attachment_service, request_assignment_engine, request_list_read_model, request_read_model_builder, request_transition_engine, users
from app.utils.time import utc_now_iso

logger = logging.getLogger("app.purge")

CLOSED_STATUSES = request_transition_engine.CLOSED_STATUSES
ACTIVE_STATUSES = request_transition_engine.ACTIVE_STATUSES
DEFAULT_REQUEST_LIST_LIMIT = 50
MAX_REQUEST_LIST_LIMIT = 100
DEFAULT_HISTORY_LIST_LIMIT = 50
MAX_HISTORY_LIST_LIMIT = 100
ALLOWED_STATUS_TRANSITIONS = request_transition_engine.ALLOWED_STATUS_TRANSITIONS
PURGE_AFTER_DAYS = 7


def is_lead(current_user: CurrentUser) -> bool:
    return current_user.role == "lead"


def ensure_open_request(request: dict) -> None:
    request_transition_engine.ensure_open_request(request)


def ensure_creator_or_lead(current_user: CurrentUser, request: dict) -> None:
    if is_lead(current_user) or request["created_by"] == current_user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only creator or lead can edit this request",
    )


def ensure_status_transition_allowed(from_status: str, to_status: str) -> None:
    request_transition_engine.ensure_status_transition_allowed(from_status, to_status)


def ensure_reassign_reason(request: dict, reason: str | None) -> None:
    request_transition_engine.ensure_reassign_reason(request, reason)


def ensure_done_allowed(request: dict) -> None:
    request_transition_engine.ensure_done_allowed(request)


def ensure_request_assigned(request: dict) -> None:
    request_transition_engine.ensure_request_assigned(request)


def attach_assignee_ids(request: dict) -> dict:
    item = dict(request)
    if isinstance(item.get("assignee_ids"), list):
        return item

    try:
        item["assignee_ids"] = request_assignee_repository.list_assignee_ids(request["id"])
    except Exception:
        assigned_to = item.get("assigned_to")
        item["assignee_ids"] = [assigned_to] if assigned_to else []
    return item


def ensure_can_manage_assignees(current_user: CurrentUser, request: dict) -> None:
    request_assignment_engine.ensure_can_manage_assignees(current_user, request)


def build_status_update_data(next_status: str, now: str | None = None) -> dict:
    return request_transition_engine.build_status_update_data(next_status, now)


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
    return request_read_model_builder.enrich_requests_with_users(requests)


def enrich_request_with_users(request: dict) -> dict:
    return request_read_model_builder.enrich_request_with_users(request)


def list_requests(
    view: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    normalized_limit = normalize_request_list_limit(limit)
    requests = request_list_read_model.list_requests(view, current_user, normalized_limit)
    return enrich_requests_with_users(requests)


def create_request(payload: InternalRequestCreate, current_user: CurrentUser) -> dict:
    data = payload.model_dump()
    saved_attachment_ids = data.pop("attachment_ids", []) or []
    assignee_ids = list(dict.fromkeys(data.pop("assignee_ids", [])))
    assigned_to = data.get("assigned_to")
    if assigned_to and assigned_to not in assignee_ids:
        assignee_ids.insert(0, assigned_to)

    for assignee_id in assignee_ids:
        users.ensure_active_user(assignee_id)

    data["assigned_to"] = assignee_ids[0] if assignee_ids else None

    data.update({"created_by": current_user.id, "status": "pending"})
    request = request_repository.create_request(data)
    request_assignee_repository.add_assignees(request["id"], assignee_ids, current_user.id)
    for assignee_id in assignee_ids:
        assignment_repository.create_assignment_history(
            request_id=request["id"],
            from_user_id=None,
            to_user_id=assignee_id,
            assigned_by=current_user.id,
            reason="Assigned on create",
        )

    request_attachment_service.link_attachments_to_request(
        saved_attachment_ids, request["id"], current_user.id, "request"
    )

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
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_can_view_request(current_user, request)
    ensure_open_request(request)

    if request.get("assignee_ids"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is already assigned",
        )

    updated_request = request_repository.assign_if_unassigned(request_id, current_user.id)
    request_assignee_repository.add_assignee(request_id, current_user.id, current_user.id)
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
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
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
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_is_assignee_or_lead(current_user, request)
    ensure_open_request(request)
    ensure_done_allowed(request)

    updated_request = request_repository.update_request(
        request_id,
        {"status": "done", "reply": payload.reply, "done_at": utc_now_iso(), "purge_after": (datetime.now(timezone.utc) + timedelta(days=PURGE_AFTER_DAYS)).isoformat()},
    )
    status_log_repository.create_status_log(
        request_id=request_id,
        from_status=request.get("status"),
        to_status="done",
        changed_by=current_user.id,
        reason=None,
    )

    done_attachment_ids = [a for a in (payload.attachment_ids or []) if a]
    request_attachment_service.link_attachments_to_request(
        done_attachment_ids, request_id, current_user.id, "done_reply"
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
        {"status": "cancelled", "cancelled_at": utc_now_iso(), "purge_after": (datetime.now(timezone.utc) + timedelta(days=PURGE_AFTER_DAYS)).isoformat()},
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
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_can_view_request(current_user, request)
    normalized_limit = normalize_history_list_limit(limit)
    return assignment_repository.list_assignment_history(request_id, limit=normalized_limit)


def list_status_logs(
    request_id: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_can_view_request(current_user, request)
    normalized_limit = normalize_history_list_limit(limit)
    return status_log_repository.list_status_logs(request_id, limit=normalized_limit)


def add_request_assignee(
    request_id: str,
    user_id: str,
    reason: str | None,
    current_user: CurrentUser,
) -> dict:
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_can_manage_assignees(current_user, request)
    ensure_open_request(request)
    users.ensure_active_user(user_id)

    request_assignment_engine.ensure_can_add_assignee(request, user_id)

    request_assignee_repository.add_assignee(request_id, user_id, current_user.id)
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=None,
        to_user_id=user_id,
        assigned_by=current_user.id,
        reason=reason,
    )
    notification_module.notify_assigned(user_id, request)
    return enrich_request_with_users(request_repository.get_request_or_404(request_id))


def remove_request_assignee(
    request_id: str,
    user_id: str,
    reason: str | None,
    current_user: CurrentUser,
) -> dict:
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_can_manage_assignees(current_user, request)
    ensure_open_request(request)

    request_assignment_engine.ensure_can_remove_assignee(request, user_id, reason)

    request_assignee_repository.remove_assignee(request_id, user_id)
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=user_id,
        to_user_id=user_id,
        assigned_by=current_user.id,
        reason=reason,
    )
    return enrich_request_with_users(request_repository.get_request_or_404(request_id))


def _purge_expired_requests() -> int:
    now_iso = utc_now_iso()
    expired = request_repository.list_requests_ready_for_purge(now_iso)

    request_ids = [r["id"] for r in expired]
    if not request_ids:
        return 0

    attachments = request_attachment_repository.list_by_request_ids(request_ids)
    for att in attachments:
        object_key = att.get("object_key")
        if object_key:
            try:
                minio_storage.delete_object(object_key)
            except Exception as exc:
                logger.warning("Failed to delete MinIO object %s: %s", object_key, exc)

    purged_count = 0
    for req in expired:
        try:
            request_repository.delete_request(req["id"])
            purged_count += 1
        except Exception as exc:
            logger.warning("Failed to delete request %s: %s", req["id"], exc)

    return purged_count


def purge_expired_requests(current_user: CurrentUser) -> dict:
    if not is_lead(current_user):
        raise ForbiddenError("Only leads can perform this action")
    return {"purged": _purge_expired_requests()}


def purge_expired_requests_no_user() -> dict:
    return {"purged": _purge_expired_requests()}
