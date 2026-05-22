from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.requests import (
    AssignmentHistoryOut,
    CancelRequest,
    DoneRequest,
    InternalRequestCreate,
    InternalRequestOut,
    InternalRequestUpdate,
    ReassignRequest,
    RequestStatusLogOut,
    StatusUpdateRequest,
)
from app.schemas.users import CurrentUser
from app.services import request_service

router = APIRouter()


@router.get("", response_model=list[InternalRequestOut])
async def list_requests(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    view: str = "assigned",
    limit: int | None = None,
):
    require_active_current_user(current_user)
    return request_service.list_requests(view, current_user, limit=limit)


@router.post("", response_model=InternalRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: InternalRequestCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.create_request(payload, current_user)


@router.get("/{request_id}", response_model=InternalRequestOut)
async def get_request_detail(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.get_request_detail(request_id, current_user)


@router.patch("/{request_id}", response_model=InternalRequestOut)
async def update_request(
    request_id: str,
    payload: InternalRequestUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.update_request(request_id, payload, current_user)


@router.post("/{request_id}/self-assign", response_model=InternalRequestOut)
async def self_assign_request(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.self_assign_request(request_id, current_user)


@router.post("/{request_id}/reassign", response_model=InternalRequestOut)
async def reassign_request(
    request_id: str,
    payload: ReassignRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.reassign_request(request_id, payload, current_user)


@router.post("/{request_id}/status", response_model=InternalRequestOut)
async def update_status(
    request_id: str,
    payload: StatusUpdateRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.update_status(request_id, payload, current_user)


@router.post("/{request_id}/done", response_model=InternalRequestOut)
async def mark_done(
    request_id: str,
    payload: DoneRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.mark_done(request_id, payload, current_user)


@router.post("/{request_id}/cancel", response_model=InternalRequestOut)
async def cancel_request(
    request_id: str,
    payload: CancelRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.cancel_request(request_id, payload, current_user)


@router.get(
    "/{request_id}/assignment-history",
    response_model=list[AssignmentHistoryOut],
)
async def list_assignment_history(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.list_assignment_history(request_id, current_user)


@router.get("/{request_id}/status-logs", response_model=list[RequestStatusLogOut])
async def list_status_logs(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.list_status_logs(request_id, current_user)
