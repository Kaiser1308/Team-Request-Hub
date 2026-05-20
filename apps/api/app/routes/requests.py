from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.auth import get_current_user
from app.core.permissions import (
    ensure_can_cancel,
    ensure_can_reassign,
    ensure_can_view_request,
    ensure_is_assignee_or_lead,
)
from app.db.supabase import get_supabase_admin
from app.schemas.requests import (
    CancelRequest,
    DoneRequest,
    InternalRequestCreate,
    InternalRequestOut,
    InternalRequestUpdate,
    ReassignRequest,
    StatusUpdateRequest,
)
from app.schemas.users import CurrentUser
from app.utils.time import utc_now_iso

router = APIRouter()

REQUESTS_TABLE = "internal_requests"
CLOSED_STATUSES = {"done", "cancelled"}
ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"acknowledged", "cancelled"},
    "acknowledged": {"in_progress", "cancelled"},
    "in_progress": {"acknowledged", "cancelled"},
}


def get_request_or_404(request_id: str) -> dict:
    supabase = get_supabase_admin()

    result = (
        supabase.table(REQUESTS_TABLE)
        .select("*")
        .eq("id", request_id)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found",
        )

    return result.data[0]


def _is_lead(current_user: CurrentUser) -> bool:
    return current_user.role == "lead"


def _filter_viewable_requests(requests: list[dict], current_user: CurrentUser) -> list[dict]:
    viewable = []
    for request in requests:
        try:
            ensure_can_view_request(current_user, request)
        except HTTPException:
            continue
        viewable.append(request)
    return viewable


def _ensure_open_request(request: dict) -> None:
    if request.get("status") in CLOSED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is already closed",
        )


def _ensure_creator_or_lead(current_user: CurrentUser, request: dict) -> None:
    if _is_lead(current_user) or request["created_by"] == current_user.id:
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Only creator or lead can edit this request",
    )


@router.get("", response_model=list[InternalRequestOut])
async def list_requests(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    view: str = "assigned",
):
    supabase = get_supabase_admin()
    query = supabase.table(REQUESTS_TABLE).select("*").order("created_at", desc=True)

    if view == "assigned":
        result = query.eq("assigned_to", current_user.id).execute()
        return result.data or []

    if view == "created":
        result = query.eq("created_by", current_user.id).execute()
        return result.data or []

    if view == "pool":
        result = query.is_("assigned_to", "null").execute()
        return [
            request
            for request in result.data or []
            if request.get("status") not in {"done", "cancelled"}
        ]

    if view == "done":
        result = query.eq("status", "done").execute()
        return _filter_viewable_requests(result.data or [], current_user)

    if view == "all":
        if not _is_lead(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only leads can view all requests",
            )
        result = query.execute()
        return result.data or []

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid request view",
    )


@router.post("", response_model=InternalRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: InternalRequestCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    supabase = get_supabase_admin()
    data = payload.model_dump()
    data.update({"created_by": current_user.id, "status": "pending"})

    result = supabase.table(REQUESTS_TABLE).insert(data).execute()

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Request could not be created",
        )

    return result.data[0]


@router.get("/{request_id}", response_model=InternalRequestOut)
async def get_request_detail(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    return request


@router.patch("/{request_id}", response_model=InternalRequestOut)
async def update_request(
    request_id: str,
    payload: InternalRequestUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    _ensure_creator_or_lead(current_user, request)
    _ensure_open_request(request)

    data = payload.model_dump(exclude_unset=True)
    if not data:
        return request

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update(data)
        .eq("id", request_id)
        .execute()
    )

    return result.data[0]


@router.post("/{request_id}/self-assign", response_model=InternalRequestOut)
async def self_assign_request(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)

    _ensure_open_request(request)

    if request.get("assigned_to") is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request is already assigned",
        )

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update(
            {
                "assigned_to": current_user.id,
                "status": "pending",
            }
        )
        .eq("id", request_id)
        .is_("assigned_to", "null")
        .execute()
    )

    if not result.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Request was already assigned",
        )

    return result.data[0]


@router.post("/{request_id}/reassign", response_model=InternalRequestOut)
async def reassign_request(
    request_id: str,
    payload: ReassignRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_can_reassign(current_user, request)
    _ensure_open_request(request)

    if request.get("status") in {"acknowledged", "in_progress"} and not payload.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason is required to reassign an active request",
        )

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update(
            {
                "assigned_to": payload.assigned_to,
                "status": "pending",
                "acknowledged_at": None,
                "started_at": None,
            }
        )
        .eq("id", request_id)
        .execute()
    )

    return result.data[0]


@router.post("/{request_id}/status", response_model=InternalRequestOut)
async def update_status(
    request_id: str,
    payload: StatusUpdateRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    if payload.status == "cancelled":
        ensure_can_cancel(current_user, request)
    else:
        ensure_is_assignee_or_lead(current_user, request)
    _ensure_open_request(request)

    if payload.status == "done":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /done endpoint",
        )

    allowed_statuses = ALLOWED_STATUS_TRANSITIONS.get(request.get("status"), set())
    if payload.status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status transition",
        )

    data = {"status": payload.status}
    if payload.status == "acknowledged":
        data["acknowledged_at"] = utc_now_iso()
    elif payload.status == "in_progress":
        data["started_at"] = utc_now_iso()
    elif payload.status == "cancelled":
        data["cancelled_at"] = utc_now_iso()

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update(data)
        .eq("id", request_id)
        .execute()
    )

    return result.data[0]


@router.post("/{request_id}/done", response_model=InternalRequestOut)
async def mark_done(
    request_id: str,
    payload: DoneRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_is_assignee_or_lead(current_user, request)
    _ensure_open_request(request)

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update({"status": "done", "reply": payload.reply, "done_at": utc_now_iso()})
        .eq("id", request_id)
        .execute()
    )

    return result.data[0]


@router.post("/{request_id}/cancel", response_model=InternalRequestOut)
async def cancel_request(
    request_id: str,
    payload: CancelRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    request = get_request_or_404(request_id)
    ensure_can_cancel(current_user, request)
    _ensure_open_request(request)

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .update({"status": "cancelled", "cancelled_at": utc_now_iso()})
        .eq("id", request_id)
        .execute()
    )

    return result.data[0]
