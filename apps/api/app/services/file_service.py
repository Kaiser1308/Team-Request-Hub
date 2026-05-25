import posixpath
import re
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, GoneError, NotFoundError
from app.repositories import file_activity_repository, file_repository
from app.schemas.files import CompleteUploadRequest, CreateFolderRequest, MoveFileRequest, RenameFileRequest, UploadUrlRequest
from app.schemas.users import CurrentUser
from app.services import minio_storage
from app.utils.time import utc_now_iso

MAX_FILE_SIZE_BYTES = 209_715_200
PRESIGNED_EXPIRY_SECONDS = 300
PURGE_AFTER_DAYS = 7
SAFE_NAME_RE = re.compile(r"^[^/\\\x00<>:\"|?*]+$")
PREVIEW_TYPES = {
    ("image/png", "png"), ("image/jpeg", "jpg"), ("image/jpeg", "jpeg"),
    ("image/gif", "gif"), ("image/webp", "webp"), ("application/pdf", "pdf"),
}


def is_lead(current_user: CurrentUser) -> bool:
    return current_user.role == "lead"


def ensure_lead(current_user: CurrentUser) -> None:
    if not is_lead(current_user):
        raise ForbiddenError("Only leads can perform this action")


def normalize_path(path: str) -> str:
    if not path:
        return "/"
    if "\x00" in path:
        raise BadRequestError("Path contains null byte")
    if ".." in path.split("/"):
        raise BadRequestError("Path traversal is not allowed")
    if "//" in path:
        raise BadRequestError("Double slash in path")
    normalized = posixpath.normpath(path)
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    if normalized == "/.":
        normalized = "/"
    return normalized


def validate_name(name: str) -> str:
    if not name or not name.strip():
        raise BadRequestError("Name cannot be empty")
    if name == "." or name == "..":
        raise BadRequestError("Name cannot be '.' or '..'")
    if "/" in name or "\\" in name:
        raise BadRequestError("Name cannot contain slashes")
    if not SAFE_NAME_RE.match(name):
        raise BadRequestError("Name contains unsafe characters")
    return name


def build_child_path(parent_path: str, name: str) -> str:
    parent = normalize_path(parent_path)
    if parent == "/":
        return f"/{name}"
    return f"{parent}/{name}"


def get_extension(name: str) -> str | None:
    if "." not in name:
        return None
    base, ext = name.rsplit(".", 1)
    if not ext or not base:
        return None
    return ext.lower()


def is_preview_supported(content_type: str | None, extension: str | None) -> bool:
    if content_type and extension:
        return (content_type, extension.lower()) in PREVIEW_TYPES
    if content_type:
        for ct, ext in PREVIEW_TYPES:
            if ct == content_type:
                return True
    if extension:
        for ct, ext in PREVIEW_TYPES:
            if ext == extension.lower():
                return True
    return False


def ensure_available_path(path: str) -> None:
    existing = file_repository.get_by_path(path)
    if existing and existing.get("status") != "purged":
        raise ConflictError(f"Path already exists: {path}")


def activity(
    actor_id: str,
    file: dict,
    action: str,
    old_path: str | None = None,
    new_path: str | None = None,
    metadata: dict | None = None,
) -> None:
    target_type = "folder" if file.get("is_directory") else "file"
    file_activity_repository.create_activity({
        "actor_id": actor_id,
        "file_id": file.get("id"),
        "action": action,
        "target_type": target_type,
        "old_path": old_path,
        "new_path": new_path,
        "metadata": metadata or {},
    })


def create_folder(payload: CreateFolderRequest, current_user: CurrentUser) -> dict:
    name = validate_name(payload.name)
    parent_path = normalize_path(payload.parent_path)
    path = build_child_path(parent_path, name)
    ensure_available_path(path)

    now = utc_now_iso()
    file = file_repository.create_file({
        "name": name,
        "path": path,
        "parent_path": parent_path,
        "is_directory": True,
        "size_bytes": 0,
        "status": "active",
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
    })
    activity(current_user.id, file, "create_folder")
    return file


