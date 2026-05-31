from fastapi import HTTPException, status

from app.core.permissions import is_lead
from app.repositories import request_repository
from app.schemas.users import CurrentUser


def list_requests(view: str, current_user: CurrentUser, limit: int) -> list[dict]:
    if view == "assigned":
        return request_repository.list_assigned_requests(current_user.id, limit)

    if view == "created":
        return request_repository.list_created_requests(current_user.id, limit)

    if view == "pool":
        return request_repository.list_pool_requests(limit)

    if view == "done":
        user_id = None if is_lead(current_user) else current_user.id
        return request_repository.list_done_requests(limit, user_id)

    if view == "all":
        if not is_lead(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only leads can view all requests",
            )
        return request_repository.list_all_requests(limit)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid request view",
    )
