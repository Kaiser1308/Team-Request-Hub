# Backend API Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining avoidable backend/API latency by verifying Supabase JWTs locally, adding a dashboard summary endpoint, and returning creator/assignee display data directly with request responses.

**Architecture:** Keep FastAPI as the business-logic boundary and Supabase as Auth/Postgres provider. Replace per-request remote Supabase Auth validation with local JWT verification using `SUPABASE_JWT_SECRET`, then load/cache the app profile from `public.users`. Add purpose-built read endpoints that reduce frontend API fan-out and avoid extra frontend `/users/active` calls for request labels.

**Tech Stack:** FastAPI, python-jose, Supabase Python client, Pydantic, unittest, Next.js 15 App Router, React 19, TanStack Query v5, TypeScript strict mode.

---

## Scope Boundary

This plan is the follow-up to `docs/superpowers/plans/2026-05-22-sidebar-navigation-performance.md`.

Do **not** duplicate work from that plan:

- Do not rework list-card rendering.
- Do not add list `limit` support unless it is missing after the other agent finishes.
- Do not change sidebar UI behavior.
- Do not change request action UI.

This plan only covers optimizations not included in the sidebar plan:

1. Verify Supabase JWT locally instead of calling `supabase.auth.get_user(token)` on every backend request.
2. Add `GET /dashboard/summary` so the dashboard does not call several list endpoints.
3. Return enriched creator/assignee labels from backend request responses.
4. Add lightweight backend timing logs for future evidence.

## Files And Responsibilities

Backend:

- Modify: `apps/api/app/core/config.py` - ensure `SUPABASE_JWT_SECRET` is available.
- Modify: `apps/api/app/core/auth.py` - decode/verify JWT locally, then load profile by `sub`.
- Modify: `apps/api/app/repositories/user_repository.py` - add direct profile lookup by user id and batched lookup by ids.
- Modify: `apps/api/app/repositories/request_repository.py` - add helpers for dashboard summary queries if needed.
- Modify: `apps/api/app/services/request_service.py` - enrich request dictionaries with `creator` and `assignee` fields.
- Create: `apps/api/app/schemas/dashboard.py` - dashboard summary response schemas.
- Create: `apps/api/app/routes/dashboard.py` - dashboard summary route.
- Create: `apps/api/app/services/dashboard.py` - dashboard summary service.
- Modify: `apps/api/app/main.py` - include dashboard router.
- Modify: `apps/api/app/schemas/requests.py` - add optional creator/assignee display fields to request response.
- Test: `apps/api/tests/test_auth.py`
- Test: `apps/api/tests/test_request_service_workflow.py`
- Test: `apps/api/tests/test_dashboard_service.py`
- Test: `apps/api/tests/test_dashboard_routes.py`
- Modify docs: `docs/api-contract.md`, `docs/architecture.md`

Frontend:

- Modify: `apps/web/src/types/index.ts` - add `UserSummary` and enriched request fields.
- Create: `apps/web/src/lib/api/dashboard.ts` - dashboard summary API.
- Modify: `apps/web/src/lib/api/query-keys.ts` - dashboard summary query key.
- Create: `apps/web/src/hooks/use-dashboard-summary.ts` - TanStack Query hook.
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx` - use dashboard summary endpoint.
- Modify: `apps/web/src/components/requests/user-display.ts` - prefer enriched request user objects.
- Modify request list/card/detail only if needed to consume enriched fields after sidebar plan lands.

Required repo rule:

- Before editing existing symbols, run GitNexus impact analysis if available. If GitNexus MCP is unavailable, write in progress notes: `GitNexus unavailable; direct source inspection used.`
- Before committing, run `gitnexus_detect_changes()` if available. If unavailable, inspect `rtk git diff --stat`.

---

## Task 1: Local JWT Verification

**Files:**
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/core/auth.py`
- Modify: `apps/api/app/repositories/user_repository.py`
- Test: `apps/api/tests/test_auth.py`

- [ ] **Step 1: Run impact analysis**

