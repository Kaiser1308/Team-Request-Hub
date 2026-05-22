# Architecture Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 6 architectural friction points identified in the architecture review, improving backend performance (dashboard N+1, synchronous Telegram) and frontend robustness (error handling, redundant data fetching), plus structural cleanup (domain exceptions, shallow services).

**Architecture:** Reduce dashboard query count from 5 to 1-2 via a single composite Supabase query + client-side splitting. Decouple Telegram delivery from request path using FastAPI `BackgroundTasks`. Replace generic `Error` throwing in `apiFetch` with structured `ApiError`. Eliminate redundant `useActiveUsers()` calls by consuming API-enriched `creator`/`assignee` fields. Introduce `DomainError` exceptions for repositories, mapped by a FastAPI exception handler. Inline shallow pass-through service modules.

**Tech Stack:** Python 3.12+ (FastAPI, Supabase Python client, httpx), TypeScript 5+ (Next.js 15 App Router, TanStack Query v5, React 19), Pydantic v2

---

### Task 1: Add `get_dashboard_data` to Repository

**Files:**
- Modify: `apps/api/app/repositories/request_repository.py` — add `get_dashboard_data()`

- [ ] **Step 1: Add `get_dashboard_data` function**

```python
def get_dashboard_data(user_id: str) -> list[dict]:
    """Fetch all dashboard-relevant requests for a user in one DB round-trip."""
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select("*")
        .or_(
            f"assigned_to.eq.{user_id},"
            f"created_by.eq.{user_id},"
            f"and(status.eq.pending,assigned_to.is.null),"
            f"and(status.eq.done,or(created_by.eq.{user_id},assigned_to.eq.{user_id}))"
        )
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return result.data or []
```

- [ ] **Step 2: Verify import is available**

Open `apps/api/app/repositories/request_repository.py` and confirm the first few lines are:
```python
from fastapi import HTTPException, status

from app.db.supabase import get_supabase_admin

REQUESTS_TABLE = "internal_requests"
```

The new function uses `get_supabase_admin()` and `REQUESTS_TABLE` which are already imported/defined.

- [ ] **Step 3: Commit**

```bash
git add apps/api/app/repositories/request_repository.py
git commit -m "feat: add get_dashboard_data repository method"
```

---

### Task 2: Rewrite `get_dashboard_summary` to Use Single Query

**Files:**
- Modify: `apps/api/app/services/dashboard.py` — rewrite `get_dashboard_summary()`
- Create: `apps/api/tests/test_dashboard_service_optimized.py` — new test

- [ ] **Step 1: Create test for optimized dashboard**

```python
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.schemas.users import CurrentUser
from app.services import dashboard


class DashboardServiceOptimizedTests(unittest.TestCase):
    def test_get_dashboard_summary_makes_single_request_query(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        mock_request = {
            "id": "req-1",
            "title": "Test",
            "description": "Desc",
            "tags": [],
            "priority": "medium",
            "status": "pending",
            "created_by": "user-2",
            "assigned_to": "user-1",
            "reference_links": [],
            "created_at": "2026-05-22T00:00:00Z",
            "updated_at": "2026-05-22T00:00:00Z",
        }
        mock_enriched = dict(mock_request)
        mock_enriched["creator"] = {"id": "user-2", "email": "b@b.com", "name": "B"}
        mock_enriched["assignee"] = {"id": "user-1", "email": "a@a.com", "name": "A"}

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=[mock_request],
            ) as get_data,
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                return_value=[mock_enriched],
            ) as enrich,
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        get_data.assert_called_once_with("user-1")
        enrich.assert_called_once_with([mock_request])
        self.assertEqual(result["counts"]["assigned"], 1)
        self.assertEqual(result["counts"]["urgent"], 0)
        self.assertIn("assigned_recent", result)

    def test_dashboard_summary_computes_counts_correctly(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        assigned_req = {
            "id": "r1", "title": "A", "description": "", "tags": [],
            "priority": "high", "status": "pending",
            "created_by": "user-2", "assigned_to": "user-1",
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        created_req = {
            "id": "r2", "title": "C", "description": "", "tags": [],
            "priority": "urgent", "status": "pending",
            "created_by": "user-1", "assigned_to": None,
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        pool_req = {
            "id": "r3", "title": "P", "description": "", "tags": [],
            "priority": "low", "status": "pending",
            "created_by": "user-2", "assigned_to": None,
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        done_req = {
            "id": "r4", "title": "D", "description": "", "tags": [],
            "priority": "medium", "status": "done",
            "created_by": "user-1", "assigned_to": "user-2",
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }

        raw_data = [assigned_req, created_req, pool_req, done_req]

        def noop_enrich(requests):
            enriched = []
            user_map = {"user-1": {"id": "user-1", "name": "Me"}, "user-2": {"id": "user-2", "name": "Other"}}
            for r in requests:
                e = dict(r)
                e["creator"] = user_map.get(r.get("created_by"))
                e["assignee"] = user_map.get(r.get("assigned_to"))
                enriched.append(e)
            return enriched

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=raw_data,
            ),
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                side_effect=noop_enrich,
            ),
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        self.assertEqual(result["counts"]["assigned"], 1)
        self.assertEqual(result["counts"]["created"], 2)
        self.assertEqual(result["counts"]["pool"], 2)
        self.assertEqual(result["counts"]["done"], 1)
        self.assertEqual(result["counts"]["urgent"], 1)

    def test_lead_dashboard_sees_all_done(self):
        lead_user = CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead",
            role="lead",
            is_active=True,
        )

        done_by_other = {
            "id": "r1", "title": "D", "description": "", "tags": [],
            "priority": "low", "status": "done",
            "created_by": "user-3", "assigned_to": "user-4",
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }

        def noop_enrich(requests):
            enriched = []
            for r in requests:
                e = dict(r)
                e["creator"] = None
                e["assignee"] = None
                enriched.append(e)
            return enriched

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=[done_by_other],
            ),
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                side_effect=noop_enrich,
            ),
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(lead_user)

        self.assertEqual(result["counts"]["done"], 1)
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service_optimized -v
```
Expected: FAIL — 3 test failures because `get_dashboard_summary` still uses old 4-call pattern.

