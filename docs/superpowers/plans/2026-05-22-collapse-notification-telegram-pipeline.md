# Collapse Notification + Telegram Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge 6 shallow notification/telegram modules into 1 deep `notification_module` with internal channel adapters.

**Architecture:** The new `notification_module` exposes a single public interface for notification CRUD + Telegram channel management. Telegram message building, sending, and webhook handling become internal adapters behind the notification seam. The `routes → services → repositories` pattern is preserved — routes only call the module's public interface.

**Tech Stack:** Python, FastAPI, Supabase Python client

---

## File Structure

### New files
- `apps/api/app/notification_module/__init__.py` — public interface exports
- `apps/api/app/notification_module/_store.py` — notification + delivery + telegram DB access (merged from notification_repository + telegram_repository)
- `apps/api/app/notification_module/_telegram.py` — telegram message building + sending (from services/telegram.py)
- `apps/api/app/notification_module/_webhook.py` — webhook /start command handling (from routes/telegram.py:68-138)

### Modified files
- `apps/api/app/routes/notifications.py` — import from notification_module
- `apps/api/app/routes/telegram.py` — import from notification_module, remove webhook logic
- `apps/api/app/services/request_service.py` — import from notification_module
- `apps/api/app/services/dashboard.py` — import from notification_module

### Deleted files (after migration + tests pass)
- `apps/api/app/repositories/notification_repository.py`
- `apps/api/app/repositories/telegram_repository.py`
- `apps/api/app/services/notifications.py`
- `apps/api/app/services/telegram.py`

### Test files (update mock paths)
- `apps/api/tests/test_notification_routes.py`
- `apps/api/tests/test_telegram_routes.py`
- `apps/api/tests/test_telegram_service.py`
- `apps/api/tests/test_notification_telegram_delivery.py`
- `apps/api/tests/test_notification_async.py`
- `apps/api/tests/test_request_service_create_assign_cancel.py`

---

## Task 1: Create `_store.py` — merge repositories

**Files:**
- Create: `apps/api/app/notification_module/_store.py`

