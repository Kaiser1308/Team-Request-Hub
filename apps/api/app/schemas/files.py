from typing import Literal

from pydantic import BaseModel, Field

FileStatus = Literal["pending_upload", "active", "deleted", "purged"]
FileAction = Literal[
    "create_folder",
    "upload",
    "complete_upload",
    "rename",
    "move",
    "delete",
    "restore",
    "purge",
    "download",
    "preview",
]
TargetType = Literal["file", "folder"]


class TeamFileOut(BaseModel):
    id: str
    name: str
    path: str
    parent_path: str
    is_directory: bool
    size_bytes: int = 0
    content_type: str | None = None
    extension: str | None = None
    status: FileStatus
    uploaded_by: str | None = None
    created_by: str
    updated_by: str | None = None
    deleted_by: str | None = None
    created_at: str
    updated_at: str
    deleted_at: str | None = None
    purge_after: str | None = None


class FileActivityOut(BaseModel):
    id: str
    actor_id: str
    file_id: str | None
    action: FileAction
    target_type: TargetType
    old_path: str | None = None
    new_path: str | None = None
    metadata: dict = Field(default_factory=dict)
    created_at: str


class CreateFolderRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_path: str = "/"


class UploadUrlRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_path: str = "/"
    size_bytes: int = Field(ge=1, le=209_715_200)
    content_type: str | None = None


class UploadUrlResponse(BaseModel):
    file: TeamFileOut
    upload_url: str
    method: str
    expires_in_seconds: int


class CompleteUploadRequest(BaseModel):
    size_bytes: int = Field(ge=1, le=209_715_200)


class RenameFileRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class MoveFileRequest(BaseModel):
    parent_path: str


class PresignedUrlResponse(BaseModel):
    url: str
    expires_in_seconds: int


class PurgeExpiredResponse(BaseModel):
    purged: int
