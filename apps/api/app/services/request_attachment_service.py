from uuid import uuid4

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.repositories import request_attachment_repository
from app.schemas.users import CurrentUser
from app.services import minio_storage
from app.utils.time import utc_now_iso

MAX_ATTACHMENT_SIZE_BYTES = 52_428_800
PRESIGNED_EXPIRY_SECONDS = 300
ALLOWED_CONTEXTS = {"request", "done_reply"}


def create_upload_url(
    *,
    name: str,
    content_type: str,
    size_bytes: int,
    context: str,
    current_user: CurrentUser,
) -> dict:
    if context not in ALLOWED_CONTEXTS:
        raise BadRequestError(f"Invalid context: {context}")
    if size_bytes > MAX_ATTACHMENT_SIZE_BYTES:
        raise BadRequestError(f"File size exceeds maximum of {MAX_ATTACHMENT_SIZE_BYTES} bytes")
    if not name.strip():
        raise BadRequestError("File name is required")

    object_key = f"request-attachments/{uuid4()}-{name}"
    now = utc_now_iso()

    attachment = request_attachment_repository.create_attachment({
        "request_id": None,
        "context": context,
        "status": "pending_upload",
        "name": name.strip(),
        "object_key": object_key,
        "content_type": content_type,
        "size_bytes": size_bytes,
        "uploaded_by": current_user.id,
        "created_at": now,
        "updated_at": now,
    })

    upload_url = minio_storage.presigned_put_url(object_key, PRESIGNED_EXPIRY_SECONDS)

    return {
        "attachment": attachment,
        "upload_url": upload_url,
        "method": "PUT",
        "expires_in_seconds": PRESIGNED_EXPIRY_SECONDS,
    }


def complete_upload(attachment_id: str, size_bytes: int, current_user: CurrentUser) -> dict:
    attachment = request_attachment_repository.get_attachment_or_404(attachment_id)
    if attachment["uploaded_by"] != current_user.id:
        raise ForbiddenError("You can only complete your own uploads")
    if attachment["status"] != "pending_upload":
        raise BadRequestError("Attachment is not in pending_upload status")

    now = utc_now_iso()
    return request_attachment_repository.update_attachment(attachment_id, {
        "status": "active",
        "size_bytes": size_bytes,
        "updated_at": now,
    })


def create_preview_url(attachment_id: str, current_user: CurrentUser) -> dict:
    attachment = request_attachment_repository.get_attachment_or_404(attachment_id)
    if attachment["status"] != "active":
        raise NotFoundError("Attachment not found")

    url = minio_storage.presigned_get_url(attachment["object_key"], PRESIGNED_EXPIRY_SECONDS)

    return {
        "url": url,
        "expires_in_seconds": PRESIGNED_EXPIRY_SECONDS,
    }


def link_attachments_to_request(attachment_ids: list[str], request_id: str, user_id: str, context: str) -> None:
    if not attachment_ids:
        return
    now = utc_now_iso()
    for attachment_id in attachment_ids[:5]:
        try:
            attachment = request_attachment_repository.get_attachment_or_404(attachment_id)
        except Exception:
            continue
        if attachment["uploaded_by"] != user_id:
            continue
        if attachment["status"] != "active":
            continue
        if attachment.get("request_id") is not None:
            continue
        if attachment["context"] != context:
            continue
        request_attachment_repository.update_attachment(attachment_id, {
            "request_id": request_id,
            "updated_at": now,
        })
