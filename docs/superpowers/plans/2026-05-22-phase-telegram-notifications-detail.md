# Telegram Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Telegram delivery for task assignment notifications, with Vietnamese message text and auditable send status.

**Architecture:** Keep request workflow ownership in `apps/api/app/services/request_service.py` and attach Telegram delivery behind the existing notification service. The first phase sends Telegram messages for `assigned` and `reassigned` notifications only, records delivery outcomes, and never blocks request assignment success if Telegram fails.

**Tech Stack:** FastAPI, Supabase PostgreSQL, Pydantic Settings, Telegram Bot API, Next.js dashboard UI.

---

## Scope

This phase delivers:

- One shared Telegram bot for the whole app.
- User self-linking through a one-time `/start <link_code>` Telegram deep link.
- Vietnamese Telegram messages for direct assignment and reassignment.
- Delivery tracking through `notification_deliveries`.
- Backend tests for link flow and notification delivery.
- Minimal frontend UI for linking/unlinking Telegram.

This phase does not deliver:

- Background worker or retry scheduler.
- Telegram delivery for every notification type.
- WhatsApp, Slack, Teams, Zalo, email, or SMS.
- Telegram group chat routing.

## Product Behavior

### Link Telegram

1. User opens account/settings UI.
2. User clicks `Link Telegram`.
3. Frontend calls backend to create a one-time link token.
4. Backend returns a Telegram deep link:

```txt
https://t.me/<bot_username>?start=<link_code>
```

5. User opens the link and presses Start in Telegram.
6. Telegram sends a webhook update to FastAPI.
7. Backend validates the code, stores the user's `telegram_chat_id`, and replies in Vietnamese.

Success reply:

```txt
Đã liên kết Telegram với Team Request Hub.
Từ giờ bạn sẽ nhận thông báo khi được giao task.
```

Expired or invalid reply:

```txt
Mã liên kết không hợp lệ hoặc đã hết hạn.
Vui lòng quay lại Team Request Hub để tạo liên kết mới.
```

### Assignment Message

Send this when a user is assigned on create or reassigned:

```txt
Bạn vừa được giao task mới

Tiêu đề: {title}
Độ ưu tiên: {priority_label}
Trạng thái: {status_label}

Mở task: {app_base_url}/requests/{request_id}
```

For reassignment:

```txt
Bạn vừa được giao lại một task

Tiêu đề: {title}
Độ ưu tiên: {priority_label}
Trạng thái: {status_label}

Mở task: {app_base_url}/requests/{request_id}
```

Use Vietnamese labels:

```python
PRIORITY_LABELS = {
    "low": "Thấp",
    "medium": "Trung bình",
    "high": "Cao",
    "urgent": "Khẩn cấp",
}

STATUS_LABELS = {
    "pending": "Đang chờ",
    "acknowledged": "Đã xác nhận",
    "in_progress": "Đang xử lý",
    "done": "Hoàn tất",
    "cancelled": "Đã hủy",
}
```

## File Map

- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `docs/database-schema.md`
- Modify: `docs/api-contract.md`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/requirements.txt`
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/app/services/notifications.py`
- Modify: `apps/api/app/repositories/notification_repository.py`
- Modify: `apps/api/app/repositories/user_repository.py`
- Create: `apps/api/app/repositories/telegram_repository.py`
- Create: `apps/api/app/services/telegram.py`
- Create: `apps/api/app/routes/telegram.py`
- Create: `apps/api/app/schemas/telegram.py`
- Create: `apps/api/tests/test_telegram_service.py`
- Create: `apps/api/tests/test_telegram_routes.py`
- Create: `apps/api/tests/test_notification_telegram_delivery.py`
- Modify: `apps/web/src/lib/api/users.ts` or create `apps/web/src/lib/api/telegram.ts`
- Add UI in the existing profile/settings surface. If no settings page exists, add a compact Telegram linking panel to the dashboard shell or user/admin area without changing request workflow UI.

## Database Design

### Task 1: Extend users for Telegram profile

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `docs/database-schema.md`

- [ ] **Step 1: Add nullable Telegram columns to `public.users`**

```sql
alter table public.users
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_username text,
  add column if not exists telegram_linked_at timestamptz;

create unique index if not exists idx_users_telegram_chat_id
  on public.users(telegram_chat_id)
  where telegram_chat_id is not null;
```

