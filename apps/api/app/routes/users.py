from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.users import CurrentUser, UserActiveUpdate, UserOut, UserRoleUpdate, UserLanguageUpdate
from app.services import users
from app.repositories import user_repository

router = APIRouter()


@router.get("/me", response_model=CurrentUser)
async def get_me(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return current_user


@router.patch("/me/language")
async def update_my_language(
    payload: UserLanguageUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return user_repository.update_user_language(current_user.id, payload.language)


@router.get("/active", response_model=list[UserOut])
async def list_active_users(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return users.list_active_users()


@router.get("", response_model=list[UserOut])
async def list_users(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return users.list_users()


@router.patch("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return users.update_user_role(user_id, payload, current_user)


@router.patch("/{user_id}/active", response_model=UserOut)
async def update_user_active_state(
    user_id: str,
    payload: UserActiveUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return users.update_user_active_state(user_id, payload, current_user)
