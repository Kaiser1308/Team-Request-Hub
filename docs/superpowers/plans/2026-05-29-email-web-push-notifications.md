# Email Web Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-level Email and Web Push notification delivery channels alongside Telegram for assigned and reassigned request events.

**Architecture:** Keep request workflow ownership in the backend and extend `app.notification_module` with channel preferences, Web Push subscriptions, and provider adapters. Frontend only manages user preferences, browser push permission, and service worker registration; it never stores provider secrets or sends notifications directly.

**Tech Stack:** FastAPI, Supabase PostgreSQL/service-role client, Pydantic, unittest, SMTP via Python standard library, Web Push via `pywebpush`, Next.js 15 App Router, React 19, TanStack Query, TypeScript, browser Push API, service workers.

---

## Required Context

Read before implementation:

```txt
AGENTS.md
apps/web/AGENTS.md
docs/architecture.md
docs/api-contract.md
docs/database-schema.md
docs/frontend-ui-framework.md
docs/superpowers/specs/2026-05-29-email-web-push-notifications-design.md
```

Backend commands from `apps/api`:

```bash
uv --cache-dir .uv-cache pip install -r requirements.txt
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Frontend commands from `apps/web`:

```bash
npm run lint
npm run build
```

## File Map

Backend schema and config:

- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql` to add enum values, preference table, Web Push subscription table, indexes, and RLS policies.
- Modify: `docs/database-schema.md` to document new tables and enum values.
- Modify: `apps/api/app/core/config.py` to add SMTP and VAPID settings.
- Modify: `apps/api/.env.example` to document new backend env keys.
- Modify: `apps/api/requirements.txt` to add `pywebpush`.

Backend notification module:

- Modify: `apps/api/app/schemas/notifications.py` for channel/preference/Web Push request and response schemas.
- Modify: `apps/api/app/routes/notifications.py` for preference and Web Push endpoints.
- Modify: `apps/api/app/notification_module/_store.py` for preference, user email, Web Push subscription, and delivery helpers.
- Add: `apps/api/app/notification_module/_email.py` for SMTP message building and sending.
- Add: `apps/api/app/notification_module/_web_push.py` for Web Push payload and sending.
- Modify: `apps/api/app/notification_module/__init__.py` for public preference/subscription API and multi-channel dispatch.
- Modify: `apps/api/app/routes/requests.py` to schedule multi-channel notification dispatch instead of Telegram-only dispatch.

Backend tests:

- Add: `apps/api/tests/test_notification_preferences.py`.
- Add: `apps/api/tests/test_web_push_routes.py`.
- Add: `apps/api/tests/test_notification_dispatch_channels.py`.
- Modify: `apps/api/tests/test_request_routes.py` if route background-task patch paths change.

Frontend:

- Modify: `apps/web/src/types/index.ts` for notification channel/preference types.
- Modify: `apps/web/src/lib/api/query-keys.ts` for notification preferences and Web Push key query keys.
- Modify: `apps/web/src/lib/api/notifications.ts` for preferences and Web Push API calls.
- Modify: `apps/web/src/hooks/use-notifications.ts` for preference mutations.
- Add: `apps/web/src/components/settings/notification-settings.tsx`.
- Add: `apps/web/src/lib/web-push.ts`.
- Add: `apps/web/public/sw.js`.
- Modify: `apps/web/src/app/(dashboard)/notifications/page.tsx` to render settings above the list.

Docs:

- Modify: `docs/api-contract.md` for new notification endpoints.
- Modify: `docs/architecture.md` current state and notification module ownership.

---

## Task 1: Database Schema For Channels And Subscriptions

**Files:**

- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `docs/database-schema.md`

- [ ] **Step 1: Update notification channel enum in schema**

In `DB_SCHEMA_TEAM_REQUEST_HUB.sql`, change the enum creation block so new installs include all channels:

```sql
create type notification_channel as enum ('telegram', 'email', 'web_push');
```

Add idempotent enum value blocks after the enum creation block for existing databases:

```sql
do $$
begin
  alter type notification_channel add value if not exists 'email';
  alter type notification_channel add value if not exists 'web_push';
end $$;
```

- [ ] **Step 2: Add preferences table**

Add after `notification_deliveries` table:

```sql
create table if not exists public.notification_preferences (
  user_id uuid not null references public.users(id) on delete cascade,
  channel notification_channel not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

create index if not exists idx_notification_preferences_user_id
  on public.notification_preferences(user_id);
```

- [ ] **Step 3: Add Web Push subscriptions table**

Add after `notification_preferences`:

```sql
create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_web_push_subscriptions_user_active
  on public.web_push_subscriptions(user_id, revoked_at);
```

- [ ] **Step 4: Enable RLS and add owner policies**

