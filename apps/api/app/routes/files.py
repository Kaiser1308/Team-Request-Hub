from typing import Annotated

from fastapi import APIRouter, Depends, Response, status

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.files import (
    BatchCopyFilesRequest,
    BatchMoveFilesRequest,
    CompleteUploadRequest,
    CreateFolderRequest,
    FileActivityOut,
    MoveFileRequest,
    PresignedUrlResponse,
    PurgeExpiredResponse,
    RenameFileRequest,
    TeamFileOut,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.schemas.users import CurrentUser
from app.services import file_service

router = APIRouter()


def active_user(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
    require_active_current_user(current_user)
    return current_user


@router.get("", response_model=list[TeamFileOut])
async def list_files(path: str = "/", include_deleted: bool = False, current_user: CurrentUser = Depends(active_user)):
    return file_service.list_files(path, include_deleted=include_deleted and current_user.role == "lead")


@router.get("/search", response_model=list[TeamFileOut])
async def search_files(q: str, include_deleted: bool = False, current_user: CurrentUser = Depends(active_user)):
    return file_service.search_files(q, include_deleted=include_deleted and current_user.role == "lead")


@router.post("/folders", response_model=TeamFileOut, status_code=status.HTTP_201_CREATED)
async def create_folder(payload: CreateFolderRequest, current_user: CurrentUser = Depends(active_user)):
    return file_service.create_folder(payload, current_user)


@router.post("/upload-url", response_model=UploadUrlResponse, status_code=status.HTTP_201_CREATED)
async def create_upload_url(payload: UploadUrlRequest, current_user: CurrentUser = Depends(active_user)):
    return file_service.create_upload_url(payload, current_user)


@router.post("/{file_id}/complete-upload", response_model=TeamFileOut)
async def complete_upload(file_id: str, payload: CompleteUploadRequest, current_user: CurrentUser = Depends(active_user)):
    return file_service.complete_upload(file_id, payload, current_user)


@router.post("/{file_id}/download-url", response_model=PresignedUrlResponse)
async def download_url(file_id: str, current_user: CurrentUser = Depends(active_user)):
    return file_service.create_download_url(file_id, current_user)


@router.post("/{file_id}/preview-url", response_model=PresignedUrlResponse)
async def preview_url(file_id: str, current_user: CurrentUser = Depends(active_user)):
    return file_service.create_preview_url(file_id, current_user)


@router.get("/{file_id}/preview-content")
async def preview_content(file_id: str, current_user: CurrentUser = Depends(active_user)):
    content, media_type = file_service.get_preview_content(file_id, current_user)
    return Response(content=content, media_type=media_type)


@router.patch("/{file_id}/rename", response_model=TeamFileOut)
async def rename_file(file_id: str, payload: RenameFileRequest, current_user: CurrentUser = Depends(active_user)):
    return file_service.rename_file(file_id, payload, current_user)


@router.patch("/{file_id}/move", response_model=TeamFileOut)
async def move_file(file_id: str, payload: MoveFileRequest, current_user: CurrentUser = Depends(active_user)):
    return file_service.move_file(file_id, payload, current_user)


@router.post("/batch-copy", response_model=list[TeamFileOut], status_code=status.HTTP_201_CREATED)
async def batch_copy_files(payload: BatchCopyFilesRequest, current_user: CurrentUser = Depends(active_user)):
    return file_service.batch_copy_files(payload, current_user)


@router.post("/batch-move", response_model=list[TeamFileOut])
async def batch_move_files(payload: BatchMoveFilesRequest, current_user: CurrentUser = Depends(active_user)):
    return file_service.batch_move_files(payload, current_user)


@router.post("/{file_id}/delete", response_model=TeamFileOut)
async def delete_file(file_id: str, current_user: CurrentUser = Depends(active_user)):
    return file_service.soft_delete_file(file_id, current_user)


@router.post("/{file_id}/restore", response_model=TeamFileOut)
async def restore_file(file_id: str, current_user: CurrentUser = Depends(active_user)):
    return file_service.restore_file(file_id, current_user)


@router.post("/purge-expired", response_model=PurgeExpiredResponse)
async def purge_expired(current_user: CurrentUser = Depends(active_user)):
    return file_service.purge_expired(current_user)


@router.get("/activity", response_model=list[FileActivityOut])
async def list_activity(file_id: str | None = None, limit: int = 50, current_user: CurrentUser = Depends(active_user)):
    return file_service.list_activity(file_id=file_id, limit=limit)


@router.get("/tree", response_model=list[TeamFileOut])
async def list_tree(include_deleted: bool = False, current_user: CurrentUser = Depends(active_user)):
    return file_service.list_tree(include_deleted=include_deleted and current_user.role == "lead")