Run if GitNexus is available:

```txt
gitnexus_impact({target: "get_current_user", direction: "upstream"})
gitnexus_impact({target: "get_user_or_404", direction: "upstream"})
gitnexus_impact({target: "Settings", direction: "upstream"})
```

If unavailable, record:

```txt
GitNexus unavailable; direct source inspection used for auth and user repository.
```

- [ ] **Step 2: Add failing auth tests**

In `apps/api/tests/test_auth.py`, add tests for local JWT behavior. Use `python-jose`, already present in `apps/api/requirements.txt`.

```python
from jose import jwt
from app.core.config import get_settings


def build_token(user_id="user-1", email="user@example.com", secret="secret"):
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": "authenticated",
            "role": "authenticated",
            "iss": "supabase",
        },
        secret,
        algorithm="HS256",
    )
```

Add:

```python
async def test_current_user_verifies_jwt_locally_without_supabase_auth_call(self):
    token = build_token()
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    fake_supabase = FakeSupabase(SimpleNamespace(user=None))

    with (
        patch("app.core.auth.get_supabase_admin", return_value=fake_supabase),
        patch("app.core.auth.get_settings") as settings,
    ):
        settings.return_value.supabase_jwt_secret = "secret"
        current_user = await get_current_user(credentials)

    self.assertEqual(current_user.id, "user-1")
    self.assertEqual(fake_supabase.auth_get_user_count, 0)
    self.assertEqual(fake_supabase.table_execute_count, 1)


async def test_current_user_rejects_invalid_jwt_signature(self):
    token = build_token(secret="wrong-secret")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with patch("app.core.auth.get_settings") as settings:
        settings.return_value.supabase_jwt_secret = "secret"
        with self.assertRaises(HTTPException) as context:
            await get_current_user(credentials)

    self.assertEqual(context.exception.status_code, 401)
```

- [ ] **Step 3: Run tests and confirm failure**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest tests.test_auth"
```

Expected: FAIL because `get_current_user` still calls `supabase.auth.get_user`.

- [ ] **Step 4: Add settings access if missing**

In `apps/api/app/core/config.py`, confirm settings exposes:

```python
supabase_jwt_secret: str
```

If it does not, add it to the settings model matching `.env.example` key `SUPABASE_JWT_SECRET`.

- [ ] **Step 5: Add user lookup helper**

In `apps/api/app/repositories/user_repository.py`, add:

```python
def get_user_profile_or_404(user_id: str) -> dict:
    return get_user_or_404(user_id)
```

If `get_user_or_404` already selects `id,email,name,avatar_url,role,is_active,created_at`, reuse it. Do not duplicate query logic.

- [ ] **Step 6: Implement local JWT decode**

In `apps/api/app/core/auth.py`, import:

```python
from jose import JWTError, jwt
from app.core.config import get_settings
from app.repositories import user_repository
```

Add helper:

```python
def decode_supabase_access_token(token: str) -> tuple[str, str | None]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_iss": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user_id = payload.get("sub")
    email = payload.get("email")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return user_id, email
```

Change `get_current_user` to:

```python
async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> CurrentUser:
    token = credentials.credentials
    cached_user = _get_cached_current_user(token)
    if cached_user is not None:
        return cached_user

    user_id, token_email = decode_supabase_access_token(token)
    profile = user_repository.get_user_profile_or_404(user_id)

    current_user = CurrentUser(
        id=profile["id"],
        email=profile.get("email") or token_email,
        name=profile.get("name"),
        avatar_url=profile.get("avatar_url"),
        role=profile["role"],
        is_active=profile.get("is_active", True),
    )
    _current_user_cache[token] = (
        monotonic() + CURRENT_USER_CACHE_TTL_SECONDS,
        current_user,
    )
    return current_user
```

Remove the `supabase.auth.get_user(token)` path entirely.

- [ ] **Step 7: Run auth tests**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest tests.test_auth"
```

Expected: PASS.

