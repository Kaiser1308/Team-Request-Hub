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


class NotificationsReadByTypeIn(BaseModel):
    types: list[NotificationType]


NotificationChannel = Literal["telegram", "email", "web_push"]


class NotificationPreferenceOut(BaseModel):
    channel: NotificationChannel
    enabled: bool


class NotificationPreferencesUpdateIn(BaseModel):
    telegram: bool | None = None
    email: bool | None = None
    web_push: bool | None = None


class WebPushPublicKeyOut(BaseModel):
    public_key: str


class WebPushKeysIn(BaseModel):
    p256dh: str
    auth: str


class WebPushSubscriptionIn(BaseModel):
    endpoint: str
    keys: WebPushKeysIn


class WebPushSubscriptionOut(BaseModel):
    id: str
    endpoint: str


class WebPushSubscriptionRevokeOut(BaseModel):
    revoked: bool