def create_upload_url(payload: UploadUrlRequest, current_user: CurrentUser) -> dict:
    name = validate_name(payload.name)
    parent_path = normalize_path(payload.parent_path)
    path = build_child_path(parent_path, name)
    ensure_available_path(path)

    if payload.size_bytes > MAX_FILE_SIZE_BYTES:
        raise BadRequestError(f"File size exceeds maximum of {MAX_FILE_SIZE_BYTES} bytes")

    ext = get_extension(name)
    object_key = f"team-files/{uuid4()}-{name}"
    now = utc_now_iso()

    file = file_repository.create_file({
        "name": name,
        "path": path,
        "parent_path": parent_path,
        "is_directory": False,
        "object_key": object_key,
        "size_bytes": payload.size_bytes,
        "content_type": payload.content_type,
        "extension": ext,
        "status": "pending_upload",
        "created_by": current_user.id,
        "created_at": now,
        "updated_at": now,
    })

    upload_url = minio_storage.presigned_put_url(object_key, PRESIGNED_EXPIRY_SECONDS)

    return {
        "file": file,
        "upload_url": upload_url,
        "method": "PUT",
        "expires_in_seconds": PRESIGNED_EXPIRY_SECONDS,
    }


def complete_upload(file_id: str, payload: CompleteUploadRequest, current_user: CurrentUser) -> dict:
    file = file_repository.get_file_or_404(file_id)
    if file.get("status") != "pending_upload":
        raise BadRequestError("File is not in pending_upload status")

    now = utc_now_iso()
    updated = file_repository.update_file(file_id, {
        "status": "active",
        "size_bytes": payload.size_bytes,
        "uploaded_by": current_user.id,
        "updated_by": current_user.id,
        "updated_at": now,
    })
    activity(current_user.id, updated, "complete_upload")
    return updated


def list_files(path: str = "/", include_deleted: bool = False) -> list[dict]:
    normalized = normalize_path(path)
    return file_repository.list_children(normalized, include_deleted=include_deleted)


def search_files(q: str, include_deleted: bool = False) -> list[dict]:
    if not q or not q.strip():
        return []
    return file_repository.search_by_name(q, include_deleted=include_deleted)


def rename_file(file_id: str, payload: RenameFileRequest, current_user: CurrentUser) -> dict:
    ensure_lead(current_user)
    file = file_repository.get_file_or_404(file_id)
    if file.get("status") != "active":
        raise NotFoundError("File not found")
    name = validate_name(payload.name)
    old_path = file["path"]
    parent_path = file["parent_path"]
    new_path = build_child_path(parent_path, name)

    if new_path != old_path:
        ensure_available_path(new_path)

    updated = file_repository.update_file(file_id, {
        "name": name,
        "path": new_path,
        "extension": get_extension(name),
        "updated_by": current_user.id,
    })

    if file.get("is_directory") and new_path != old_path:
        file_repository.update_descendants(old_path, {"updated_by": current_user.id})

    activity(current_user.id, updated, "rename", old_path=old_path, new_path=new_path)
    return updated


def move_file(file_id: str, payload: MoveFileRequest, current_user: CurrentUser) -> dict:
    ensure_lead(current_user)
    file = file_repository.get_file_or_404(file_id)
    if file.get("status") != "active":
        raise NotFoundError("File not found")
    new_parent = normalize_path(payload.parent_path)
    name = file["name"]
    old_path = file["path"]
    new_path = build_child_path(new_parent, name)

    if new_path == old_path:
        return file

    ensure_available_path(new_path)

    updated = file_repository.update_file(file_id, {
        "parent_path": new_parent,
        "path": new_path,
        "updated_by": current_user.id,
    })

    if file.get("is_directory"):
        file_repository.update_descendants(old_path, {"updated_by": current_user.id})

    activity(current_user.id, updated, "move", old_path=old_path, new_path=new_path)
    return updated


