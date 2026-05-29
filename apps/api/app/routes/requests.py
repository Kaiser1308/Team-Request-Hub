from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, status

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.requests import (
    AddAssigneeRequest,
    AssignmentHistoryOut,
    CancelRequest,
    DoneRequest,
    InternalRequestCreate,
    InternalRequestOut,
    InternalRequestUpdate,
    ReassignRequest,
    RemoveAssigneeRequest,
    RequestStatusLogOut,
    StatusUpdateRequest,
)
from app.schemas.users import CurrentUser
from app import notification_module
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
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.create_request(payload, current_user)
    for assignee in result.get("assignees", []):
        background_tasks.add_task(
            notification_module.dispatch_assignment_background,
            assignee["id"],
            result,
            False,
        )
    return result


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
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.self_assign_request(request_id, current_user)
    if result["created_by"] != current_user.id:
        background_tasks.add_task(
            notification_module.dispatch_assignment_background,
            result["created_by"],
            result,
            False,
        )
    return result


@router.post("/{request_id}/reassign", response_model=InternalRequestOut)
async def reassign_request(
    request_id: str,
    payload: ReassignRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.reassign_request(request_id, payload, current_user)
    background_tasks.add_task(
        notification_module.dispatch_assignment_background,
        payload.assigned_to,
        result,
        True,
    )
    if result["created_by"] != current_user.id:
        background_tasks.add_task(
            notification_module.dispatch_assignment_background,
            result["created_by"],
            result,
            True,
        )
    return result


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
    limit: int = 50,
):
    require_active_current_user(current_user)
    return request_service.list_assignment_history(request_id, current_user, limit=limit)


@router.post("/{request_id}/assignees", response_model=InternalRequestOut)
async def add_request_assignee(
    request_id: str,
    payload: AddAssigneeRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.add_request_assignee(
        request_id,
        payload.user_id,
        payload.reason,
        current_user,
    )
    background_tasks.add_task(
        notification_module.dispatch_assignment_background,
        payload.user_id,
        result,
        False,
    )
    return result


@router.delete("/{request_id}/assignees/{user_id}", response_model=InternalRequestOut)
async def remove_request_assignee(
    request_id: str,
    user_id: str,
    payload: RemoveAssigneeRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.remove_request_assignee(
        request_id,
        user_id,
        payload.reason,
        current_user,
    )


@router.get("/{request_id}/status-logs", response_model=list[RequestStatusLogOut])
async def list_status_logs(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    limit: int = 50,
):
    require_active_current_user(current_user)
    return request_service.list_status_logs(request_id, current_user, limit=limit)
