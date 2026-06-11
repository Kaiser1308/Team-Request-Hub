from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.core.exceptions import BadRequestError, ConflictError, DomainError, ForbiddenError, GoneError, NotFoundError
from app.repositories import file_activity_repository, file_repository
from app.schemas.files import CompleteUploadRequest, CreateFolderRequest, MoveFileRequest, RenameFileRequest, UploadUrlRequest, BatchCopyFilesRequest, BatchMoveFilesRequest, CopyFileRequest
from app.schemas.users import CurrentUser
from app.services import file_tree, minio_storage
from app.utils.time import utc_now_iso

MAX_FILE_SIZE_BYTES = 209_715_200
PRESIGNED_EXPIRY_SECONDS = 300
PURGE_AFTER_DAYS = 7
PREVIEW_TYPES = {
    ("image/png", "png"), ("image/jpeg", "jpg"), ("image/jpeg", "jpeg"),
    ("image/gif", "gif"), ("image/webp", "webp"), ("application/pdf", "pdf"),
    ("text/markdown", "md"), ("text/markdown", "markdown"),
    ("text/html", "html"), ("text/html", "htm"),
}
PREVIEW_EXTENSIONS = {ext for _, ext in PREVIEW_TYPES}
TEXT_PREVIEW_EXTENSIONS = {"md", "markdown", "html", "htm"}
TEXT_PREVIEW_CONTENT_TYPES = {"text/markdown", "text/html", "text/plain"}


def is_lead(current_user: CurrentUser) -> bool:
    return current_user.role == "lead"


def ensure_lead(current_user: CurrentUser) -> None:
    if not is_lead(current_user):
        raise ForbiddenError("Only leads can perform this action")


def normalize_path(path: str) -> str:
    return file_tree.normalize_path(path)


def validate_name(name: str) -> str:
    return file_tree.validate_name(name)


def build_child_path(parent_path: str, name: str) -> str:
    return file_tree.child_path(parent_path, name)


def get_extension(name: str) -> str | None:
    if "." not in name:
        return None
    base, ext = name.rsplit(".", 1)
    if not ext or not base:
        return None
    return ext.lower()


def is_preview_supported(content_type: str | None, extension: str | None) -> bool:
    normalized_extension = extension.lower() if extension else None
    if normalized_extension in PREVIEW_EXTENSIONS:
        return True
    if content_type:
        for ct, _ in PREVIEW_TYPES:
            if ct == content_type:
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
    object_key = f"{uuid4()}-{name}"
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
        file_repository.update_descendants(file_tree.descendant_prefix(old_path), {"updated_by": current_user.id})

    activity(current_user.id, updated, "rename", old_path=old_path, new_path=new_path)
    return updated


def move_file(file_id: str, payload: MoveFileRequest, current_user: CurrentUser) -> dict:
    file = file_repository.get_file_or_404(file_id)
    if file.get("status") != "active":
        raise NotFoundError("File not found")
    new_parent = normalize_path(payload.parent_path)
    file_tree.assert_can_move(file, new_parent)
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
        file_repository.update_descendants(file_tree.descendant_prefix(old_path), {"updated_by": current_user.id})

    activity(current_user.id, updated, "move", old_path=old_path, new_path=new_path)
    return updated


def soft_delete_file(file_id: str, current_user: CurrentUser) -> dict:
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

    filename = str(file.get("name") or "download").replace("\\", "_").replace('"', "_")
    url = minio_storage.presigned_get_url(
        file["object_key"],
        PRESIGNED_EXPIRY_SECONDS,
        response_headers={
            "response-content-disposition": f'attachment; filename="{filename}"',
        },
    )
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


def get_preview_content(file_id: str, current_user: CurrentUser) -> tuple[bytes, str]:
    file = file_repository.get_file_or_404(file_id)
    if file.get("status") != "active":
        raise BadRequestError("File is not active")
    if file.get("is_directory"):
        raise BadRequestError("Cannot preview a folder")
    if not file.get("object_key"):
        raise BadRequestError("File has no object key")

    extension = (file.get("extension") or "").lower()
    content_type = (file.get("content_type") or "").lower()
    is_text_preview = (
        extension in TEXT_PREVIEW_EXTENSIONS
        or content_type in TEXT_PREVIEW_CONTENT_TYPES
    )
    if not is_text_preview:
        raise BadRequestError("Preview content only supported for markdown and html files")

    try:
        content = minio_storage.get_object_bytes(file["object_key"])
    except DomainError:
        try:
            content = minio_storage.get_object_bytes_via_presigned_url(file["object_key"])
        except DomainError as exc:
            raise BadRequestError("Unable to read preview content from storage") from exc
    media_type = (
        "text/html; charset=utf-8"
        if extension in {"html", "htm"} or content_type == "text/html"
        else "text/markdown; charset=utf-8"
    )
    activity(current_user.id, file, "preview")
    return content, media_type


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


def list_tree(include_deleted: bool = False) -> list[dict]:
    return file_repository.list_all(include_deleted=include_deleted)


def batch_copy_files(payload: BatchCopyFilesRequest, current_user: CurrentUser) -> list[dict]:
    ensure_lead(current_user)
    dest = normalize_path(payload.parent_path)
    now = utc_now_iso()
    results: list[dict] = []

    for file_id in payload.file_ids:
        src = file_repository.get_file_or_404(file_id)
        if src.get("status") != "active":
            continue

        new_name = src["name"]
        new_path = build_child_path(dest, new_name)

        counter = 1
        base, ext = (new_name.rsplit(".", 1) if "." in new_name else (new_name, None))
        while file_repository.get_by_path(new_path) and file_repository.get_by_path(new_path).get("status") != "purged":
            new_name = f"{base} - Copy ({counter})" + (f".{ext}" if ext else "")
            new_path = build_child_path(dest, new_name)
            counter += 1

        new_object_key = None
        if not src.get("is_directory") and src.get("object_key"):
            new_object_key = f"{uuid4()}-{new_name}"
            minio_storage.copy_object(src["object_key"], new_object_key)

        copied = file_repository.create_file({
            "name": new_name,
            "path": new_path,
            "parent_path": dest,
            "is_directory": src.get("is_directory", False),
            "object_key": new_object_key,
            "size_bytes": src.get("size_bytes", 0),
            "content_type": src.get("content_type"),
            "extension": src.get("extension"),
            "status": "active",
            "created_by": current_user.id,
            "created_at": now,
            "updated_at": now,
        })
        activity(current_user.id, copied, "move", old_path=src["path"], new_path=new_path,
                 metadata={"operation": "copy"})
        results.append(copied)

    return results


def batch_move_files(payload: BatchMoveFilesRequest, current_user: CurrentUser) -> list[dict]:
    dest = normalize_path(payload.parent_path)
    results: list[dict] = []

    for file_id in payload.file_ids:
        file = file_repository.get_file_or_404(file_id)
        if file.get("status") != "active":
            continue
        file_tree.assert_can_move(file, dest)
        old_path = file["path"]
        new_path = build_child_path(dest, file["name"])
        if new_path == old_path:
            results.append(file)
            continue
        ensure_available_path(new_path)
        updated = file_repository.update_file(file_id, {
            "parent_path": dest,
            "path": new_path,
            "updated_by": current_user.id,
        })
        if file.get("is_directory"):
            file_repository.update_descendants(file_tree.descendant_prefix(old_path), {"updated_by": current_user.id})
        activity(current_user.id, updated, "move", old_path=old_path, new_path=new_path)
        results.append(updated)

    return results
