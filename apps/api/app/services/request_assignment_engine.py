from fastapi import HTTPException, status

from app.schemas.users import CurrentUser
from app.services import request_transition_engine


def is_lead(current_user: CurrentUser) -> bool:
    return current_user.role == "lead"


def ensure_can_manage_assignees(current_user: CurrentUser, request: dict) -> None:
    if is_lead(current_user) or request["created_by"] == current_user.id:
        return
    if current_user.id in (request.get("assignee_ids") or []):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot manage assignees for this request",
    )


def ensure_can_add_assignee(request: dict, user_id: str) -> None:
    if user_id in request.get("assignee_ids", []):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already assigned to this request",
        )


def ensure_can_remove_assignee(request: dict, user_id: str, reason: str | None) -> None:
    assignee_ids = request.get("assignee_ids", [])
    if user_id not in assignee_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignee not found on request",
        )
    if request.get("status") in request_transition_engine.ACTIVE_STATUSES and not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason is required to remove assignee from active request",
        )
    if request.get("status") in request_transition_engine.ACTIVE_STATUSES and len(assignee_ids) == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last assignee from an active request",
        )