- [ ] **Step 1:** Create the file with merged content from `notification_repository.py` + `telegram_repository.py`. All functions become module-level private functions (prefixed with `_` is optional — they're internal to the package).

```python
# apps/api/app/notification_module/_store.py
"""Internal: notification, delivery, and telegram DB access."""

from app.core.exceptions import NotFoundError
from app.db.supabase import get_supabase_admin


# --- Notification CRUD ---

def create_notification(
    *,
    user_id: str,
    request_id: str | None,
    notification_type: str,
    message: str,
) -> dict | None:
    result = (
        get_supabase_admin()
        .table("notifications")
        .insert(
            {
                "user_id": user_id,
                "request_id": request_id,
                "type": notification_type,
                "message": message,
            }
        )
        .execute()
    )
    return result.data[0] if result.data else None


def list_notifications(user_id: str, unread_only: bool = False) -> list[dict]:
    query = (
        get_supabase_admin()
        .table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
    )

    if unread_only:
        query = query.eq("is_read", False)

    result = query.execute()
    return result.data or []


def mark_notification_read(notification_id: str, user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise NotFoundError("Notification not found")

    return result.data[0]


def mark_all_notifications_read(user_id: str) -> int:
    result = (
        get_supabase_admin()
        .table("notifications")
        .update({"is_read": True})
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    return len(result.data or [])


# --- Delivery tracking ---

def create_delivery(*, notification_id: str, user_id: str, channel: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notification_deliveries")
        .insert(
            {
                "notification_id": notification_id,
                "user_id": user_id,
                "channel": channel,
                "status": "pending",
            }
        )
        .execute()
    )
    return result.data[0]


def mark_delivery_sent(delivery_id: str, provider_message_id: str | None, sent_at: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notification_deliveries")
        .update(
            {
                "status": "sent",
                "provider_message_id": provider_message_id,
                "error_message": None,
                "sent_at": sent_at,
            }
        )
        .eq("id", delivery_id)
        .execute()
    )
    return result.data[0]


def mark_delivery_failed(delivery_id: str, error_message: str) -> dict:
    result = (
        get_supabase_admin()
        .table("notification_deliveries")
        .update({"status": "failed", "error_message": error_message})
        .eq("id", delivery_id)
        .execute()
    )
    return result.data[0]


# --- Telegram user profile ---

def create_link_token(user_id: str, token: str, expires_at: str) -> dict:
    result = (
        get_supabase_admin()
        .table("telegram_link_tokens")
        .insert({"user_id": user_id, "token": token, "expires_at": expires_at})
        .execute()
    )
    return result.data[0]


def get_valid_link_token(token: str, now: str) -> dict | None:
    result = (
        get_supabase_admin()
        .table("telegram_link_tokens")
        .select("*")
        .eq("token", token)
        .is_("used_at", "null")
        .gt("expires_at", now)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def mark_link_token_used(token_id: str, used_at: str) -> None:
    (
        get_supabase_admin()
        .table("telegram_link_tokens")
        .update({"used_at": used_at})
        .eq("id", token_id)
        .execute()
    )


def get_user_telegram_profile(user_id: str) -> dict | None:
    result = (
        get_supabase_admin()
        .table("users")
        .select("id, telegram_chat_id, telegram_username, telegram_linked_at, preferred_language")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


def link_telegram_user(
    user_id: str,
    chat_id: str,
    username: str | None,
    linked_at: str,
) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update(
            {
                "telegram_chat_id": chat_id,
                "telegram_username": username,
                "telegram_linked_at": linked_at,
            }
        )
        .eq("id", user_id)
        .execute()
    )
    return result.data[0]


def unlink_telegram_user(user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table("users")
        .update(
            {
                "telegram_chat_id": None,
                "telegram_username": None,
                "telegram_linked_at": None,
            }
        )
        .eq("id", user_id)
        .execute()
    )
    return result.data[0]
```

- [ ] **Step 2:** Verify syntax: `cd apps/api && uv run python -c "from app.notification_module._store import create_notification"`

---

## Task 2: Create `_telegram.py` — message building + sending

**Files:**
- Create: `apps/api/app/notification_module/_telegram.py`

- [ ] **Step 1:** Copy content from `services/telegram.py` unchanged. This is the message builder + HTTP sender.

```python
# apps/api/app/notification_module/_telegram.py
"""Internal: Telegram message building and sending."""

import httpx

PRIORITY_LABELS = {
    "en": {
        "low": "Low",
        "medium": "Medium",
        "high": "High",
        "urgent": "Urgent",
    },
    "vi": {
        "low": "Thấp",
        "medium": "Trung bình",
        "high": "Cao",
        "urgent": "Khẩn cấp",
    },
}

STATUS_LABELS = {
    "en": {
        "pending": "Pending",
        "acknowledged": "Acknowledged",
        "in_progress": "In progress",
        "done": "Done",
        "cancelled": "Cancelled",
    },
    "vi": {
        "pending": "Đang chờ",
        "acknowledged": "Đã xác nhận",
        "in_progress": "Đang xử lý",
        "done": "Hoàn tất",
        "cancelled": "Đã hủy",
    },
}

HEADING_LABELS = {
    "en": {
        "assigned": "You have been assigned a new task",
        "reassigned": "You have been reassigned a task",
    },
    "vi": {
        "assigned": "Bạn vừa được giao task mới",
        "reassigned": "Bạn vừa được giao lại một task",
    },
}

FIELD_LABELS = {
    "en": {"title": "Title", "priority": "Priority", "status": "Status", "openTask": "Open task"},
    "vi": {"title": "Tiêu đề", "priority": "Độ ưu tiên", "status": "Trạng thái", "openTask": "Mở task"},
}


def build_assignment_message(request: dict, *, reassigned: bool, app_base_url: str, lang: str = "vi") -> str:
    labels = "vi" if lang not in ("en", "vi") else lang
    priority_map = PRIORITY_LABELS[labels]
    status_map = STATUS_LABELS[labels]
    field = FIELD_LABELS[labels]
    heading_key = "reassigned" if reassigned else "assigned"
    heading = HEADING_LABELS[labels][heading_key]
    priority = priority_map.get(request.get("priority"), request.get("priority", ""))
    status = status_map.get(request.get("status"), request.get("status", ""))
    return (
        f"{heading}\n\n"
        f"{field['title']}: {request['title']}\n"
        f"{field['priority']}: {priority}\n"
        f"{field['status']}: {status}\n\n"
        f"{field['openTask']}: {app_base_url}/requests/{request['id']}"
    )


def send_telegram_message(*, bot_token: str, chat_id: str, text: str) -> str | None:
    response = httpx.post(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        json={"chat_id": chat_id, "text": text, "disable_web_page_preview": True},
        timeout=10,
    )
    response.raise_for_status()
    payload = response.json()
    message_id = payload.get("result", {}).get("message_id")
    return str(message_id) if message_id is not None else None
```

- [ ] **Step 2:** Verify syntax: `cd apps/api && uv run python -c "from app.notification_module._telegram import build_assignment_message"`

---

## Task 3: Create `_webhook.py` — extract webhook logic

**Files:**
- Create: `apps/api/app/notification_module/_webhook.py`

- [ ] **Step 1:** Extract webhook handling from `routes/telegram.py:68-138` into a service function. This is the key seam violation fix — route no longer calls repository directly.

```python
# apps/api/app/notification_module/_webhook.py
"""Internal: Telegram webhook /start command handling."""

import re

from app.core.config import get_settings
from app.notification_module import _store, _telegram

START_COMMAND_PATTERN = re.compile(r"^/start(?:@\w+)?(?:\s+(.+))?$")


def handle_webhook(body: dict, secret_token: str | None) -> dict:
    """Process Telegram webhook update. Returns {"ok": bool}."""
    settings = get_settings()

    if settings.telegram_webhook_secret:
        if secret_token != settings.telegram_webhook_secret:
            return {"ok": False}

    message = body.get("message")
    if not message:
        return {"ok": True}

    chat = message.get("chat", {})
    chat_id = str(chat.get("id", ""))
    username = chat.get("username")
    text = message.get("text", "")

    match = START_COMMAND_PATTERN.match(text.strip())
    if not match:
        return {"ok": True}

    link_code = (match.group(1) or "").strip()
    if not link_code:
        if settings.telegram_bot_token and chat_id:
            _telegram.send_telegram_message(
                bot_token=settings.telegram_bot_token,
                chat_id=chat_id,
                text=(
                    "Bạn đang mở bot, nhưng chưa có mã liên kết.\n"
                    "Vui lòng quay lại Team Request Hub, bấm 'Liên kết Telegram' rồi mở lại link mới."
                ),
            )
        return {"ok": True}

    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat()
    token_record = _store.get_valid_link_token(link_code, now)

    if not token_record:
        if settings.telegram_bot_token and chat_id:
            _telegram.send_telegram_message(
                bot_token=settings.telegram_bot_token,
                chat_id=chat_id,
                text=(
                    "Mã liên kết không hợp lệ hoặc đã hết hạn.\n"
                    "Vui lòng quay lại Team Request Hub để tạo liên kết mới."
                ),
            )
        return {"ok": True}

    _store.link_telegram_user(
        user_id=token_record["user_id"],
        chat_id=chat_id,
        username=username,
        linked_at=now,
    )
    _store.mark_link_token_used(token_record["id"], now)

    if settings.telegram_bot_token:
        _telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=chat_id,
            text=(
                "Đã liên kết Telegram với Team Request Hub.\n"
                "Từ giờ bạn sẽ nhận thông báo khi được giao task."
            ),
        )

    return {"ok": True}
```

- [ ] **Step 2:** Verify syntax: `cd apps/api && uv run python -c "from app.notification_module._webhook import handle_webhook"`

---

## Task 4: Create `__init__.py` — public interface

**Files:**
- Create: `apps/api/app/notification_module/__init__.py`

- [ ] **Step 1:** Create the public interface that re-exports what callers need. This is the ONLY file callers should import from.

```python
# apps/api/app/notification_module/__init__.py
"""Notification module — public interface.

Callers import from here. Internal modules (_store, _telegram, _webhook)
are not part of the public API.
"""

import logging

from app.core.config import get_settings
from app.notification_module import _store, _telegram, _webhook

logger = logging.getLogger(__name__)

TELEGRAM_TYPES = {"assigned", "reassigned"}


# --- Notification CRUD (delegated to _store) ---

def create_notification(
    *,
    user_id: str,
    request_id: str | None,
    notification_type: str,
    message: str,
) -> dict | None:
    return _store.create_notification(
        user_id=user_id,
        request_id=request_id,
        notification_type=notification_type,
        message=message,
    )


def list_notifications(user_id: str, unread_only: bool = False) -> list[dict]:
    return _store.list_notifications(user_id, unread_only)


def mark_notification_read(notification_id: str, user_id: str) -> dict:
    return _store.mark_notification_read(notification_id, user_id)


def mark_all_notifications_read(user_id: str) -> dict:
    return {"updated": _store.mark_all_notifications_read(user_id)}


# --- Telegram channel management ---

def get_telegram_profile(user_id: str) -> dict | None:
    return _store.get_user_telegram_profile(user_id)


def link_telegram(user_id: str, chat_id: str, username: str | None, linked_at: str) -> dict:
    return _store.link_telegram_user(user_id, chat_id, username, linked_at)


def unlink_telegram(user_id: str) -> dict:
    return _store.unlink_telegram_user(user_id)


def create_link_token(user_id: str, token: str, expires_at: str) -> dict:
    return _store.create_link_token(user_id, token, expires_at)


# --- Telegram dispatch ---

def dispatch_telegram_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        return

    user_id = notification["user_id"]
    profile = _store.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return

    notification_type = notification.get("type", "assigned")
    reassigned = notification_type == "reassigned"
    lang = (profile.get("preferred_language") or "vi")

    text = _telegram.build_assignment_message(
        request,
        reassigned=reassigned,
        app_base_url=settings.app_base_url,
        lang=lang,
    )

    delivery = _store.create_delivery(
        notification_id=notification["id"],
        user_id=user_id,
        channel="telegram",
    )

    try:
        from datetime import datetime, timezone

        provider_message_id = _telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=profile["telegram_chat_id"],
            text=text,
        )
        _store.mark_delivery_sent(
            delivery["id"],
            provider_message_id,
            datetime.now(timezone.utc).isoformat(),
        )
    except Exception as exc:
        logger.warning(
            "Telegram delivery failed for notification %s: %s",
            notification["id"],
            exc,
        )
        _store.mark_delivery_failed(delivery["id"], str(exc))


def dispatch_telegram_background(user_id: str, request: dict, is_reassigned: bool) -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        return
    profile = _store.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return
    lang = profile.get("preferred_language") or "vi"
    text = _telegram.build_assignment_message(
        request,
        reassigned=is_reassigned,
        app_base_url=settings.app_base_url,
        lang=lang,
    )
    try:
        _telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=profile["telegram_chat_id"],
            text=text,
        )
    except Exception as exc:
        logger.warning(
            "Background Telegram dispatch failed for user %s: %s",
            user_id,
            exc,
        )


# --- Workflow helpers (used by request_service) ---

def notify_assigned(user_id: str, request: dict) -> dict | None:
    notification = create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"You were assigned a request: {request['title']}",
    )
    return notification


def notify_request_picked_up(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="assigned",
        message=f"Your request was picked up: {request['title']}",
    )


def notify_reassigned(user_id: str, request: dict) -> dict | None:
    notification = create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="reassigned",
        message=f"You were reassigned a request: {request['title']}",
    )
    return notification


def notify_status_changed(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="status_changed",
        message=f"Request status changed: {request['title']}",
    )


def notify_done(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="done",
        message=f"Request was completed: {request['title']}",
    )


def notify_cancelled(user_id: str, request: dict) -> dict | None:
    return create_notification(
        user_id=user_id,
        request_id=request["id"],
        notification_type="cancelled",
        message=f"Request was cancelled: {request['title']}",
    )


# --- Webhook ---

def handle_webhook(body: dict, secret_token: str | None) -> dict:
    return _webhook.handle_webhook(body, secret_token)
```

- [ ] **Step 2:** Verify import: `cd apps/api && uv run python -c "from app.notification_module import create_notification, handle_webhook"`

---

## Task 5: Update routes to use notification_module

**Files:**
- Modify: `apps/api/app/routes/notifications.py`
- Modify: `apps/api/app/routes/telegram.py`

- [ ] **Step 1:** Update `routes/notifications.py` — change import from `app.services.notifications` to `app.notification_module`.

```python
# apps/api/app/routes/notifications.py
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.notifications import NotificationOut, NotificationsReadAllOut
from app.schemas.users import CurrentUser
from app import notification_module

router = APIRouter()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    unread_only: bool = False,
):
    require_active_current_user(current_user)
    return notification_module.list_notifications(current_user.id, unread_only)


@router.post("/read-all", response_model=NotificationsReadAllOut)
async def mark_all_notifications_read(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.mark_all_notifications_read(current_user.id)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.mark_notification_read(notification_id, current_user.id)
```

- [ ] **Step 2:** Rewrite `routes/telegram.py` — route becomes thin pass-through to notification_module.

```python
# apps/api/app/routes/telegram.py
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Request

from app.core.auth import get_current_user, require_active_current_user
from app.core.config import get_settings
from app.schemas.telegram import TelegramLinkOut, TelegramProfileOut
from app.schemas.users import CurrentUser
from app import notification_module

router = APIRouter()


@router.get("/profile", response_model=TelegramProfileOut)
async def get_telegram_profile(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    profile = notification_module.get_telegram_profile(current_user.id)
    if not profile or not profile.get("telegram_chat_id"):
        return TelegramProfileOut(linked=False)
    return TelegramProfileOut(
        linked=True,
        username=profile.get("telegram_username"),
        linked_at=profile.get("telegram_linked_at"),
    )


@router.post("/link", response_model=TelegramLinkOut)
async def create_telegram_link(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    settings = get_settings()
    if not settings.telegram_bot_username:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Telegram integration is not configured",
        )

    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    notification_module.create_link_token(current_user.id, token, expires_at)
    url = f"https://t.me/{settings.telegram_bot_username}?start={token}"
    return TelegramLinkOut(url=url, expires_at=expires_at)


@router.delete("/link", response_model=TelegramProfileOut)
async def unlink_telegram(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    notification_module.unlink_telegram(current_user.id)
    return TelegramProfileOut(linked=False)


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(None),
):
    body = await request.json()
    return notification_module.handle_webhook(body, x_telegram_bot_api_secret_token)
```

- [ ] **Step 3:** Verify imports: `cd apps/api && uv run python -c "from app.routes.notifications import router; from app.routes.telegram import router"`

---

## Task 6: Update services to use notification_module

**Files:**
- Modify: `apps/api/app/services/request_service.py`
- Modify: `apps/api/app/services/dashboard.py`

- [ ] **Step 1:** Update `request_service.py` — change `from app.services import notifications` to `from app import notification_module`. Replace all `notifications.` calls with `notification_module.`.

The change is in the import line and all call sites. The function signatures stay identical.

- [ ] **Step 2:** Update `dashboard.py` — change `from app.services import notifications` to `from app import notification_module`. Replace `notifications.list_notifications` with `notification_module.list_notifications`.

- [ ] **Step 3:** Verify: `cd apps/api && uv run python -c "from app.services.request_service import create_request; from app.services.dashboard import get_dashboard_summary"`

---

## Task 7: Update test mock paths

**Files:**
- Modify: `apps/api/tests/test_notification_routes.py`
- Modify: `apps/api/tests/test_telegram_routes.py`
- Modify: `apps/api/tests/test_telegram_service.py`
- Modify: `apps/api/tests/test_notification_telegram_delivery.py`
- Modify: `apps/api/tests/test_notification_async.py`
- Modify: `apps/api/tests/test_request_service_create_assign_cancel.py`

The key change: all mock paths that reference `app.services.notifications.*`, `app.services.telegram.*`, `app.repositories.notification_repository.*`, `app.repositories.telegram_repository.*` must be updated to `app.notification_module.*` or `app.notification_module._store.*` or `app.notification_module._telegram.*`.

- [ ] **Step 1:** Update `test_notification_routes.py`:
  - `app.services.notifications.list_notifications` → `app.notification_module.list_notifications`
  - `app.services.notifications.mark_all_notifications_read` → `app.notification_module.mark_all_notifications_read`
  - `app.services.notifications.mark_notification_read` → `app.notification_module.mark_notification_read`

- [ ] **Step 2:** Update `test_telegram_routes.py`:
  - `app.routes.telegram.telegram_repository` → `app.notification_module._store`
  - `app.routes.telegram.telegram` → `app.notification_module._telegram`
  - `app.routes.telegram.get_settings` → `app.notification_module._webhook.get_settings`

- [ ] **Step 3:** Update `test_telegram_service.py`:
  - `from app.services import telegram` → `from app.notification_module import _telegram as telegram`

- [ ] **Step 4:** Update `test_notification_telegram_delivery.py`:
  - `app.services.notifications.get_settings` → `app.notification_module.get_settings`
  - `app.services.notifications.telegram` → `app.notification_module._telegram`
  - `app.services.notifications.telegram_repository` → `app.notification_module._store`
  - `app.services.notifications.notification_repository` → `app.notification_module._store`

- [ ] **Step 5:** Update `test_notification_async.py`:
  - `app.services.notifications.notification_repository.create_notification` → `app.notification_module._store.create_notification`
  - `app.services.notifications.dispatch_telegram_delivery` → `app.notification_module.dispatch_telegram_delivery`

- [ ] **Step 6:** Update `test_request_service_create_assign_cancel.py`:
  - `app.services.notifications.notify_assigned` → `app.notification_module.notify_assigned`
  - Any other `app.services.notifications.*` → `app.notification_module.*`

- [ ] **Step 7:** Run all tests: `cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests`

---

## Task 8: Delete old files

**Files:**
- Delete: `apps/api/app/repositories/notification_repository.py`
- Delete: `apps/api/app/repositories/telegram_repository.py`
- Delete: `apps/api/app/services/notifications.py`
- Delete: `apps/api/app/services/telegram.py`

- [ ] **Step 1:** Delete the 4 old files.
- [ ] **Step 2:** Update `apps/api/app/repositories/__init__.py` if it imports the deleted modules.
- [ ] **Step 3:** Update `apps/api/app/services/__init__.py` if it imports the deleted modules.
- [ ] **Step 4:** Run all tests: `cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests`
- [ ] **Step 5:** Start server to verify: `cd apps/api && uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000`