- [ ] **Step 8: Run backend suite**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
```

Expected: PASS.

- [ ] **Step 9: Commit**

Run:

```powershell
rtk git add apps/api/app/core/config.py apps/api/app/core/auth.py apps/api/app/repositories/user_repository.py apps/api/tests/test_auth.py
rtk git commit -m "perf: verify supabase jwt locally"
```

---

## Task 2: Enriched Request Response

**Files:**
- Modify: `apps/api/app/schemas/requests.py`
- Modify: `apps/api/app/repositories/user_repository.py`
- Modify: `apps/api/app/services/request_service.py`
- Test: `apps/api/tests/test_request_service_workflow.py`
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/components/requests/user-display.ts`

- [ ] **Step 1: Run impact analysis**

Run if available:

```txt
gitnexus_impact({target: "InternalRequestOut", direction: "upstream"})
gitnexus_impact({target: "list_requests", direction: "upstream"})
gitnexus_impact({target: "RequestCard", direction: "upstream"})
```

- [ ] **Step 2: Add backend schema**

In `apps/api/app/schemas/requests.py`, add:

```python
class UserSummary(BaseModel):
    id: str
    email: str | None = None
    name: str | None = None
    avatar_url: str | None = None
```

Then add to `InternalRequestOut`:

```python
creator: UserSummary | None = None
assignee: UserSummary | None = None
```

- [ ] **Step 3: Add batched user lookup**

In `apps/api/app/repositories/user_repository.py`, add:

```python
def list_user_summaries(user_ids: list[str]) -> dict[str, dict]:
    unique_ids = sorted(set(user_ids))
    if not unique_ids:
        return {}

    result = (
        get_supabase_admin()
        .table("users")
        .select("id,email,name,avatar_url")
        .in_("id", unique_ids)
        .execute()
    )
    return {item["id"]: item for item in result.data or []}
```

- [ ] **Step 4: Add request enrichment service helper**

In `apps/api/app/services/request_service.py`, import `user_repository` or expose through `users` service. Add:

```python
def enrich_requests_with_users(requests: list[dict]) -> list[dict]:
    user_ids: list[str] = []
    for request in requests:
        if request.get("created_by"):
            user_ids.append(request["created_by"])
        if request.get("assigned_to"):
            user_ids.append(request["assigned_to"])

    users_by_id = user_repository.list_user_summaries(user_ids)
    enriched = []
    for request in requests:
        item = dict(request)
        item["creator"] = users_by_id.get(request.get("created_by"))
        item["assignee"] = users_by_id.get(request.get("assigned_to"))
        enriched.append(item)
    return enriched


def enrich_request_with_users(request: dict) -> dict:
    return enrich_requests_with_users([request])[0]
```

Apply enrichment in:

```txt
list_requests
create_request
get_request_detail
update_request
self_assign_request
reassign_request
update_status
mark_done
cancel_request
```

For mutation endpoints, enrich only the final returned request.

- [ ] **Step 5: Add backend test**

In `apps/api/tests/test_request_service_workflow.py`, add:

```python
def test_list_requests_enriches_creator_and_assignee(self):
    current_user = CurrentUser(
        id="lead-1",
        email="lead@example.com",
        name="Lead",
        role="lead",
        is_active=True,
    )
    requests = [
        {
            "id": "request-1",
            "created_by": "creator-1",
            "assigned_to": "assignee-1",
            "status": "pending",
        }
    ]
    users_by_id = {
        "creator-1": {"id": "creator-1", "email": "creator@example.com", "name": "Creator", "avatar_url": None},
        "assignee-1": {"id": "assignee-1", "email": "assignee@example.com", "name": "Assignee", "avatar_url": None},
    }

    with (
        patch("app.services.request_service.request_repository.list_all_requests", return_value=requests),
        patch("app.services.request_service.user_repository.list_user_summaries", return_value=users_by_id),
    ):
        result = request_service.list_requests("all", current_user)

    self.assertEqual(result[0]["creator"]["email"], "creator@example.com")
    self.assertEqual(result[0]["assignee"]["email"], "assignee@example.com")
```