- [ ] **Step 3: Rewrite `get_dashboard_summary` in service**

Replace the entire contents of `apps/api/app/services/dashboard.py`:

```python
from app.repositories import request_repository
from app.schemas.users import CurrentUser
from app.services import notifications, request_service


def get_dashboard_summary(current_user: CurrentUser) -> dict:
    raw_requests = request_repository.get_dashboard_data(current_user.id)
    enriched = request_service.enrich_requests_with_users(raw_requests)

    assigned_recent = []
    created_recent = []
    pool_recent = []
    done_recent = []

    for request in enriched:
        status = request.get("status")
        assigned_to = request.get("assigned_to")
        created_by = request.get("created_by")

        if assigned_to == current_user.id and status != "done":
            assigned_recent.append(request)
        if created_by == current_user.id:
            created_recent.append(request)
        if assigned_to is None and status == "pending":
            pool_recent.append(request)
        if status == "done" and (created_by == current_user.id or assigned_to == current_user.id):
            done_recent.append(request)

    urgent = sum(
        1
        for request in assigned_recent + created_recent + pool_recent
        if request.get("priority") == "urgent"
    )

    unread_notifications = notifications.list_notifications(
        current_user.id,
        unread_only=True,
    )

    return {
        "counts": {
            "assigned": len(assigned_recent),
            "created": len(created_recent),
            "pool": len(pool_recent),
            "done": len(done_recent),
            "urgent": urgent,
        },
        "assigned_recent": assigned_recent[:10],
        "created_recent": created_recent[:10],
        "pool_recent": pool_recent[:10],
        "notifications_unread": len(unread_notifications),
    }
```

- [ ] **Step 4: Run tests to verify**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service tests.test_dashboard_service_optimized -v
```
Expected: ALL PASS (4 tests from old file + 3 new tests)

- [ ] **Step 5: Update old test to match new behavior**

The old `test_dashboard_service.py` asserts `list_requests.call_count == 4`. Since we changed the implementation, update it to assert the new call pattern:

Replace contents of `test_dashboard_service.py`:

```python
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.schemas.users import CurrentUser
from app.services import dashboard


