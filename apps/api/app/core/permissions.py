from fastapi import HTTPException, status

from app.schemas.users import CurrentUser


def is_lead(user: CurrentUser) -> bool:
    return user.role == "lead"


def ensure_can_view_request(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request["created_by"] == user.id:
        return

    if request.get("assigned_to") == user.id:
        return

    if request.get("assigned_to") is None:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot view this request",
    )


def ensure_can_reassign(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request["created_by"] == user.id:
        return

    if request.get("assigned_to") == user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot reassign this request",
    )


def ensure_can_cancel(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request["created_by"] == user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot cancel this request",
    )


def ensure_is_assignee_or_lead(user: CurrentUser, request: dict) -> None:
    if is_lead(user):
        return

    if request.get("assigned_to") == user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only assignee or lead can perform this action",
    )