- [ ] **Step 2: Document user Telegram fields**

Update `docs/database-schema.md` users table section:

```md
- `public.users`: application profile for `auth.users`, including `role`, `is_active`, profile metadata, and optional Telegram linking fields.
```

### Task 2: Add Telegram link token table

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`

- [ ] **Step 1: Create `telegram_link_tokens`**

```sql
create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_link_tokens_user_id
  on public.telegram_link_tokens(user_id);

create index if not exists idx_telegram_link_tokens_token
  on public.telegram_link_tokens(token);
```

### Task 3: Add delivery tracking table

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`

- [ ] **Step 1: Create delivery enum**

```sql
do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type notification_channel as enum ('telegram');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_delivery_status') then
    create type notification_delivery_status as enum ('pending', 'sent', 'failed');
  end if;
end $$;
```

- [ ] **Step 2: Create `notification_deliveries`**

```sql
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  channel notification_channel not null,
  status notification_delivery_status not null default 'pending',
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_deliveries_notification_id
  on public.notification_deliveries(notification_id);

create index if not exists idx_notification_deliveries_user_channel
  on public.notification_deliveries(user_id, channel);

create index if not exists idx_notification_deliveries_status
  on public.notification_deliveries(status);
```

## Backend Configuration

### Task 4: Add Telegram settings

**Files:**
- Modify: `apps/api/.env.example`
- Modify: `apps/api/app/core/config.py`