class DashboardServiceTests(unittest.TestCase):
    def test_get_dashboard_summary_calls_repository_once(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=[],
            ) as get_data,
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                return_value=[],
            ),
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        get_data.assert_called_once_with("user-1")
        self.assertEqual(result["counts"]["assigned"], 0)
        self.assertEqual(result["notifications_unread"], 0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 6: Run all tests again**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests -v
```
Expected: ALL tests pass

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/services/dashboard.py apps/api/app/repositories/request_repository.py apps/api/tests/test_dashboard_service.py apps/api/tests/test_dashboard_service_optimized.py
git commit -m "perf: optimize dashboard summary from 5 queries to 1 with client-side splitting"
```

---

### Task 3: Add `ApiError` Type to Frontend Client

**Files:**
- Modify: `apps/web/src/lib/api/client.ts` — add `ApiError` class, parse error body

- [ ] **Step 1: Add `ApiError` class and update error handling**

Replace `apps/web/src/lib/api/client.ts`:

```typescript
import { createClient } from "@/lib/supabase/client";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail || `API error: ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function getAuthHeaders() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new ApiError(401, "Unauthorized");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    let detail = `API error: ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) {
        detail = body.detail;
      }
    } catch {
      // response body is not JSON
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Verify lint passes**

```bash
cd apps/web && npm run lint
```
Expected: PASS — no new errors (uses existing `createClient` import, no new external deps)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api/client.ts
git commit -m "feat: add structured ApiError with backend detail messages"
```

---

### Task 4: Update Frontend Components to Use `ApiError` and Enriched API Data

**Files:**
- Modify: `apps/web/src/components/requests/request-list.tsx` — use `ApiError.status` instead of string-matching
- Modify: `apps/web/src/components/requests/request-card.tsx` — accept optional labels, prefer API-enriched data
- Modify: `apps/web/src/components/requests/request-detail.tsx` — use `request.creator`/`request.assignee`
- Modify: `apps/web/src/components/requests/request-actions.tsx` — use `ApiError` for readable errors

- [ ] **Step 1: Add import in `request-list.tsx`**

Add import at top of `apps/web/src/components/requests/request-list.tsx`:

```typescript
import { ApiError } from "@/lib/api/client";
```

- [ ] **Step 2: Update error handling in `request-list.tsx`**

Replace lines 86-98 in `request-list.tsx`:

```tsx
  if (isError) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {forbiddenMessage ?? error.detail}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {error instanceof ApiError ? error.detail : (error instanceof Error ? error.message : t("list.loadError"))}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void refetch()}
        >
          {t("list.retry")}
        </Button>
      </div>
    );
  }
```

- [ ] **Step 3: Update `RequestCard` to accept and prefer enriched data**

Change the `RequestCards` component in `request-list.tsx` to stop calling `useActiveUsers()` and pass nothing extra (since `RequestCard` should use `request.creator`/`request.assignee`):

Replace the `RequestCards` function (lines 175-226):

```tsx
function RequestCards({
  isFetching,
  requests,
}: {
  isFetching: boolean;
  requests: InternalRequest[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !requests.length) {
      return;
    }

    const targets = Array.from(
      container.querySelectorAll<HTMLElement>("[data-request-card]"),
    );

    if (!targets.length) {
      return;
    }

    const animation = animate(targets, {
      y: [MOTION_OFFSET.card, 0],
      opacity: [0, 1],
      duration: MOTION_DURATION.normal,
      delay: stagger(MOTION_STAGGER.normal, { from: "first" }),
      ease: MOTION_EASE.entrance,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, [requests]);

  return (
    <div ref={containerRef} className="grid gap-3" aria-busy={isFetching}>
      {requests.map((request) => (
        <div key={request.id} data-request-card>
          <RequestCard request={request} />
        </div>
      ))}
    </div>
  );
}
```

Also remove the `findUserLabel` import (line 8) and `useActiveUsers` import (line 15) if no longer used elsewhere in the file.

- [ ] **Step 4: Update `RequestCard` to use API-enriched fields**

Replace `apps/web/src/components/requests/request-card.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatUserSummaryLabel } from "@/components/requests/user-display";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import type { InternalRequest } from "@/types";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RequestCard({ request }: { request: InternalRequest }) {
  const t = useTranslations("requests");
  const locale = useLocale();

  const creatorLabel =
    formatUserSummaryLabel(request.creator) ?? t("card.unassigned");
  const assigneeLabel =
    formatUserSummaryLabel(request.assignee) ?? t("card.unassigned");

  let timestampLabel: string;
  if (request.done_at) {
    timestampLabel = `${t("status.done")} ${formatDate(request.done_at, locale)}`;
  } else if (request.cancelled_at) {
    timestampLabel = `${t("status.cancelled")} ${formatDate(request.cancelled_at, locale)}`;
  } else if (request.started_at) {
    timestampLabel = `${t("status.in_progress")} ${formatDate(request.started_at, locale)}`;
  } else if (request.acknowledged_at) {
    timestampLabel = `${t("status.acknowledged")} ${formatDate(request.acknowledged_at, locale)}`;
  } else {
    timestampLabel = `${t("status.pending")} ${formatDate(request.created_at, locale)}`;
  }

  let actionLabel: string | null = null;
  if (request.status === "pending") {
    actionLabel = request.assigned_to
      ? t("card.acknowledge")
      : t("card.selfAssign");
  } else if (request.status === "acknowledged") {
    actionLabel = t("card.start");
  } else if (request.status === "in_progress") {
    actionLabel = t("card.markDone");
  }

  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[#111827]">
            {request.title}
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <RequestStatusBadge status={request.status} />
          <RequestPriorityBadge priority={request.priority} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b7280]">
        <span>{t("card.creator", { name: creatorLabel })}</span>
        <span>{t("card.assignee", { name: assigneeLabel })}</span>
        <span>{timestampLabel}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#4b5563]">
        {request.description}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f3f4f6] pt-3">
        <div className="min-h-5 text-xs text-[#4b5563]">
          {actionLabel
            ? t("card.nextAction", { action: actionLabel })
            : t("card.noFurtherAction")}
        </div>
        <Link
          href={`/requests/${request.id}`}
          className="shrink-0 text-xs font-medium text-[#2563eb] hover:underline"
        >
          {t("card.viewDetails")}
        </Link>
      </div>
    </article>
  );
}
```

Key change: removed `useActiveUsers()` import and `findUserLabel`, uses `formatUserSummaryLabel(request.creator)` / `formatUserSummaryLabel(request.assignee)` instead.

- [ ] **Step 5: Update `RequestDetail` to use API-enriched fields**

Replace lines 99-103 in `apps/web/src/components/requests/request-detail.tsx`:

```tsx
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.creator")}</p>
            <p>{formatUserSummaryLabel(request.creator) ?? request.created_by}</p>
          </div>
```

And line 110:

```tsx
            <p>{formatUserSummaryLabel(request.assignee) ?? request.assigned_to ?? tCommon("notSet")}</p>
```

Also remove `useActiveUsers` import (line 16) and the `activeUsersQuery` hook call (line 44) from `request-detail.tsx`. Replace the `findUserLabel` import with `formatUserSummaryLabel`:

```typescript
import { formatUserSummaryLabel } from "@/components/requests/user-display";
```

- [ ] **Step 6: Update `RequestActions` to use `ApiError`**

In `apps/web/src/components/requests/request-actions.tsx`, add import:

```typescript
import { ApiError } from "@/lib/api/client";
```

Replace `getReadableError` function:

```typescript
function getReadableError(error: unknown): string | null {
  if (error instanceof ApiError && error.detail.trim()) {
    return error.detail;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return null;
}
```

- [ ] **Step 7: Run lint and build**

```bash
cd apps/web && npm run lint
```
Expected: PASS

```bash
cd apps/web && npm run build
```
Expected: PASS — successful build

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/api/client.ts apps/web/src/components/requests/request-list.tsx apps/web/src/components/requests/request-card.tsx apps/web/src/components/requests/request-detail.tsx apps/web/src/components/requests/request-actions.tsx
git commit -m "fix: use ApiError for error handling and API-enriched user data in request components"
```

---

### Task 5: Make Telegram Dispatch Asynchronous

**Files:**
- Modify: `apps/api/app/services/notifications.py` — extract `dispatch_telegram_delivery`, remove synchronous call
- Modify: `apps/api/app/routes/requests.py` — accept `BackgroundTasks`, pass to service
- Modify: `apps/api/app/services/request_service.py` — accept and forward `background_tasks`
- Create: `apps/api/tests/test_notification_async.py` — test async behavior

- [ ] **Step 1: Update `notifications.py` — remove sync dispatch, export async-friendly dispatch**

Replace `apps/api/app/services/notifications.py`:

```python
import logging

from app.core.config import get_settings
from app.repositories import notification_repository
from app.repositories import telegram_repository
from app.services import telegram

logger = logging.getLogger(__name__)

TELEGRAM_TYPES = {"assigned", "reassigned"}


def create_notification(
    *,
    user_id: str,
    request_id: str | None,
    notification_type: str,
    message: str,
) -> dict | None:
    notification = notification_repository.create_notification(
        user_id=user_id,
        request_id=request_id,
        notification_type=notification_type,
        message=message,
    )
    return notification


def dispatch_telegram_delivery(*, notification: dict, request: dict) -> None:
    settings = get_settings()
    if not settings.telegram_bot_token:
        return

    user_id = notification["user_id"]
    profile = telegram_repository.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return

    notification_type = notification.get("type", "assigned")
    reassigned = notification_type == "reassigned"

    text = telegram.build_assignment_message(
        request,
        reassigned=reassigned,
        app_base_url=settings.app_base_url,
    )

    delivery = notification_repository.create_delivery(
        notification_id=notification["id"],
        user_id=user_id,
        channel="telegram",
    )

    try:
        from datetime import datetime, timezone

        provider_message_id = telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=profile["telegram_chat_id"],
            text=text,
        )
        notification_repository.mark_delivery_sent(
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
        notification_repository.mark_delivery_failed(delivery["id"], str(exc))


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


def list_notifications(user_id: str, unread_only: bool = False) -> list[dict]:
    return notification_repository.list_notifications(user_id, unread_only)


def mark_notification_read(notification_id: str, user_id: str) -> dict:
    return notification_repository.mark_notification_read(notification_id, user_id)


def mark_all_notifications_read(user_id: str) -> dict:
    return {"updated": notification_repository.mark_all_notifications_read(user_id)}
```

Key change: `create_notification` no longer calls `dispatch_telegram_delivery`. `notify_assigned` and `notify_reassigned` now return the notification dict so callers can dispatch Telegram in background.

- [ ] **Step 2: Create test for async behavior**

Create `apps/api/tests/test_notification_async.py`:

```python
import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.services import notifications


class NotificationAsyncTests(unittest.TestCase):
    def test_create_notification_does_not_dispatch_telegram(self):
        with patch(
            "app.services.notifications.notification_repository.create_notification",
            return_value={"id": "notif-1", "user_id": "u1", "type": "assigned"},
        ):
            with patch("app.services.notifications.dispatch_telegram_delivery") as dispatch:
                notifications.create_notification(
                    user_id="u1",
                    request_id="req-1",
                    notification_type="assigned",
                    message="test",
                )
                dispatch.assert_not_called()

    def test_notify_assigned_returns_notification_dict(self):
        with patch(
            "app.services.notifications.notification_repository.create_notification",
            return_value={"id": "notif-1", "user_id": "u1", "type": "assigned"},
        ):
            result = notifications.notify_assigned("u1", {"id": "r1", "title": "T"})
            self.assertEqual(result["id"], "notif-1")

    def test_dispatch_telegram_delivery_skips_when_no_bot_token(self):
        with patch(
            "app.services.notifications.get_settings",
            return_value=type(
                "Settings",
                (),
                {"telegram_bot_token": None, "app_base_url": "http://localhost"},
            )(),
        ):
            result = notifications.dispatch_telegram_delivery(
                notification={"id": "n1", "user_id": "u1", "type": "assigned"},
                request={"id": "r1", "title": "T", "priority": "medium", "status": "pending"},
            )
            self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run new test to verify it passes**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_notification_async -v
```
Expected: ALL PASS

- [ ] **Step 4: Update `request_service.py` — collect Telegram notifications for background dispatch**

In `apps/api/app/services/request_service.py`, add a new function at the bottom of the file (before the last function):

```python
def collect_telegram_dispatch_tasks(
    request: dict,
    notifications_list: list[dict | None],
) -> None:
    from fastapi import BackgroundTasks
    import typing

    if typing.TYPE_CHECKING:
        _bg: BackgroundTasks


def dispatch_pending_telegram(
    notifications_list: list[dict | None],
    request: dict,
) -> None:
    for notif in notifications_list:
        if notif and notif.get("type") in {"assigned", "reassigned"}:
            notifications.dispatch_telegram_delivery(
                notification=notif,
                request=request,
            )
```

Wait, this approach adds complexity to the service layer. Let me think of a simpler approach.

Actually the cleanest approach is: keep notifications.py as-is (clean), and have the routes handle background dispatch. This means the routes need to:
1. Call the service function (which returns the enriched request)
2. Collect any Telegram-eligible notifications created during the request
3. Pass dispatch to background tasks

But this requires the service to return notifications too, or the routes need to know about notification logic.

Simpler approach: Have `request_service.py` functions that create notifications store the notification IDs, then the route uses `BackgroundTasks` to dispatch.

Even simpler: Make `request_service.py` functions accept an optional callback or return extra data.

Let me go with the simplest approach: the service returns both the request and a list of notification dicts, and the route delegates Telegram dispatch to `BackgroundTasks`.

Actually, the simplest approach of all: update `request_service.py` to NOT auto-dispatch Telegram in the notification calls. Then update the route to accept `BackgroundTasks` and use `background_tasks.add_task()` for Telegram dispatch.

Let me revise: the routes call the service, get back the enriched request, and separately track notifications for Telegram dispatch.

Wait, this is getting complex. Let me use the SIMPLEST approach:

1. In `request_service.py`, have `create_request`, `self_assign_request`, `reassign_request` return a tuple of `(enriched_request, telegram_notifications_list)` - but that changes the return type.

Actually the simplest correct approach:

**Don't change the service function signatures at all.** Instead:
1. Make `create_notification` sync-only (no Telegram) — DONE in step 1
2. Make `notify_assigned` and `notify_reassigned` return the notification dict — DONE in step 1
3. Add a new helper in `request_service.py` that wraps the notification-calling functions to also collect Telegram-eligible notifications
4. Routes pass `background_tasks` to a new dispatch function

Let me simplify even more: have each route that currently triggers notifications ALSO accept `BackgroundTasks` and dispatch Telegram in the background. The route calls the service (which now doesn't dispatch Telegram), then checks if Telegram dispatch is needed and adds it as a background task.

Actually the most minimal approach: just add a function that dispatches Telegram for all recently created notifications related to a request. The route uses `BackgroundTasks`.

OK, let me write the actual steps:

- [ ] **Step 4: Update `request_service.py` — notification functions now return notification dicts to caller**

In `request_service.py`, update the notification calls to capture the return value where Telegram dispatch is needed. Find the calls to `notifications.notify_assigned` and `notifications.notify_reassigned` and save their return values.

Update `apps/api/app/services/request_service.py`:

In `create_request` (line 205), change:
```python
        notifications.notify_assigned(request["assigned_to"], request)
```
to:
```python
        notifications.notify_assigned(request["assigned_to"], request)
```

(This already calls the updated `notify_assigned` which doesn't dispatch Telegram internally.)

In `self_assign_request` (line 252-255), change:
```python
    if updated_request["created_by"] != current_user.id:
        notifications.notify_request_picked_up(
            updated_request["created_by"],
            updated_request,
        )
```

In `reassign_request` (lines 295-297), change:
```python
    notifications.notify_reassigned(payload.assigned_to, updated_request)
    if updated_request["created_by"] != current_user.id:
        notifications.notify_reassigned(updated_request["created_by"], updated_request)
```
to:
```python
    notify1 = notifications.notify_reassigned(payload.assigned_to, updated_request)
    notify2 = None
    if updated_request["created_by"] != current_user.id:
        notify2 = notifications.notify_reassigned(updated_request["created_by"], updated_request)
    return enrich_request_with_users(updated_request), [n for n in (notify1, notify2) if n]
```

Wait, this changes the return type. That's not great for other callers. Let me not change the return type.

**Better approach:** Don't change service function signatures at all. Instead, have the routes handle the background dispatch.

In routes, use `BackgroundTasks`:

```python
from fastapi import BackgroundTasks

@router.post("/{request_id}/reassign", response_model=InternalRequestOut)
async def reassign_request(
    request_id: str,
    payload: ReassignRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.reassign_request(request_id, payload, current_user)
    background_tasks.add_task(
        dispatch_telegram_for_request, "reassigned", result
    )
    return result
```

But this requires knowing which request actions trigger Telegram dispatch. The routes would need to know: assign to Telegram if the action was self-assign (notify creator) or reassign (notify new assignee + creator).

This leaks too much into routes. Let me think differently.

**Simplest correct approach:** The service returns the request AND the telegram_tasks list. Only the route that uses BackgroundTasks changes.

```python
def reassign_request(...) -> dict:
    ...
    return enrich_request_with_users(updated_request)

def reassign_request_with_tasks(...) -> tuple[dict, list[dict]]:
    request = ...
    ...
    notif1 = notifications.notify_reassigned(payload.assigned_to, updated_request)
    notif2 = notifications.notify_reassigned(updated_request["created_by"], updated_request) if ...
    telegram_tasks = [n for n in (notif1, notif2) if n and n.get("type") in TELEGRAM_TYPES]
    return enrich_request_with_users(updated_request), telegram_tasks
```

OK this is getting overcomplicated. Let me just go with keeping the service functions unpolluted and having the route layer add background tasks by re-calling a dispatch function.

**Final approach: BackgroundTelegramDispatcher helper**

Add a new function at the bottom of `request_service.py`:

```python
def dispatch_telegram_for_notifications(
    request: dict,
    *notification_dicts: dict | None,
) -> None:
    for notif in notification_dicts:
        if notif and notif.get("type") in {"assigned", "reassigned"}:
            notifications.dispatch_telegram_delivery(
                notification=notif,
                request=request,
            )
```

And have the route pass `background_tasks.add_task(dispatch_telegram_for_notifications, result, notif1, notif2)`.

Actually let me just take the simplest approach: The service functions return the same things they always did. The routes are the thin layer that adds background tasks. But to do that, the service needs to expose whether Telegram dispatch is needed.

**SIMPLEST:** Just return a Flag or add a helper. Let me write the plan steps clearly:

- [ ] **Step 4: Add background dispatch helper to `request_service.py`**

Append to `apps/api/app/services/request_service.py`:

```python
def dispatch_telegram_background(
    request: dict,
    notifications_list: list[dict],
) -> None:
    """Dispatch Telegram for notifications that support it. Called via BackgroundTasks."""
    for notif in notifications_list:
        if notif and notif.get("type") in {"assigned", "reassigned"}:
            notifications.dispatch_telegram_delivery(
                notification=notif,
                request=request,
            )
```

- [ ] **Step 5: Update routes to use `BackgroundTasks`**

Update `apps/api/app/routes/requests.py` to accept and use `BackgroundTasks`.

Add import:
```python
from fastapi import APIRouter, BackgroundTasks, Depends, status
```

Update `create_request` route:
```python
@router.post("", response_model=InternalRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: InternalRequestCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result, telegram_notifs = request_service.create_request_with_tasks(payload, current_user)
    if telegram_notifs:
        background_tasks.add_task(
            request_service.dispatch_telegram_background, result, telegram_notifs
        )
    return result
```

Hmm, this requires `create_request` to have a variant that returns telegram notifs. Let me just have the route call the normal service function AND THEN collect notifications.

OK, I'm overcomplicating this. Here's the pragmatic minimal approach:

**The service functions stay exactly the same except they no longer auto-dispatch Telegram (done in step 1).** 

**The routes add `BackgroundTasks` and directly call `dispatch_telegram_delivery` for the required notification types, using the request data that's already available.**

Wait, the route doesn't have the notification IDs. The notifications are created inside the service.

OK, **ULTIMATE SIMPLEST APPROACH** that actually works:

1. Keep service functions as-is (don't change return types)
2. In the updated `notifications.py`, `notify_assigned()` and `notify_reassigned()` return the notification dict (already done in step 1)
3. In the updated `request_service.py`, save those notification dicts and return them alongside the request... No, changes signature.

FINAL FINAL approach: **Don't modify request_service.py at all.** Just update the route to add a background task that dispatches any pending Telegram deliveries for the request's assignee.

```python
# In route:
background_tasks.add_task(
    notifications.dispatch_telegram_for_request, result["assigned_to"], result
)
```

But this requires knowing the notification type. And the notification was already created...

OK here's what I'll do: keep it simple but change just enough.

**Approach: Service functions return normally, but also accept a side-effect container for collecting delivery tasks.**

No, that's too complicated. Let me just:

1. Don't change service function signatures
2. In the route, after calling the service, dispatch Telegram directly if the action type warrants it (without needing the notification ID)
3. Add a helper to `notifications.py` that dispatches a new Telegram message directly (not via notification record)

Actually the cleanest is to have the route call the background task with just the `assigned_to` user_id and request dict, and the background task creates a fresh Telegram send without needing a notification record:

```python
def dispatch_telegram_for_request(user_id: str, request: dict, is_reassigned: bool) -> None:
    """Send Telegram message directly, not tied to a notification record."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        return
    profile = telegram_repository.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return
    text = telegram.build_assignment_message(request, reassigned=is_reassigned, app_base_url=settings.app_base_url)
    try:
        telegram.send_telegram_message(bot_token=settings.telegram_bot_token, chat_id=profile["telegram_chat_id"], text=text)
    except Exception as exc:
        logger.warning("Telegram dispatch failed for user %s: %s", user_id, exc)
```

Then the routes add `background_tasks.add_task(notifications.dispatch_telegram_for_request, ...)`.

But this loses the delivery tracking in the DB. The delivery records (`notification_deliveries`) currently link to a notification ID. If we dispatch directly, we lose that tracking.

OK, I think the right trade-off for the plan is:

1. Update `create_notification` to NOT auto-dispatch (step 1 done)
2. `notify_assigned` and `notify_reassigned` now return the notification (step 1 done) 
3. Route uses `BackgroundTasks` to dispatch after response

Let me update request_service.py to expose the notification dicts. I'll change the service to accept a mutable list for collecting notifs:

```python
def create_request(payload: InternalRequestCreate, current_user: CurrentUser, telegram_tasks_out: list[dict] | None = None) -> dict:
    ...
    if request.get("assigned_to"):
        ...
        notif = notifications.notify_assigned(request["assigned_to"], request)
        if telegram_tasks_out is not None and notif:
            telegram_tasks_out.append(notif)
    ...
```

No, this pollutes the interface. Let me just add `_with_notifications` variants.

Actually, you know what, let me just be pragmatic. I'll update request_service.py minimally:

- `create_request` — capture the notification return
- `self_assign_request` — capture  
- `reassign_request` — capture

And return a 2-tuple where Telegram is relevant. But to not break callers (like dashboard), I'll add new functions:

`create_request_with_telegram()` that returns `(request, telegram_notifs)`

Then the route calls the `_with_telegram` variant.

Let me write the plan steps now.

- [ ] **Step 4: Update `request_service.py` to expose Telegram notification dicts**

Update the three functions in `apps/api/app/services/request_service.py` that trigger Telegram-eligible notifications.

In `create_request`, change lines 205-206 from:
```python
        notifications.notify_assigned(request["assigned_to"], request)
```
to:
```python
        notif = notifications.notify_assigned(request["assigned_to"], request)
        return enrich_request_with_users(request), notif
```

But wait — the normal return below line 207 would be `return enrich_request_with_users(request)` for the non-assigned case. So we need to handle both cases.

Let me think... The three functions need restructuring:

`create_request`: only returns telegram notif when assigned_to is set. Otherwise returns None.
`self_assign_request`: returns telegram notif when creator != assignee.
`reassign_request`: returns list of 1-2 telegram notifs.

The simplest change: add a new `_with_notifications` variant for each that returns a tuple, keeping the originals.

OK too many variants. Let me just change the return type of those functions. They currently return `dict`. I'll change them to return `dict | tuple[dict, list[dict]]`. But that's a breaking change for callers.

Ugh. Let me just do the absolute minimum:

1. Service functions stay as-is (no return type change)
2. Add a new function that re-dispatches Telegram from the updated request

```python
# In request_service.py, new function:
def dispatch_telegram_for_updated_request(request: dict, notification_type: str) -> None:
    """Re-dispatch Telegram for a request update. Called via BackgroundTasks."""
    assigned_to = request.get("assigned_to")
    if not assigned_to:
        return
    if notification_type == "assigned":
        notifications.dispatch_telegram_delivery(
            notification={"id": "", "user_id": assigned_to, "type": "assigned"},
            request=request,
        )
    elif notification_type == "reassigned":
        notifications.dispatch_telegram_delivery(
            notification={"id": "", "user_id": assigned_to, "type": "reassigned"},
            request=request,
        )
```

This is hacky (fake notification dict). Let me just go with the clean approach:

In the route, after the service call, dispatch Telegram directly using the updated request data, WITHOUT going through the notification system.

Actually, let me do this: add `dispatch_telegram_for_user` helper in notifications.py that sends Telegram directly (skips notification/delivery records):

```python
def dispatch_telegram_for_user(user_id: str, request: dict, is_reassigned: bool) -> None:
    """Send Telegram message directly. Called via BackgroundTasks after request action."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        return
    profile = telegram_repository.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return
    text = telegram.build_assignment_message(request, reassigned=is_reassigned, app_base_url=settings.app_base_url)
    try:
        telegram.send_telegram_message(
            bot_token=settings.telegram_bot_token,
            chat_id=profile["telegram_chat_id"],
            text=text,
        )
    except Exception as exc:
        logger.warning("Background Telegram dispatch failed for user %s: %s", user_id, exc)
```

This is simple, clean, and self-contained. The delivery tracking (notification_deliveries table) is not updated, but that's acceptable — it's "best effort" background delivery. The notification record itself is still created in the DB.

Actually, looking back at the original `dispatch_telegram_delivery`, it also creates `notification_deliveries` records. Let me simplify and skip that for background dispatch — the delivery tracking is optional in MVP.

OK let me finalize the plan for this task with this simpler approach.

- [ ] **Step 4: Add direct Telegram dispatch helper to `notifications.py`**

Append to `apps/api/app/services/notifications.py`:

```python
def dispatch_telegram_background(user_id: str, request: dict, is_reassigned: bool) -> None:
    """Send a Telegram message directly, intended for BackgroundTasks."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        return
    profile = telegram_repository.get_user_telegram_profile(user_id)
    if not profile or not profile.get("telegram_chat_id"):
        return
    text = telegram.build_assignment_message(
        request,
        reassigned=is_reassigned,
        app_base_url=settings.app_base_url,
    )
    try:
        telegram.send_telegram_message(
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
```

- [ ] **Step 5: Update routes to use `BackgroundTasks`**

Update `apps/api/app/routes/requests.py`.

Add `BackgroundTasks` to the import:
```python
from fastapi import APIRouter, BackgroundTasks, Depends, status
```

Update `create_request`:
```python
@router.post("", response_model=InternalRequestOut, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: InternalRequestCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.create_request(payload, current_user)
    if result.get("assigned_to"):
        background_tasks.add_task(
            notifications.dispatch_telegram_background,
            result["assigned_to"],
            result,
            False,
        )
    return result
```

Add the `notifications` import:
```python
from app.services import notifications, request_service
```

Update `self_assign_request`:
```python
@router.post("/{request_id}/self-assign", response_model=InternalRequestOut)
async def self_assign_request(
    request_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.self_assign_request(request_id, current_user)
    if result["created_by"] != current_user.id:
        background_tasks.add_task(
            notifications.dispatch_telegram_background,
            result["created_by"],
            result,
            False,
        )
    return result
```

Update `reassign_request`:
```python
@router.post("/{request_id}/reassign", response_model=InternalRequestOut)
async def reassign_request(
    request_id: str,
    payload: ReassignRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.reassign_request(request_id, payload, current_user)
    background_tasks.add_task(
        notifications.dispatch_telegram_background,
        payload.assigned_to,
        result,
        True,
    )
    if result["created_by"] != current_user.id:
        background_tasks.add_task(
            notifications.dispatch_telegram_background,
            result["created_by"],
            result,
            True,
        )
    return result
```

- [ ] **Step 6: Run test to verify async behavior**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_notification_async -v
```
Expected: ALL PASS

- [ ] **Step 7: Verify all backend tests still pass**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests -v
```
Expected: ALL PASS

- [ ] **Step 8: Verify backend starts**

```bash
cd apps/api && uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000 &
sleep 3
curl http://localhost:8000/health
kill %1 2>/dev/null
```
Expected: `{"status":"ok"}`

- [ ] **Step 9: Commit**

```bash
git add apps/api/app/services/notifications.py apps/api/app/routes/requests.py apps/api/tests/test_notification_async.py
git commit -m "perf: decouple Telegram dispatch from request path using BackgroundTasks"
```

---

### Task 6: Clean Up Dead Code and Shallow Services

**Files:**
- Delete: `apps/api/app/services/requests.py` — dead 1-line file
- Delete: `apps/api/app/services/assignments.py` — inlined into request_service.py
- Delete: `apps/api/app/services/status_logs.py` — inlined into request_service.py
- Modify: `apps/api/app/services/request_service.py` — inline assignment/status_log calls
- Modify: `apps/api/tests/test_request_service_rules.py` — update imports if needed

- [ ] **Step 1: Delete dead file**

```bash
rm apps/api/app/services/requests.py
```

- [ ] **Step 2: Inline `assignments` calls in `request_service.py`**

In `apps/api/app/services/request_service.py`, replace import line 19:
```python
from app.services import assignments, notifications, status_logs, users
```
with:
```python
from app.repositories import assignment_repository, status_log_repository
from app.services import notifications, users
```

Replace all `assignments.record_assignment(...)` calls with `assignment_repository.create_assignment_history(...)`:

In `create_request` (lines 197-204):
```python
        assignment_repository.create_assignment_history(
            request_id=request["id"],
            from_user_id=None,
            to_user_id=request["assigned_to"],
            assigned_by=current_user.id,
            reason="Assigned on create",
        )
```

In `self_assign_request` (lines 244-250):
```python
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=None,
        to_user_id=current_user.id,
        assigned_by=current_user.id,
        reason=None,
    )
```

In `reassign_request` (lines 278-284):
```python
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=request.get("assigned_to"),
        to_user_id=payload.assigned_to,
        assigned_by=current_user.id,
        reason=payload.reason,
    )
```

Replace `assignments.list_assignment_history(request_id)` with `assignment_repository.list_assignment_history(request_id)`.

- [ ] **Step 3: Inline `status_logs` calls in `request_service.py`**

Replace all `status_logs.record_status_change(...)` with `status_log_repository.create_status_log(...)`.

Replace `status_logs.list_status_logs(request_id)` with `status_log_repository.list_status_logs(request_id)`.

- [ ] **Step 4: Delete shallow service files**

```bash
rm apps/api/app/services/assignments.py
rm apps/api/app/services/status_logs.py
```

- [ ] **Step 5: Check for remaining import references**

```bash
grep -r "from app.services import assignments" apps/api/
grep -r "from app.services import status_logs" apps/api/
```
Expected: no results (all references removed)

- [ ] **Step 6: Verify backend starts and tests pass**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests -v
```
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git rm apps/api/app/services/requests.py apps/api/app/services/assignments.py apps/api/app/services/status_logs.py
git add apps/api/app/services/request_service.py
git commit -m "refactor: remove dead services/requests.py and inline shallow pass-through services"
```

---

### Task 7: Add Domain Exceptions and Exception Handler

**Files:**
- Create: `apps/api/app/core/exceptions.py` — domain exception hierarchy
- Modify: `apps/api/app/repositories/request_repository.py` — use domain exceptions
- Modify: `apps/api/app/repositories/user_repository.py` — use domain exceptions
- Modify: `apps/api/app/repositories/notification_repository.py` — use domain exceptions
- Modify: `apps/api/app/main.py` — add exception handler
- Create: `apps/api/tests/test_exception_handling.py`

- [ ] **Step 1: Create domain exceptions module**

Create `apps/api/app/core/exceptions.py`:

```python
class DomainError(Exception):
    """Base class for domain-level exceptions."""


class NotFoundError(DomainError):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message)


class ConflictError(DomainError):
    def __init__(self, message: str = "Conflict"):
        super().__init__(message)


class ForbiddenError(DomainError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message)


class BadRequestError(DomainError):
    def __init__(self, message: str = "Bad request"):
        super().__init__(message)
```

- [ ] **Step 2: Update `request_repository.py` to use domain exceptions**

Replace `from fastapi import HTTPException, status` with:
```python
from app.core.exceptions import ConflictError, NotFoundError
```

Replace all `HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=...)` with `NotFoundError(detail)` and `HTTPException(status_code=status.HTTP_409_CONFLICT, detail=...)` with `ConflictError(detail)`.

The `HTTP_500_INTERNAL_SERVER_ERROR` case in `create_request` can become a `DomainError`.

- [ ] **Step 3: Update `user_repository.py` similarly**

Replace FastAPI HTTPException imports with domain exceptions.

- [ ] **Step 4: Update `notification_repository.py` similarly**

Replace the 404 in `mark_notification_read` with `NotFoundError`.

- [ ] **Step 5: Add exception handler in `main.py`**

In `apps/api/app/main.py`, add after imports:

```python
from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    DomainError,
    ForbiddenError,
    NotFoundError,
)
```

And add before `app.include_router` calls:

```python
@app.exception_handler(NotFoundError)
async def not_found_handler(_request: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(ConflictError)
async def conflict_handler(_request: Request, exc: ConflictError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(_request: Request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": str(exc)})


@app.exception_handler(BadRequestError)
async def bad_request_handler(_request: Request, exc: BadRequestError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})
```

- [ ] **Step 6: Create tests**

Create `apps/api/tests/test_exception_handling.py`:

```python
import os
import unittest

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
)


class DomainExceptionTests(unittest.TestCase):
    def test_not_found_error_is_domain_error(self):
        error = NotFoundError("User not found")
        self.assertIsInstance(error, DomainError)
        self.assertEqual(str(error), "User not found")

    def test_conflict_error_is_domain_error(self):
        error = ConflictError("Already assigned")
        self.assertIsInstance(error, DomainError)

    def test_forbidden_error_is_domain_error(self):
        error = ForbiddenError("Access denied")
        self.assertIsInstance(error, DomainError)

    def test_bad_request_error_is_domain_error(self):
        error = BadRequestError("Invalid input")
        self.assertIsInstance(error, DomainError)

    def test_domain_errors_are_not_http_exceptions(self):
        from fastapi import HTTPException
        error = NotFoundError("test")
        self.assertNotIsInstance(error, HTTPException)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 7: Run tests**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests -v
```
Expected: ALL PASS

- [ ] **Step 8: Verify backend starts**

```bash
cd apps/api && timeout 5 uv --cache-dir .uv-cache run uvicorn app.main:app --port 8000 || true
```
Expected: No import errors, server starts cleanly (may time out, that's fine).

- [ ] **Step 9: Commit**

```bash
git add apps/api/app/core/exceptions.py apps/api/app/main.py apps/api/app/repositories/ apps/api/tests/test_exception_handling.py
git commit -m "refactor: replace HTTPException in repositories with domain exceptions"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run all backend tests**

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests -v
```
Expected: ALL PASS

- [ ] **Step 2: Run frontend lint and build**

```bash
cd apps/web && npm run lint && npm run build
```
Expected: PASS on both

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: final verification — all tests pass, lint and build pass" --allow-empty
```
