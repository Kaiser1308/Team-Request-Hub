from fastapi import HTTPException, status

from app.repositories import user_repository
from app.schemas.users import CurrentUser, UserRoleUpdate


def ensure_active_user(user_id: str) -> None:
    user_repository.ensure_active_user(user_id)


def list_users() -> list[dict]:
    return user_repository.list_users()


def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    current_user: CurrentUser,
) -> dict:
    if current_user.role != "lead":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only leads can update user roles",
        )

    return user_repository.update_user_role(user_id, payload.role)