- [ ] **Step 1: Add env example**

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
APP_BASE_URL=http://localhost:3000
```

- [ ] **Step 2: Add settings fields**

```python
telegram_bot_token: str | None = None
telegram_bot_username: str | None = None
telegram_webhook_secret: str | None = None
app_base_url: str = "http://localhost:3000"
```

## Backend Repository Layer

### Task 5: Add Telegram repository

**Files:**
- Create: `apps/api/app/repositories/telegram_repository.py`
- Modify: `apps/api/app/repositories/user_repository.py`

- [ ] **Step 1: Create link-token helpers**

```python
from app.db.supabase import get_supabase_admin


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
```

- [ ] **Step 2: Add user Telegram helpers**

```python
def get_user_telegram_profile(user_id: str) -> dict | None:
    result = (
        get_supabase_admin()
        .table("users")
        .select("id, telegram_chat_id, telegram_username, telegram_linked_at")
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

### Task 6: Add delivery repository helpers

**Files:**
- Modify: `apps/api/app/repositories/notification_repository.py`

- [ ] **Step 1: Return created notification**

`create_notification()` already returns `dict | None`. Keep that contract and make sure callers use the returned notification.

- [ ] **Step 2: Add delivery helpers**

```python
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
```

## Backend Service Layer

### Task 7: Add Telegram service

**Files:**
- Create: `apps/api/app/services/telegram.py`
- Create: `apps/api/app/schemas/telegram.py`

- [ ] **Step 1: Add response schemas**

```python
from pydantic import BaseModel


class TelegramLinkOut(BaseModel):
    url: str
    expires_at: str


class TelegramProfileOut(BaseModel):
    linked: bool
    username: str | None = None
    linked_at: str | None = None
```

- [ ] **Step 2: Add Vietnamese message builder**

```python
PRIORITY_LABELS = {
    "low": "Thấp",
    "medium": "Trung bình",
    "high": "Cao",
    "urgent": "Khẩn cấp",
}

STATUS_LABELS = {
    "pending": "Đang chờ",
    "acknowledged": "Đã xác nhận",
    "in_progress": "Đang xử lý",
    "done": "Hoàn tất",
    "cancelled": "Đã hủy",
}


def build_assignment_message(request: dict, *, reassigned: bool, app_base_url: str) -> str:
    heading = "Bạn vừa được giao lại một task" if reassigned else "Bạn vừa được giao task mới"
    priority = PRIORITY_LABELS.get(request.get("priority"), request.get("priority", ""))
    status = STATUS_LABELS.get(request.get("status"), request.get("status", ""))
    return (
        f"{heading}\n\n"
        f"Tiêu đề: {request['title']}\n"
        f"Độ ưu tiên: {priority}\n"
        f"Trạng thái: {status}\n\n"
        f"Mở task: {app_base_url}/requests/{request['id']}"
    )
```

- [ ] **Step 3: Add send function**

Use `httpx` if already available in `requirements.txt`; otherwise add it.

```python
import httpx


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

### Task 8: Hook Telegram delivery into notifications

**Files:**
- Modify: `apps/api/app/services/notifications.py`

- [ ] **Step 1: Keep in-app notification behavior unchanged**

`create_notification()` must still insert into `notifications` for all notification types.

- [ ] **Step 2: Send Telegram only for assignment events**

```python
TELEGRAM_TYPES = {"assigned", "reassigned"}
```

- [ ] **Step 3: Add best-effort delivery**

After creating the notification:

```python
notification = notification_repository.create_notification(...)
if notification and notification_type in TELEGRAM_TYPES:
    dispatch_telegram_delivery(notification=notification, request=request)
```

`dispatch_telegram_delivery()` should:

- Return immediately if Telegram config is missing.
- Return if user has no `telegram_chat_id`.
- Create a delivery row with `pending`.
- Send Telegram message.
- Mark delivery `sent`.
- Catch provider/network errors and mark delivery `failed`.
- Never raise Telegram send errors back to request workflow.

### Task 9: Wire reassignment text

**Files:**
- Modify: `apps/api/app/services/notifications.py`

- [ ] **Step 1: Pass notification type to message builder**

`notify_assigned()` should pass `reassigned=False`.

`notify_reassigned()` should pass `reassigned=True`.

Do not change `request_service.py` behavior unless the function signature forces it.

## Backend Routes

### Task 10: Add Telegram account routes

**Files:**
- Create: `apps/api/app/routes/telegram.py`
- Modify: `apps/api/app/main.py`
- Modify: `docs/api-contract.md`

- [ ] **Step 1: Add protected account endpoints**

```txt
GET    /notifications/telegram/profile
POST   /notifications/telegram/link
DELETE /notifications/telegram/link
```

- [ ] **Step 2: Endpoint behavior**

`GET /notifications/telegram/profile` returns whether current user has Telegram linked.

`POST /notifications/telegram/link` creates a new link token and returns Telegram deep link.

`DELETE /notifications/telegram/link` clears Telegram fields for the current user.

- [ ] **Step 3: Mount route**

```python
from app.routes import telegram

app.include_router(telegram.router, prefix="/notifications/telegram", tags=["telegram"])
```

### Task 11: Add Telegram webhook

**Files:**
- Modify: `apps/api/app/routes/telegram.py`

- [ ] **Step 1: Add unauthenticated webhook endpoint**

```txt
POST /notifications/telegram/webhook
```

- [ ] **Step 2: Validate webhook secret**

Require the `X-Telegram-Bot-Api-Secret-Token` header to equal `TELEGRAM_WEBHOOK_SECRET` when the setting is configured.

- [ ] **Step 3: Handle `/start <code>`**

Extract:

```txt
message.chat.id
message.chat.username
message.text
```

Only process messages where text starts with `/start `.

- [ ] **Step 4: Link or reject**

Valid token:

- Store Telegram chat data on the matching user.
- Mark token used.
- Send Vietnamese success reply.

Invalid token:

- Send Vietnamese failure reply.

## Frontend

### Task 12: Add Telegram API client

**Files:**
- Create: `apps/web/src/lib/api/telegram.ts`

- [ ] **Step 1: Add API helpers**

```ts
export type TelegramProfile = {
  linked: boolean;
  username?: string | null;
  linked_at?: string | null;
};

export type TelegramLink = {
  url: string;
  expires_at: string;
};

export function getTelegramProfile(): Promise<TelegramProfile> {
  return apiFetch("/notifications/telegram/profile");
}

export function createTelegramLink(): Promise<TelegramLink> {
  return apiFetch("/notifications/telegram/link", { method: "POST" });
}

export function unlinkTelegram(): Promise<TelegramProfile> {
  return apiFetch("/notifications/telegram/link", { method: "DELETE" });
}
```

### Task 13: Add linking UI

**Files:**
- Modify existing settings/profile/dashboard component after checking current frontend structure.

- [ ] **Step 1: Show current state**

Vietnamese UI copy:

```txt
Telegram
Nhận thông báo khi bạn được giao task.
Đã liên kết: @{username}
Chưa liên kết
```

- [ ] **Step 2: Add actions**

```txt
Liên kết Telegram
Mở Telegram
Hủy liên kết
```

- [ ] **Step 3: Keep UI minimal**

Do not change request list/detail layout. This is account-level configuration only.

## Tests

### Task 14: Test Telegram message builder

**Files:**
- Create: `apps/api/tests/test_telegram_service.py`

- [ ] **Step 1: Test assigned Vietnamese text**

```python
def test_build_assignment_message_uses_vietnamese_labels():
    request = {
        "id": "req-1",
        "title": "Sửa lỗi đăng nhập",
        "priority": "urgent",
        "status": "pending",
    }

    message = telegram.build_assignment_message(
        request,
        reassigned=False,
        app_base_url="http://localhost:3000",
    )

    assert "Bạn vừa được giao task mới" in message
    assert "Tiêu đề: Sửa lỗi đăng nhập" in message
    assert "Độ ưu tiên: Khẩn cấp" in message
    assert "Trạng thái: Đang chờ" in message
    assert "http://localhost:3000/requests/req-1" in message
```

- [ ] **Step 2: Test reassigned Vietnamese text**

```python
def test_build_assignment_message_handles_reassigned_heading():
    request = {
        "id": "req-1",
        "title": "Cập nhật API",
        "priority": "high",
        "status": "pending",
    }

    message = telegram.build_assignment_message(
        request,
        reassigned=True,
        app_base_url="http://localhost:3000",
    )

    assert "Bạn vừa được giao lại một task" in message
    assert "Độ ưu tiên: Cao" in message
```

### Task 15: Test notification delivery best-effort behavior

**Files:**
- Create: `apps/api/tests/test_notification_telegram_delivery.py`

- [ ] **Step 1: Test no Telegram profile skips delivery**

Patch repository calls so `get_user_telegram_profile()` returns no chat id.

Expected:

- Notification record is created.
- Delivery is not created.
- Telegram provider is not called.

- [ ] **Step 2: Test send failure records failed delivery**

Patch provider send to raise `httpx.HTTPError`.

Expected:

- Notification record is created.
- Delivery row is created.
- Delivery is marked `failed`.
- `notify_assigned()` does not raise.

- [ ] **Step 3: Test success records sent delivery**

Patch provider send to return message id `"123"`.

Expected:

- Delivery row is created.
- Delivery is marked `sent` with provider message id.

### Task 16: Test Telegram webhook

**Files:**
- Create: `apps/api/tests/test_telegram_routes.py`

- [ ] **Step 1: Test valid `/start` links user**

Request body:

```json
{
  "message": {
    "chat": {
      "id": 123456,
      "username": "thien"
    },
    "text": "/start abc123"
  }
}
```

Expected:

- Valid token is loaded.
- User is linked with chat id `123456`.
- Token is marked used.
- Success message is sent in Vietnamese.

- [ ] **Step 2: Test invalid code sends Vietnamese failure**

Expected:

- No user update.
- Failure message is sent.
- Route returns HTTP 200 so Telegram does not keep retrying a non-actionable update.

## Verification

Run backend tests from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected:

```txt
OK
```

Run frontend checks from `apps/web` if UI was added:

```bash
npm run lint
npm run build
```

Expected:

```txt
Lint passes.
Build completes successfully.
```

## Manual Setup

1. Create a bot with `@BotFather`.
2. Put these values in `apps/api/.env`:

```env
TELEGRAM_BOT_TOKEN=<token from BotFather>
TELEGRAM_BOT_USERNAME=<bot username without @>
TELEGRAM_WEBHOOK_SECRET=<random long secret>
APP_BASE_URL=http://localhost:3000
```

3. In development, expose FastAPI with a tunnel such as ngrok or Cloudflare Tunnel.
4. Register webhook:

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<public-api-url>/notifications/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>"}'
```

5. Start backend and frontend.
6. Link Telegram from the web app.
7. Create or reassign a request to the linked user.
8. Confirm Telegram receives Vietnamese assignment text.

## Rollout Notes

- Keep `TELEGRAM_BOT_TOKEN` backend-only.
- Do not expose service-role Supabase credentials to frontend.
- Telegram failures must be visible through delivery rows but must not break assignment workflow.
- Start with assignment/reassignment messages only. Add status/done/cancelled later after confirming message volume is acceptable.
