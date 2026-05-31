from fastapi import HTTPException, status

from app.utils.time import utc_now_iso

CLOSED_STATUSES = {"done", "cancelled"}
ACTIVE_STATUSES = {"acknowledged", "in_progress"}
ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"acknowledged", "cancelled"},
    "acknowledged": {"in_progress", "cancelled"},
    "in_progress": {"acknowledged", "cancelled"},
}


def ensure_open_request(request: dict) -> None:
    if request.get("status") in CLOSED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is already closed",
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
    if request.get("status") in ACTIVE_STATUSES and not reason:
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
    assignee_ids = request.get("assignee_ids") or []
    if not assignee_ids and request.get("assigned_to") is None:
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