If the sidebar plan has changed `list_all_requests` to require `limit`, update the patch assertion/setup to match that signature.

- [ ] **Step 6: Update frontend types**

In `apps/web/src/types/index.ts`, add:

```ts
export interface UserSummary {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
}
```

Add to `InternalRequest`:

```ts
creator?: UserSummary | null;
assignee?: UserSummary | null;
```

- [ ] **Step 7: Update display helper**

In `apps/web/src/components/requests/user-display.ts`, add:

```ts
import type { User, UserSummary } from "@/types";

export function formatUserSummaryLabel(user?: UserSummary | null) {
  if (!user) {
    return null;
  }
  if (user.name && user.email) {
    return `${user.name} (${user.email})`;
  }
  return user.name ?? user.email ?? user.id;
}
```

Update list/detail consumers to prefer:

```ts
formatUserSummaryLabel(request.creator) ?? findUserLabel(activeUsers, request.created_by)
formatUserSummaryLabel(request.assignee) ?? findUserLabel(activeUsers, request.assigned_to)
```

If the sidebar plan has already made `RequestCard` presentational, pass the enriched labels from `RequestList`.

- [ ] **Step 8: Verify**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: all PASS.

- [ ] **Step 9: Commit**

Run:

```powershell
rtk git add apps/api/app/schemas/requests.py apps/api/app/repositories/user_repository.py apps/api/app/services/request_service.py apps/api/tests/test_request_service_workflow.py apps/web/src/types/index.ts apps/web/src/components/requests/user-display.ts apps/web/src/components/requests
rtk git commit -m "perf: enrich request responses with user labels"
```

---

## Task 3: Dashboard Summary Endpoint

**Files:**
- Create: `apps/api/app/schemas/dashboard.py`
- Create: `apps/api/app/services/dashboard.py`
- Create: `apps/api/app/routes/dashboard.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/test_dashboard_service.py`
- Test: `apps/api/tests/test_dashboard_routes.py`
- Create: `apps/web/src/lib/api/dashboard.ts`
- Create: `apps/web/src/hooks/use-dashboard-summary.ts`
- Modify: `apps/web/src/lib/api/query-keys.ts`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Modify: `docs/api-contract.md`

- [ ] **Step 1: Define response schema**

Create `apps/api/app/schemas/dashboard.py`:

```python
from pydantic import BaseModel

from app.schemas.requests import InternalRequestOut


class DashboardCounts(BaseModel):
    assigned: int
    created: int
    pool: int
    done: int
    urgent: int


class DashboardSummaryOut(BaseModel):
    counts: DashboardCounts
    assigned_recent: list[InternalRequestOut]
    created_recent: list[InternalRequestOut]
    pool_recent: list[InternalRequestOut]
    notifications_unread: int
```

- [ ] **Step 2: Add service tests first**

