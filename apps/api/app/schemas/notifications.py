from typing import Literal

from pydantic import BaseModel


NotificationType = Literal[
    "assigned",
    "reassigned",
    "status_changed",
    "pool_new",
    "replied",
    "done",
    "cancelled",
]


class NotificationOut(BaseModel):
    id: str
    user_id: str
    request_id: str | None = None
    type: NotificationType
    message: str
    is_read: bool
    created_at: str


class NotificationsReadAllOut(BaseModel):
    updated: int