Add with other RLS statements:

```sql
alter table public.notification_preferences enable row level security;
alter table public.web_push_subscriptions enable row level security;
```

Add policies with the existing policy section:

```sql
create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can view their own web push subscriptions"
  on public.web_push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own web push subscriptions"
  on public.web_push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own web push subscriptions"
  on public.web_push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
```

- [ ] **Step 5: Update database docs**

In `docs/database-schema.md`, update table and enum bullets:

```md
- `public.notification_preferences`: per-user opt-in/out settings for external notification channels.
- `public.web_push_subscriptions`: per-device browser Push API subscription records for Web Push delivery.
- `notification_channel`: `telegram`, `email`, `web_push`.
```

- [ ] **Step 6: Verify schema text**

Run from repo root:

```bash
rg "notification_preferences|web_push_subscriptions|web_push|email" DB_SCHEMA_TEAM_REQUEST_HUB.sql docs/database-schema.md
```

Expected: matches show the new enum values, tables, indexes, RLS enablement, and docs.

---

## Task 2: Backend Schemas And Routes

**Files:**

- Modify: `apps/api/app/schemas/notifications.py`
- Modify: `apps/api/app/routes/notifications.py`
- Add: `apps/api/tests/test_notification_preferences.py`
- Add: `apps/api/tests/test_web_push_routes.py`

- [ ] **Step 1: Write failing preference route tests**

Create `apps/api/tests/test_notification_preferences.py`:

```python
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app
from app.schemas.users import CurrentUser


class NotificationPreferenceRouteTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_get_preferences_uses_current_user(self):
        with patch("app.routes.notifications.notification_module.list_notification_preferences") as mock_fn:
            mock_fn.return_value = [
                {"channel": "telegram", "enabled": True},
                {"channel": "email", "enabled": True},
                {"channel": "web_push", "enabled": False},
            ]
            response = TestClient(app).get("/notifications/preferences")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[1]["channel"], "email")
        mock_fn.assert_called_once_with("user-1")

    def test_update_preferences_uses_current_user(self):
        with patch("app.routes.notifications.notification_module.update_notification_preferences") as mock_fn:
            mock_fn.return_value = [
                {"channel": "telegram", "enabled": True},
                {"channel": "email", "enabled": False},
                {"channel": "web_push", "enabled": True},
            ]
            response = TestClient(app).patch(
                "/notifications/preferences",
                json={"email": False, "web_push": True},
            )

        self.assertEqual(response.status_code, 200)
        mock_fn.assert_called_once_with("user-1", {"email": False, "web_push": True})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Write failing Web Push route tests**

Create `apps/api/tests/test_web_push_routes.py`:

```python
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app
from app.schemas.users import CurrentUser


class WebPushRouteTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_get_public_key_returns_vapid_public_key(self):
        with patch("app.routes.notifications.get_settings") as settings:
            settings.return_value.vapid_public_key = "public-key"
            response = TestClient(app).get("/notifications/web-push/vapid-public-key")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"public_key": "public-key"})

    def test_create_subscription_uses_current_user(self):
        payload = {
            "endpoint": "https://push.example/sub",
            "keys": {"p256dh": "p256dh-key", "auth": "auth-key"},
        }
        with patch("app.routes.notifications.notification_module.upsert_web_push_subscription") as mock_fn:
            mock_fn.return_value = {"id": "sub-1", "endpoint": payload["endpoint"]}
            response = TestClient(app).post(
                "/notifications/web-push/subscriptions",
                json=payload,
                headers={"user-agent": "test-agent"},
            )

        self.assertEqual(response.status_code, 200)
        mock_fn.assert_called_once_with(
            user_id="user-1",
            endpoint="https://push.example/sub",
            p256dh="p256dh-key",
            auth="auth-key",
            user_agent="test-agent",
        )

    def test_revoke_subscription_uses_current_user(self):
        with patch("app.routes.notifications.notification_module.revoke_web_push_subscription") as mock_fn:
            mock_fn.return_value = {"revoked": True}
            response = TestClient(app).delete("/notifications/web-push/subscriptions/sub-1")

        self.assertEqual(response.status_code, 200)
        mock_fn.assert_called_once_with("user-1", "sub-1")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run tests to verify they fail**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_preferences tests.test_web_push_routes