Create `apps/api/tests/test_dashboard_service.py`:

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
    def test_get_dashboard_summary_uses_small_recent_lists(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        with (
            patch("app.services.dashboard.request_service.list_requests", return_value=[]) as list_requests,
            patch("app.services.dashboard.notifications.list_notifications", return_value=[]),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        self.assertEqual(result["counts"]["assigned"], 0)
        self.assertEqual(result["notifications_unread"], 0)
        self.assertEqual(list_requests.call_count, 4)
        list_requests.assert_any_call("assigned", current_user, limit=10)
        list_requests.assert_any_call("created", current_user, limit=10)
        list_requests.assert_any_call("pool", current_user, limit=10)
        list_requests.assert_any_call("done", current_user, limit=10)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run test and verify failure**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service"
```

Expected: FAIL because `app.services.dashboard` does not exist.

- [ ] **Step 4: Implement dashboard service**

Create `apps/api/app/services/dashboard.py`:

```python
from app.schemas.users import CurrentUser
from app.services import notifications, request_service


def get_dashboard_summary(current_user: CurrentUser) -> dict:
    assigned_recent = request_service.list_requests("assigned", current_user, limit=10)
    created_recent = request_service.list_requests("created", current_user, limit=10)
    pool_recent = request_service.list_requests("pool", current_user, limit=10)
    done_recent = request_service.list_requests("done", current_user, limit=10)
    unread_notifications = notifications.list_notifications(
        current_user.id,
        unread_only=True,
    )

    urgent = sum(
        1
        for request in [*assigned_recent, *created_recent, *pool_recent]
        if request.get("priority") == "urgent"
    )

    return {
        "counts": {
            "assigned": len(assigned_recent),
            "created": len(created_recent),
            "pool": len(pool_recent),
            "done": len(done_recent),
            "urgent": urgent,
        },
        "assigned_recent": assigned_recent,
        "created_recent": created_recent,
        "pool_recent": pool_recent,
        "notifications_unread": len(unread_notifications),
    }
```

This returns bounded dashboard data. If exact total counts are required later, add count-specific repository queries in a separate task.

- [ ] **Step 5: Add route**

Create `apps/api/app/routes/dashboard.py`:

```python
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import get_current_user, require_active_current_user
from app.schemas.dashboard import DashboardSummaryOut
from app.schemas.users import CurrentUser
from app.services import dashboard

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryOut)
async def get_dashboard_summary(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return dashboard.get_dashboard_summary(current_user)
```

In `apps/api/app/main.py`, include:

```python
from app.routes import dashboard

app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
```

- [ ] **Step 6: Add frontend API and hook**

Create `apps/web/src/lib/api/dashboard.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { InternalRequest } from "@/types";

export interface DashboardCounts {
  assigned: number;
  created: number;
  pool: number;
  done: number;
  urgent: number;
}

export interface DashboardSummary {
  counts: DashboardCounts;
  assigned_recent: InternalRequest[];
  created_recent: InternalRequest[];
  pool_recent: InternalRequest[];
  notifications_unread: number;
}

export function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/dashboard/summary");
}
```

In `apps/web/src/lib/api/query-keys.ts`, add:

```ts
dashboardSummary: ["dashboard", "summary"] as const,
```

Create `apps/web/src/hooks/use-dashboard-summary.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/api/dashboard";
import { queryKeys } from "@/lib/api/query-keys";

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: getDashboardSummary,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
```

- [ ] **Step 7: Update dashboard page**

In `apps/web/src/app/(dashboard)/dashboard/page.tsx`, replace separate request hooks with:

```ts
const summaryQuery = useDashboardSummary();
```

Use:

```ts
summaryQuery.data?.counts
summaryQuery.data?.assigned_recent
summaryQuery.data?.created_recent
summaryQuery.data?.pool_recent
summaryQuery.data?.notifications_unread
```

Keep `useCurrentUser()` only if dashboard displays the current user name.

- [ ] **Step 8: Update API docs**

In `docs/api-contract.md`, add:

```md
## Dashboard

```txt
GET /dashboard/summary
```

Returns bounded dashboard data for the current active user:

```json
{
  "counts": {
    "assigned": 3,
    "created": 4,
    "pool": 2,
    "done": 5,
    "urgent": 1
  },
  "assigned_recent": [],
  "created_recent": [],
  "pool_recent": [],
  "notifications_unread": 0
}
```
```

- [ ] **Step 9: Verify**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: all PASS.

- [ ] **Step 10: Commit**

Run:

```powershell
rtk git add apps/api/app/schemas/dashboard.py apps/api/app/services/dashboard.py apps/api/app/routes/dashboard.py apps/api/app/main.py apps/api/tests/test_dashboard_service.py apps/api/tests/test_dashboard_routes.py apps/web/src/lib/api/dashboard.ts apps/web/src/hooks/use-dashboard-summary.ts apps/web/src/lib/api/query-keys.ts 'apps/web/src/app/(dashboard)/dashboard/page.tsx' docs/api-contract.md
rtk git commit -m "perf: add dashboard summary endpoint"
```

---

## Task 4: Lightweight Backend Timing Logs

**Files:**
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/main.py`
- Modify: `apps/api/.env.example`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Add config flag**

In `apps/api/app/core/config.py`, add:

```python
log_request_timing: bool = False
```

In `apps/api/.env.example`, add:

```txt
LOG_REQUEST_TIMING=false
```

- [ ] **Step 2: Add middleware**

In `apps/api/app/main.py`, add:

```python
import time
import logging
from fastapi import Request
from app.core.config import get_settings

logger = logging.getLogger("app.request_timing")


@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started_at) * 1000
    if get_settings().log_request_timing:
        logger.info(
            "%s %s %s %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
    return response
```

Place this after `app = FastAPI(...)` and before routes are included.

- [ ] **Step 3: Update docs**

In `docs/architecture.md`, add:

```md
Backend request timing can be enabled locally with `LOG_REQUEST_TIMING=true`. Use it when diagnosing slow API endpoints before adding optimizations.
```

- [ ] **Step 4: Verify backend**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
rtk git add apps/api/app/core/config.py apps/api/app/main.py apps/api/.env.example docs/architecture.md
rtk git commit -m "chore: add backend timing logs"
```

---

## Task 5: Final Verification And Performance Check

**Files:**
- Create: `docs/backend-api-performance-optimization.md`

- [ ] **Step 1: Detect changed scope**

Run if available:

```txt
gitnexus_detect_changes()
```

If unavailable:

```powershell
rtk git diff --stat
```

Confirm scope is limited to auth verification, request enrichment, dashboard summary, timing logs, docs, and frontend dashboard consumption.

- [ ] **Step 2: Full verification**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: all PASS.

- [ ] **Step 3: Manual API check**

With backend running:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run uvicorn app.main:app --port 8000"
```

Check in browser/app:

```txt
1. Login still works.
2. /users/me still returns the current user.
3. Dashboard loads using /dashboard/summary.
4. Request lists show creator/assignee labels without relying on /users/active for every list card.
5. Sidebar navigation remains responsive after the sidebar plan changes.
```

- [ ] **Step 4: Create performance note**

Create `docs/backend-api-performance-optimization.md`:

```md
# Backend API Performance Optimization

## Implemented

- Local Supabase JWT verification.
- Short current-user profile cache remains in place.
- Request responses include creator/assignee summaries.
- Dashboard uses `/dashboard/summary`.
- Optional backend request timing logs.

## Expected Impact

- Removes remote Supabase Auth call from every protected API request.
- Reduces dashboard API fan-out.
- Reduces frontend need for `/users/active` just to display request labels.

## Verification

- Backend tests:
- Frontend lint:
- Frontend build:

## Remaining Follow-Up

- Cursor pagination if request volume grows.
- Exact count queries if dashboard needs full totals instead of bounded visible counts.
- Supabase local dev setup if hosted latency still affects development.
```

- [ ] **Step 5: Commit docs**

Run:

```powershell
rtk git add docs/backend-api-performance-optimization.md
rtk git commit -m "docs: record backend api performance optimization"
```

---

## Acceptance Criteria

- Backend no longer calls `supabase.auth.get_user(token)` for normal protected API requests.
- Invalid/expired JWTs are still rejected with `401`.
- `/users/me` and request endpoints still load profile/role/is_active from the `users` table.
- Request responses include optional `creator` and `assignee` summaries.
- Dashboard page uses one summary endpoint instead of multiple request-list endpoints.
- Backend timing logs can be enabled with `LOG_REQUEST_TIMING=true`.
- Backend test suite passes.
- Frontend lint and build pass.

## Expected Performance Result

After this plan and the sidebar navigation plan both land:

- Clicking sidebar views should reuse cached bounded lists.
- Dashboard should make fewer API calls.
- Each protected backend request should avoid a remote Supabase Auth round-trip.
- Request labels should not require extra frontend user lookups for every list.

