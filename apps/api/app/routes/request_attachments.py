from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.requests import (
    RequestAttachmentCompleteRequest,
    RequestAttachmentPreviewUrlOut,
    RequestAttachmentUploadUrlOut,
    RequestAttachmentUploadUrlRequest,
)
from app.schemas.users import CurrentUser
from app.services import request_attachment_service

router = APIRouter()


def active_user(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    require_active_current_user(current_user)
    return current_user


@router.post("/upload-url", response_model=RequestAttachmentUploadUrlOut, status_code=status.HTTP_201_CREATED)
async def create_upload_url(payload: RequestAttachmentUploadUrlRequest, current_user: CurrentUser = Depends(active_user)):
    return request_attachment_service.create_upload_url(
        name=payload.name,
        content_type=payload.content_type,
        size_bytes=payload.size_bytes,
        context=payload.context,
        current_user=current_user,
    )


@router.post("/{attachment_id}/complete-upload", response_model=dict)
async def complete_upload(attachment_id: str, payload: RequestAttachmentCompleteRequest, current_user: CurrentUser = Depends(active_user)):
    return request_attachment_service.complete_upload(attachment_id, payload.size_bytes, current_user)


@router.post("/{attachment_id}/preview-url", response_model=RequestAttachmentPreviewUrlOut)
async def create_preview_url(attachment_id: str, current_user: CurrentUser = Depends(active_user)):
    return request_attachment_service.create_preview_url(attachment_id, current_user)
