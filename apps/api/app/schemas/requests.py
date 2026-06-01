from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import RequestPriority, RequestStatus

RequestAttachmentContext = Literal["request", "done_reply"]
RequestAttachmentStatus = Literal["pending_upload", "active", "deleted"]


class RequestAttachmentUploadUrlRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    content_type: str = Field(min_length=1, max_length=120)
    size_bytes: int = Field(gt=0)
    context: RequestAttachmentContext


class RequestAttachmentCompleteRequest(BaseModel):
    size_bytes: int = Field(gt=0)


class RequestAttachmentOut(BaseModel):
    id: str
    request_id: str | None = None
    context: RequestAttachmentContext
    status: RequestAttachmentStatus
    name: str
    content_type: str
    size_bytes: int
    uploaded_by: str
    created_at: str
    updated_at: str


class RequestAttachmentUploadUrlOut(BaseModel):
    attachment: RequestAttachmentOut
    upload_url: str
    method: str = "PUT"
    expires_in_seconds: int


class RequestAttachmentPreviewUrlOut(BaseModel):
    url: str
    expires_in_seconds: int


class RequestAttachmentsGrouped(BaseModel):
    request: list[RequestAttachmentOut] = Field(default_factory=list)
    done_reply: list[RequestAttachmentOut] = Field(default_factory=list)


class UserSummary(BaseModel):
    id: str
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None


class InternalRequestBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    priority: RequestPriority = "medium"
    assigned_to: str | None = None
    assignee_ids: list[str] = Field(default_factory=list)
    reference_links: list[str] = Field(default_factory=list)
    attachment_ids: list[str] = Field(default_factory=list)


class InternalRequestCreate(InternalRequestBase):
    pass


class InternalRequestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1)
    tags: list[str] | None = None
    priority: RequestPriority | None = None
    reference_links: list[str] | None = None


class AssignRequest(BaseModel):
    assigned_to: str
    reason: str | None = None


class ReassignRequest(BaseModel):
    assigned_to: str
    reason: str | None = None


class StatusUpdateRequest(BaseModel):
    status: RequestStatus
    reason: str | None = None


class DoneRequest(BaseModel):
    reply: str = Field(min_length=1)
    attachment_ids: list[str] = Field(default_factory=list)


class CancelRequest(BaseModel):
    reason: str | None = None


class AddAssigneeRequest(BaseModel):
    user_id: str
    reason: str | None = None


class RemoveAssigneeRequest(BaseModel):
    reason: str | None = None


class InternalRequestOut(BaseModel):
    id: str
    title: str
    description: str
    tags: list[str]
    priority: RequestPriority
    status: RequestStatus
    created_by: str
    assigned_to: str | None = None
    reference_links: list[str]
    reply: str | None = None
    acknowledged_at: str | None = None
    started_at: str | None = None
    done_at: str | None = None
    cancelled_at: str | None = None
    created_at: str
    updated_at: str
    creator: UserSummary | None = None
    assignee: UserSummary | None = None
    assignees: list[UserSummary] = Field(default_factory=list)
    attachments: RequestAttachmentsGrouped = Field(default_factory=RequestAttachmentsGrouped)


class AssignmentHistoryOut(BaseModel):
    id: str
    request_id: str
    from_user_id: str | None = None
    to_user_id: str
    assigned_by: str
    reason: str | None = None
    created_at: str


class RequestStatusLogOut(BaseModel):
    id: str
    request_id: str
    from_status: RequestStatus | None = None
    to_status: RequestStatus
    changed_by: str
    reason: str | None = None
    created_at: str