```

Expected: FAIL because schemas/routes/functions do not exist yet.

- [ ] **Step 4: Add notification schemas**

Append to `apps/api/app/schemas/notifications.py`:

```python
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
```

- [ ] **Step 5: Add route handlers**

Update imports in `apps/api/app/routes/notifications.py`:

```python
from fastapi import APIRouter, Depends, Header, HTTPException, status
from app.core.config import get_settings
from app.schemas.notifications import (
    NotificationOut,
    NotificationPreferenceOut,
    NotificationsReadAllOut,
    NotificationsReadByTypeIn,
    NotificationPreferencesUpdateIn,
    WebPushPublicKeyOut,
    WebPushSubscriptionIn,
    WebPushSubscriptionOut,
    WebPushSubscriptionRevokeOut,
)
```

Add routes before `/{notification_id}/read`:

```python
@router.get("/preferences", response_model=list[NotificationPreferenceOut])
async def list_notification_preferences(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.list_notification_preferences(current_user.id)


@router.patch("/preferences", response_model=list[NotificationPreferenceOut])
async def update_notification_preferences(
    body: NotificationPreferencesUpdateIn,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    updates = body.model_dump(exclude_none=True)
    return notification_module.update_notification_preferences(current_user.id, updates)


@router.get("/web-push/vapid-public-key", response_model=WebPushPublicKeyOut)
async def get_web_push_public_key(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    public_key = get_settings().vapid_public_key
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Web Push is not configured",
        )
    return {"public_key": public_key}


@router.post("/web-push/subscriptions", response_model=WebPushSubscriptionOut)
async def upsert_web_push_subscription(
    body: WebPushSubscriptionIn,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    user_agent: str | None = Header(None),
):
    require_active_current_user(current_user)
    return notification_module.upsert_web_push_subscription(
        user_id=current_user.id,
        endpoint=body.endpoint,
        p256dh=body.keys.p256dh,
        auth=body.keys.auth,
        user_agent=user_agent,
    )


@router.delete("/web-push/subscriptions/{subscription_id}", response_model=WebPushSubscriptionRevokeOut)
async def revoke_web_push_subscription(
    subscription_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return notification_module.revoke_web_push_subscription(current_user.id, subscription_id)
```

- [ ] **Step 6: Add temporary public functions to make route tests pass**

Add stubs in `apps/api/app/notification_module/__init__.py`; Task 3 replaces these with store-backed implementations:

```python
CHANNELS = ("telegram", "email", "web_push")


def list_notification_preferences(user_id: str) -> list[dict]:
    return _store.list_notification_preferences(user_id)


def update_notification_preferences(user_id: str, updates: dict[str, bool]) -> list[dict]:
    return _store.update_notification_preferences(user_id, updates)


def upsert_web_push_subscription(*, user_id: str, endpoint: str, p256dh: str, auth: str, user_agent: str | None) -> dict:
    return _store.upsert_web_push_subscription(
        user_id=user_id,
        endpoint=endpoint,
        p256dh=p256dh,
        auth=auth,
        user_agent=user_agent,
    )


def revoke_web_push_subscription(user_id: str, subscription_id: str) -> dict:
    _store.revoke_web_push_subscription(user_id, subscription_id)
    return {"revoked": True}
```

- [ ] **Step 7: Run route tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_preferences tests.test_web_push_routes
```

Expected: PASS with patched notification module functions.

---

## Task 3: Store Functions For Preferences And Web Push

**Files:**

- Modify: `apps/api/app/notification_module/_store.py`
- Modify: `apps/api/tests/test_notification_preferences.py`
- Modify: `apps/api/tests/test_web_push_routes.py`

- [ ] **Step 1: Add focused store tests by mocking Supabase**

Append tests that patch `app.notification_module._store.get_supabase_admin`. Use existing test style from other repository/store tests. Required assertions:

```python
def test_default_preferences_include_all_channels_when_no_rows(self):
    # list_notification_preferences("user-1") returns telegram/email/web_push enabled true

def test_update_preferences_upserts_only_requested_channels(self):
    # update_notification_preferences("user-1", {"email": False}) writes user_id/channel/enabled

def test_upsert_web_push_subscription_uses_endpoint_conflict_key(self):
    # upsert uses endpoint, user_id, p256dh, auth, user_agent, revoked_at None

def test_revoke_web_push_subscription_filters_by_user_and_subscription(self):
    # revoke update filters id and user_id
```

- [ ] **Step 2: Run store tests to verify failure**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_preferences tests.test_web_push_routes
```

Expected: FAIL because store functions are not implemented.

- [ ] **Step 3: Implement preference store helpers**

Add to `apps/api/app/notification_module/_store.py`:

```python
CHANNELS = ("telegram", "email", "web_push")


def list_notification_preferences(user_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("notification_preferences")
        .select("channel, enabled")
        .eq("user_id", user_id)
        .execute()
    )
    rows = {row["channel"]: row for row in (result.data or [])}
    return [
        {"channel": channel, "enabled": rows.get(channel, {}).get("enabled", True)}
        for channel in CHANNELS
    ]


def update_notification_preferences(user_id: str, updates: dict[str, bool]) -> list[dict]:
    rows = [
        {"user_id": user_id, "channel": channel, "enabled": enabled}
        for channel, enabled in updates.items()
        if channel in CHANNELS
    ]
    if rows:
        (
            get_supabase_admin()
            .table("notification_preferences")
            .upsert(rows, on_conflict="user_id,channel")
            .execute()
        )
    return list_notification_preferences(user_id)
```

- [ ] **Step 4: Implement Web Push store helpers**

Add to `_store.py`:

```python
def upsert_web_push_subscription(
    *,
    user_id: str,
    endpoint: str,
    p256dh: str,
    auth: str,
    user_agent: str | None,
) -> dict:
    result = (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .upsert(
            {
                "user_id": user_id,
                "endpoint": endpoint,
                "p256dh": p256dh,
                "auth": auth,
                "user_agent": user_agent,
                "revoked_at": None,
            },
            on_conflict="endpoint",
        )
        .execute()
    )
    return result.data[0]


def list_active_web_push_subscriptions(user_id: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", user_id)
        .is_("revoked_at", "null")
        .execute()
    )
    return result.data or []


def revoke_web_push_subscription(user_id: str, subscription_id: str) -> None:
    from datetime import datetime, timezone

    (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .update({"revoked_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", subscription_id)
        .eq("user_id", user_id)
        .execute()
    )


def touch_web_push_subscription(subscription_id: str, used_at: str) -> None:
    (
        get_supabase_admin()
        .table("web_push_subscriptions")
        .update({"last_used_at": used_at})
        .eq("id", subscription_id)
        .execute()
    )
```

- [ ] **Step 5: Add user email helper**

Add to `_store.py`:

```python
def get_user_email(user_id: str) -> str | None:
    result = (
        get_supabase_admin()
        .table("users")
        .select("email")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0].get("email")
```

- [ ] **Step 6: Run backend route/store tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_preferences tests.test_web_push_routes
```

Expected: PASS.

---

## Task 4: Provider Configuration And Adapters

**Files:**

- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/requirements.txt`
- Add: `apps/api/app/notification_module/_email.py`
- Add: `apps/api/app/notification_module/_web_push.py`
- Add: `apps/api/tests/test_notification_dispatch_channels.py`

- [ ] **Step 1: Add failing adapter tests**

Create `apps/api/tests/test_notification_dispatch_channels.py`:

```python
import unittest
from unittest.mock import patch

from app.notification_module import _email, _web_push


REQUEST = {
    "id": "req-1",
    "title": "Fix login",
    "priority": "urgent",
    "status": "pending",
}


class NotificationAdapterTests(unittest.TestCase):
    def test_email_message_contains_request_link(self):
        message = _email.build_assignment_email(
            REQUEST,
            reassigned=False,
            app_base_url="https://app.example.com",
            lang="en",
        )
        self.assertEqual(message["subject"], "You have been assigned a request")
        self.assertIn("Fix login", message["text"])
        self.assertIn("https://app.example.com/requests/req-1", message["text"])

    def test_send_email_uses_smtp_settings(self):
        with patch("app.notification_module._email.smtplib.SMTP") as smtp:
            _email.send_email(
                host="smtp.example.com",
                port=587,
                username="user",
                password="pass",
                from_email="from@example.com",
                from_name="Team Request Hub",
                to_email="to@example.com",
                subject="Subject",
                text="Body",
            )
        smtp.assert_called_once_with("smtp.example.com", 587, timeout=10)
        smtp.return_value.__enter__.return_value.starttls.assert_called_once()
        smtp.return_value.__enter__.return_value.login.assert_called_once_with("user", "pass")

    def test_web_push_payload_contains_url(self):
        payload = _web_push.build_web_push_payload(
            REQUEST,
            notification_id="notif-1",
            reassigned=True,
            app_base_url="https://app.example.com",
            lang="en",
        )
        self.assertEqual(payload["tag"], "notif-1")
        self.assertIn("reassigned", payload["title"].lower())
        self.assertEqual(payload["url"], "https://app.example.com/requests/req-1")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run adapter tests to verify failure**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_dispatch_channels
```

Expected: FAIL because adapter modules do not exist.

- [ ] **Step 3: Add config values**

Add to `Settings` in `apps/api/app/core/config.py`:

```python
smtp_host: str | None = None
smtp_port: int = 587
smtp_username: str | None = None
smtp_password: str | None = None
smtp_from_email: str | None = None
smtp_from_name: str = "Team Request Hub"
vapid_public_key: str | None = None
vapid_private_key: str | None = None
vapid_subject: str | None = None
```

Add to `apps/api/.env.example`:

```txt
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=Team Request Hub

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com
```

Add to `apps/api/requirements.txt`:

```txt
pywebpush
```

- [ ] **Step 4: Implement email adapter**

Create `apps/api/app/notification_module/_email.py`:

```python
"""Internal: Email message building and SMTP sending."""

import smtplib
from email.message import EmailMessage


HEADINGS = {
    "en": {
        "assigned": "You have been assigned a request",
        "reassigned": "You have been reassigned a request",
    },
    "vi": {
        "assigned": "Bạn vừa được giao request mới",
        "reassigned": "Bạn vừa được giao lại một request",
    },
}


def build_assignment_email(request: dict, *, reassigned: bool, app_base_url: str, lang: str = "vi") -> dict:
    labels = "vi" if lang not in ("en", "vi") else lang
    key = "reassigned" if reassigned else "assigned"
    subject = HEADINGS[labels][key]
    url = f"{app_base_url}/requests/{request['id']}"
    text = (
        f"{subject}\n\n"
        f"Title: {request['title']}\n"
        f"Priority: {request.get('priority', '')}\n"
        f"Status: {request.get('status', '')}\n\n"
        f"Open request: {url}"
    )
    return {"subject": subject, "text": text}


def send_email(
    *,
    host: str,
    port: int,
    username: str | None,
    password: str | None,
    from_email: str,
    from_name: str,
    to_email: str,
    subject: str,
    text: str,
) -> str | None:
    message = EmailMessage()
    message["From"] = f"{from_name} <{from_email}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text)

    with smtplib.SMTP(host, port, timeout=10) as smtp:
        smtp.starttls()
        if username and password:
            smtp.login(username, password)
        smtp.send_message(message)
    return None
```

- [ ] **Step 5: Implement Web Push adapter**

Create `apps/api/app/notification_module/_web_push.py`:

```python
"""Internal: Web Push payload building and sending."""

import json

from pywebpush import webpush


def build_web_push_payload(
    request: dict,
    *,
    notification_id: str,
    reassigned: bool,
    app_base_url: str,
    lang: str = "vi",
) -> dict:
    is_vi = lang != "en"
    title = (
        "Bạn vừa được giao lại request" if reassigned and is_vi
        else "Bạn vừa được giao request mới" if is_vi
        else "You have been reassigned a request" if reassigned
        else "You have been assigned a request"
    )
    return {
        "title": title,
        "body": request["title"],
        "url": f"{app_base_url}/requests/{request['id']}",
        "tag": notification_id,
    }


def send_web_push(
    *,
    endpoint: str,
    p256dh: str,
    auth: str,
    vapid_private_key: str,
    vapid_subject: str,
    payload: dict,
) -> None:
    subscription = {
        "endpoint": endpoint,
        "keys": {"p256dh": p256dh, "auth": auth},
    }
    webpush(
        subscription_info=subscription,
        data=json.dumps(payload),
        vapid_private_key=vapid_private_key,
        vapid_claims={"sub": vapid_subject},
    )
```

- [ ] **Step 6: Install dependency and run tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache pip install -r requirements.txt
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_dispatch_channels
```

Expected: PASS.

---

## Task 5: Multi-Channel Dispatch

**Files:**

- Modify: `apps/api/app/notification_module/__init__.py`
- Modify: `apps/api/app/routes/requests.py`
- Modify: `apps/api/tests/test_notification_dispatch_channels.py`
- Modify: `apps/api/tests/test_request_routes.py`

- [ ] **Step 1: Add dispatch behavior tests**

Append to `apps/api/tests/test_notification_dispatch_channels.py`:

```python
class MultiChannelDispatchTests(unittest.TestCase):
    def test_dispatch_skips_disabled_channels(self):
        from app import notification_module

        notification = {"id": "notif-1", "user_id": "user-1", "type": "assigned"}
        with patch("app.notification_module._store.list_notification_preferences") as prefs, \
             patch("app.notification_module._store.get_user_email") as email, \
             patch("app.notification_module._email.send_email") as send_email:
            prefs.return_value = [
                {"channel": "telegram", "enabled": False},
                {"channel": "email", "enabled": False},
                {"channel": "web_push", "enabled": False},
            ]
            notification_module.dispatch_external_delivery(notification=notification, request=REQUEST)

        email.assert_not_called()
        send_email.assert_not_called()

    def test_dispatch_sends_enabled_email(self):
        from app import notification_module

        notification = {"id": "notif-1", "user_id": "user-1", "type": "assigned"}
        with patch("app.notification_module.get_settings") as settings, \
             patch("app.notification_module._store.list_notification_preferences") as prefs, \
             patch("app.notification_module._store.get_user_email") as get_email, \
             patch("app.notification_module._store.create_delivery") as create_delivery, \
             patch("app.notification_module._store.mark_delivery_sent") as sent, \
             patch("app.notification_module._email.send_email") as send_email:
            settings.return_value.smtp_host = "smtp.example.com"
            settings.return_value.smtp_port = 587
            settings.return_value.smtp_username = "user"
            settings.return_value.smtp_password = "pass"
            settings.return_value.smtp_from_email = "from@example.com"
            settings.return_value.smtp_from_name = "Team Request Hub"
            settings.return_value.app_base_url = "https://app.example.com"
            prefs.return_value = [{"channel": "email", "enabled": True}]
            get_email.return_value = "to@example.com"
            create_delivery.return_value = {"id": "delivery-1"}

            notification_module.dispatch_external_delivery(notification=notification, request=REQUEST)

        send_email.assert_called_once()
        sent.assert_called_once()
```

- [ ] **Step 2: Run dispatch tests to verify failure**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_dispatch_channels
```

Expected: FAIL because `dispatch_external_delivery` does not exist.

- [ ] **Step 3: Implement multi-channel dispatch**

In `apps/api/app/notification_module/__init__.py`, import adapters:

```python
from app.notification_module import _email, _store, _telegram, _web_push, _webhook
```

Add public function:

```python
def dispatch_external_delivery(*, notification: dict, request: dict) -> None:
    preferences = {
        row["channel"]: row["enabled"]
        for row in _store.list_notification_preferences(notification["user_id"])
    }
    if preferences.get("telegram", True):
        dispatch_telegram_delivery(notification=notification, request=request)
    if preferences.get("email", True):
        dispatch_email_delivery(notification=notification, request=request)
    if preferences.get("web_push", True):
        dispatch_web_push_delivery(notification=notification, request=request)
```

Add email delivery:

```python
def dispatch_email_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_from_email:
        return
    user_id = notification["user_id"]
    to_email = _store.get_user_email(user_id)
    if not to_email:
        return
    delivery = _store.create_delivery(
        notification_id=notification["id"],
        user_id=user_id,
        channel="email",
    )
    try:
        from datetime import datetime, timezone

        message = _email.build_assignment_email(
            request,
            reassigned=notification.get("type") == "reassigned",
            app_base_url=settings.app_base_url,
            lang="vi",
        )
        provider_message_id = _email.send_email(
            host=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            from_email=settings.smtp_from_email,
            from_name=settings.smtp_from_name,
            to_email=to_email,
            subject=message["subject"],
            text=message["text"],
        )
        _store.mark_delivery_sent(delivery["id"], provider_message_id, datetime.now(timezone.utc).isoformat())
    except Exception as exc:
        logger.warning("Email delivery failed for notification %s: %s", notification["id"], exc)
        _store.mark_delivery_failed(delivery["id"], str(exc))
```

Add Web Push delivery:

```python
def dispatch_web_push_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.vapid_private_key or not settings.vapid_subject:
        return
    user_id = notification["user_id"]
    subscriptions = _store.list_active_web_push_subscriptions(user_id)
    if not subscriptions:
        return
    payload = _web_push.build_web_push_payload(
        request,
        notification_id=notification["id"],
        reassigned=notification.get("type") == "reassigned",
        app_base_url=settings.app_base_url,
        lang="vi",
    )
    for subscription in subscriptions:
        delivery = _store.create_delivery(
            notification_id=notification["id"],
            user_id=user_id,
            channel="web_push",
        )
        try:
            from datetime import datetime, timezone

            _web_push.send_web_push(
                endpoint=subscription["endpoint"],
                p256dh=subscription["p256dh"],
                auth=subscription["auth"],
                vapid_private_key=settings.vapid_private_key,
                vapid_subject=settings.vapid_subject,
                payload=payload,
            )
            used_at = datetime.now(timezone.utc).isoformat()
            _store.touch_web_push_subscription(subscription["id"], used_at)
            _store.mark_delivery_sent(delivery["id"], None, used_at)
        except Exception as exc:
            logger.warning("Web Push delivery failed for notification %s: %s", notification["id"], exc)
            _store.mark_delivery_failed(delivery["id"], str(exc))
```

- [ ] **Step 4: Update request routes to schedule multi-channel dispatch**

In `apps/api/app/routes/requests.py`, replace `dispatch_telegram_background` scheduling with `dispatch_external_delivery` only where there is a notification object available. If route code currently only has `user_id/request/is_reassigned`, add a small wrapper in `notification_module`:

```python
def dispatch_assignment_background(user_id: str, request: dict, is_reassigned: bool) -> None:
    notification = {
        "id": f"background-{request['id']}-{user_id}",
        "user_id": user_id,
        "type": "reassigned" if is_reassigned else "assigned",
    }
    dispatch_external_delivery(notification=notification, request=request)
```

Then update route background tasks to call:

```python
background_tasks.add_task(
    notification_module.dispatch_assignment_background,
    assignee_id,
    request,
    False,
)
```

- [ ] **Step 5: Update route tests patch paths**

In `apps/api/tests/test_request_routes.py`, replace patches of:

```python
patch("app.routes.requests.notification_module.dispatch_telegram_background")
```

with:

```python
patch("app.routes.requests.notification_module.dispatch_assignment_background")
```

- [ ] **Step 6: Run backend tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_dispatch_channels tests.test_request_routes
```

Expected: PASS.

---

## Task 6: Frontend API, Hooks, And Web Push Helper

**Files:**

- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/lib/api/query-keys.ts`
- Modify: `apps/web/src/lib/api/notifications.ts`
- Modify: `apps/web/src/hooks/use-notifications.ts`
- Add: `apps/web/src/lib/web-push.ts`
- Add: `apps/web/public/sw.js`

- [ ] **Step 1: Add frontend types**

In `apps/web/src/types/index.ts`, add:

```ts
export type NotificationChannel = "telegram" | "email" | "web_push";

export interface NotificationPreference {
  channel: NotificationChannel;
  enabled: boolean;
}
```

- [ ] **Step 2: Add query keys**

In `apps/web/src/lib/api/query-keys.ts`, add:

```ts
notificationPreferences: ["notifications", "preferences"] as const,
webPushPublicKey: ["notifications", "web-push", "public-key"] as const,
```

- [ ] **Step 3: Add API functions**

Append to `apps/web/src/lib/api/notifications.ts`:

```ts
import type { NotificationPreference } from "@/types";

export type NotificationPreferenceUpdate = {
  telegram?: boolean;
  email?: boolean;
  web_push?: boolean;
};

export type BrowserPushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function listNotificationPreferences() {
  return apiFetch<NotificationPreference[]>("/notifications/preferences");
}

export function updateNotificationPreferences(body: NotificationPreferenceUpdate) {
  return apiFetch<NotificationPreference[]>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getWebPushPublicKey() {
  return apiFetch<{ public_key: string }>("/notifications/web-push/vapid-public-key");
}

export function createWebPushSubscription(body: BrowserPushSubscriptionPayload) {
  return apiFetch<{ id: string; endpoint: string }>("/notifications/web-push/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 4: Add notification preference hooks**

Append to `apps/web/src/hooks/use-notifications.ts` imports and exports:

```ts
import {
  createWebPushSubscription,
  getWebPushPublicKey,
  listNotificationPreferences,
  updateNotificationPreferences,
  type BrowserPushSubscriptionPayload,
  type NotificationPreferenceUpdate,
} from "@/lib/api/notifications";

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: listNotificationPreferences,
    staleTime: 60 * 1000,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NotificationPreferenceUpdate) => updateNotificationPreferences(body),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
    },
  });
}

export function useWebPushPublicKey() {
  return useQuery({
    queryKey: queryKeys.webPushPublicKey,
    queryFn: getWebPushPublicKey,
    staleTime: Infinity,
    retry: false,
  });
}

export function useCreateWebPushSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BrowserPushSubscriptionPayload) => createWebPushSubscription(body),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
    },
  });
}
```

- [ ] **Step 5: Add Web Push browser helper**

Create `apps/web/src/lib/web-push.ts`:

```ts
import type { BrowserPushSubscriptionPayload } from "@/lib/api/notifications";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isWebPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function subscribeToWebPush(publicKey: string): Promise<BrowserPushSubscriptionPayload> {
  if (!isWebPushSupported()) {
    throw new Error("Browser notifications are not supported on this device.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Browser notification permission was not granted.");
  }
  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription.");
  }
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}
```

- [ ] **Step 6: Add service worker**

Create `apps/web/public/sw.js`:

```js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Team Request Hub";
  const options = {
    body: data.body || "You have a new notification.",
    tag: data.tag,
    data: { url: data.url || "/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url
    ? event.notification.data.url
    : "/notifications";
  event.waitUntil(self.clients.openWindow(url));
});
```

- [ ] **Step 7: Run frontend lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: PASS or existing unrelated lint failures only.

---

## Task 7: Frontend Notification Settings UI

**Files:**

- Add: `apps/web/src/components/settings/notification-settings.tsx`
- Modify: `apps/web/src/app/(dashboard)/notifications/page.tsx`

- [ ] **Step 1: Create settings component**

Create `apps/web/src/components/settings/notification-settings.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  useCreateWebPushSubscription,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useWebPushPublicKey,
} from "@/hooks/use-notifications";
import { subscribeToWebPush } from "@/lib/web-push";

function isEnabled(preferences: { channel: string; enabled: boolean }[] | undefined, channel: string) {
  return preferences?.find((item) => item.channel === channel)?.enabled ?? true;
}

export function NotificationSettings() {
  const preferences = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const publicKey = useWebPushPublicKey();
  const createSubscription = useCreateWebPushSubscription();
  const rows = preferences.data;

  async function enableWebPush() {
    if (!publicKey.data?.public_key) return;
    const subscription = await subscribeToWebPush(publicKey.data.public_key);
    await createSubscription.mutateAsync(subscription);
    updatePreferences.mutate({ web_push: true });
  }

  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Notification channels</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          Choose where you want to receive assigned and reassigned request alerts.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex items-center justify-between rounded-md border border-[#e5e7eb] p-3">
          <span className="text-sm font-medium text-[#111827]">Email</span>
          <input
            type="checkbox"
            checked={isEnabled(rows, "email")}
            disabled={preferences.isLoading || updatePreferences.isPending}
            onChange={(event) => updatePreferences.mutate({ email: event.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between rounded-md border border-[#e5e7eb] p-3">
          <span className="text-sm font-medium text-[#111827]">Telegram</span>
          <input
            type="checkbox"
            checked={isEnabled(rows, "telegram")}
            disabled={preferences.isLoading || updatePreferences.isPending}
            onChange={(event) => updatePreferences.mutate({ telegram: event.target.checked })}
          />
        </label>

        <div className="rounded-md border border-[#e5e7eb] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Browser Push</p>
              <p className="text-xs text-[#6b7280]">Requires browser permission on this device.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={publicKey.isLoading || createSubscription.isPending || updatePreferences.isPending}
              onClick={() => void enableWebPush()}
            >
              Enable browser notifications
            </Button>
          </div>
          {createSubscription.isError ? (
            <p className="mt-2 text-xs text-red-600">
              {createSubscription.error instanceof Error
                ? createSubscription.error.message
                : "Could not enable browser notifications."}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Render settings on notifications page**

Modify `apps/web/src/app/(dashboard)/notifications/page.tsx`:

```tsx
import { NotificationSettings } from "@/components/settings/notification-settings";
```

Render before `NotificationList`:

```tsx
<NotificationSettings />
<NotificationList />
```

- [ ] **Step 3: Run frontend lint and build**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected: PASS.

---

## Task 8: API Contract And Architecture Docs

**Files:**

- Modify: `docs/api-contract.md`
- Modify: `docs/architecture.md`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Update API contract**

In `docs/api-contract.md`, add under Notifications:

```md
GET   /notifications/preferences
PATCH /notifications/preferences
GET   /notifications/web-push/vapid-public-key
POST  /notifications/web-push/subscriptions
DELETE /notifications/web-push/subscriptions/{subscription_id}
```

Add response examples:

```json
[
  {"channel":"telegram","enabled":true},
  {"channel":"email","enabled":true},
  {"channel":"web_push","enabled":false}
]
```

```json
{"public_key":"BExampleVapidPublicKey"}
```

- [ ] **Step 2: Update architecture doc**

In `docs/architecture.md`, update notification module rules:

```md
- `notification_module` owns notification records, channel preferences, Telegram delivery, Email delivery, Web Push delivery, and webhook handling. Its internal adapters (`_store`, `_telegram`, `_email`, `_web_push`, `_webhook`) are not part of the public API.
```

Update current state:

```md
- Notification delivery supports Telegram, Email, and Web Push for assignment and reassignment events, with per-user channel preferences.
```

- [ ] **Step 3: Verify docs search**

Run from repo root:

```bash
rg "web_push|Email|Web Push|preferences" docs/api-contract.md docs/architecture.md docs/database-schema.md apps/api/.env.example
```

Expected: matches in all touched docs/config files.

---

## Task 9: Final Verification

**Files:**

- No new files unless fixes are required.

- [ ] **Step 1: Run backend unit tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run GitNexus change detection**

Run from repo root via MCP/tooling:

```txt
gitnexus_detect_changes(scope="all", repo="Team-Request-Hub")
```

Expected: affected flows are limited to notification routes, request notification dispatch, notification settings UI, and docs/schema.

- [ ] **Step 4: Inspect git diff**

Run from repo root:

```bash
git diff -- DB_SCHEMA_TEAM_REQUEST_HUB.sql docs apps/api apps/web
```

Expected: only planned files changed; no `.env` secrets or generated build outputs are included.

---

## Self-Review Notes

- Spec coverage: plan includes DB enum/tables/RLS, backend endpoints, SMTP adapter, Web Push adapter, multi-channel dispatch, frontend settings, service worker, docs, and verification.
- Security coverage: provider secrets remain backend-only; routes bind mutations to `current_user.id`; Web Push payload is minimal; RLS uses `TO authenticated` plus ownership checks.
- Scope kept to assigned/reassigned external delivery; Discord/Zalo/digests/per-type preferences remain out of scope.