def soft_delete_file(file_id: str, current_user: CurrentUser) -> dict:
    ensure_lead(current_user)
    file = file_repository.get_file_or_404(file_id)

    now = utc_now_iso()
    purge_after = (datetime.now(timezone.utc) + timedelta(days=PURGE_AFTER_DAYS)).isoformat()

    updated = file_repository.update_file(file_id, {
        "status": "deleted",
        "deleted_by": current_user.id,
        "deleted_at": now,
        "purge_after": purge_after,
        "updated_at": now,
    })

    if file.get("is_directory"):
        prefix = file["path"].rstrip("/") + "/"
        file_repository.update_descendants(prefix, {
            "status": "deleted",
            "deleted_by": current_user.id,
            "deleted_at": now,
            "purge_after": purge_after,
            "updated_at": now,
        })

    activity(current_user.id, updated, "delete")
    return updated


def restore_file(file_id: str, current_user: CurrentUser) -> dict:
    ensure_lead(current_user)
    file = file_repository.get_file_or_404(file_id)

    if file.get("status") == "purged":
        raise GoneError("File has been purged")

    path = file["path"]
    existing = file_repository.get_by_path(path)
    if existing and existing.get("id") != file_id and existing.get("status") != "purged":
        raise ConflictError(f"Cannot restore: path already exists: {path}")

    now = utc_now_iso()
    updated = file_repository.update_file(file_id, {
        "status": "active",
        "deleted_by": None,
        "deleted_at": None,
        "purge_after": None,
        "updated_by": current_user.id,
        "updated_at": now,
    })

    if file.get("is_directory"):
        prefix = file["path"].rstrip("/") + "/"
        file_repository.update_descendants(prefix, {
            "status": "active",
            "deleted_by": None,
            "deleted_at": None,
            "purge_after": None,
            "updated_at": now,
        })

    activity(current_user.id, updated, "restore")
    return updated


def create_download_url(file_id: str, current_user: CurrentUser) -> dict:
    file = file_repository.get_file_or_404(file_id)
    if file.get("status") != "active":
        raise BadRequestError("File is not active")
    if file.get("is_directory"):
        raise BadRequestError("Cannot download a folder")
    if not file.get("object_key"):
        raise BadRequestError("File has no object key")

    url = minio_storage.presigned_get_url(file["object_key"], PRESIGNED_EXPIRY_SECONDS)
    activity(current_user.id, file, "download")
    return {"url": url, "expires_in_seconds": PRESIGNED_EXPIRY_SECONDS}


def create_preview_url(file_id: str, current_user: CurrentUser) -> dict:
    file = file_repository.get_file_or_404(file_id)
    if file.get("status") != "active":
        raise BadRequestError("File is not active")
    if file.get("is_directory"):
        raise BadRequestError("Cannot preview a folder")
    if not file.get("object_key"):
        raise BadRequestError("File has no object key")

    content_type = file.get("content_type")
    extension = file.get("extension")
    if not is_preview_supported(content_type, extension):
        raise BadRequestError("Preview not supported for this file type")

    url = minio_storage.presigned_get_url(file["object_key"], PRESIGNED_EXPIRY_SECONDS)
    activity(current_user.id, file, "preview")
    return {"url": url, "expires_in_seconds": PRESIGNED_EXPIRY_SECONDS}


def purge_expired(current_user: CurrentUser) -> dict:
    ensure_lead(current_user)
    now_iso = utc_now_iso()
    expired = file_repository.list_deleted_ready_for_purge(now_iso)

    purged_count = 0
    for file in expired:
        if file.get("object_key"):
            minio_storage.delete_object(file["object_key"])

        file_repository.update_file(file["id"], {
            "status": "purged",
            "object_key": None,
            "updated_at": now_iso,
        })
        activity(current_user.id, file, "purge")
        purged_count += 1

    return {"purged": purged_count}


def list_activity(file_id: str | None = None, limit: int = 50) -> list[dict]:
    return file_activity_repository.list_activity(file_id=file_id, limit=limit)
