# Team Request Hub MVP Phased Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Team Request Hub MVP end-to-end: Supabase-backed auth, role-aware backend workflows, request management UI, lead role management, notifications, and verification.

**Architecture:** The repo has two apps: `apps/api` for FastAPI business logic and `apps/web` for the Next.js UI. Backend architecture is `routes -> services -> repositories -> Supabase`; frontend architecture is page routes + TanStack Query hooks + `apiFetch` with Supabase Bearer JWT. Supabase Auth owns login/signup, FastAPI owns roles and workflow permissions, and the frontend never queries Supabase tables directly. Frontend workers must read `docs/frontend-ui-framework.md` before planning or coding UI work; `ui-frameware/` is visual reference only and must not be copied as static HTML.

**Tech Stack:** FastAPI, Supabase Python client, Pydantic, uv, unittest, Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5, Supabase SSR/browser clients.

---

## Current Baseline

Implemented:

- Backend is refactored into `routes`, `services`, and `repositories`.
- Request workflow service creates assignment history, status logs, and notifications.
- Role update endpoint exists: `PATCH /users/{user_id}/role`, lead-only.
- Backend tests exist under `apps/api/tests`.
- Backend local environment uses `uv` with `apps/api/.venv` and `apps/api/.uv-cache`.
- Frontend skeleton exists with auth and dashboard route groups.
- Frontend login and dashboard pages are placeholders.

Important commands:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

```bash
cd apps/web
npm run lint
npm run build
npm run dev
```

---

## Required Context For Agents

Read these files before executing any task:

```txt
AGENTS.md
docs/architecture.md
docs/api-contract.md
docs/database-schema.md
docs/permissions.md
```

For frontend tasks, also read:

```txt
apps/web/AGENTS.md
apps/web/README.md
docs/frontend-ui-framework.md
```

Frontend visual reference lives in:

```txt
ui-frameware/
```

`ui-frameware/` contains screenshots and static HTML mockups. Use it to
understand layout intent, but rebuild the UI with React components, Tailwind v4,
shadcn/ui, lucide icons, TanStack Query hooks, and `src/lib/api/client.ts`.
Do not copy Tailwind CDN setup, Material Symbols, inline scripts, external
images, hard-coded demo data, or decorative background effects into `apps/web`.

## File Map

Backend files to create or modify:

- Modify: `apps/api/app/core/auth.py` for auth behavior only if real Supabase JWT checks need adjustment.
- Modify: `apps/api/app/repositories/request_repository.py` for request table access refinements.
- Modify: `apps/api/app/repositories/user_repository.py` for user list and role update behavior.
- Modify: `apps/api/app/repositories/notification_repository.py` for notification read/list behavior.
- Modify: `apps/api/app/services/request_service.py` for workflow rule changes.
- Modify: `apps/api/app/services/users.py` for role/user rules.
- Modify: `apps/api/app/services/notifications.py` for notification messages and side effects.
- Modify: `apps/api/app/routes/users.py`, `apps/api/app/routes/requests.py`, `apps/api/app/routes/notifications.py` for route shape only.
- Modify: `apps/api/app/schemas/*.py` for request/response models.
- Add/modify: `apps/api/tests/*.py` for backend rule and route-level tests.

Frontend files to create or modify:

- Modify: `apps/web/src/app/(auth)/login/page.tsx`.
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`.
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`.
- Modify: `apps/web/src/app/(dashboard)/requests/page.tsx`.
- Modify: `apps/web/src/app/(dashboard)/requests/new/page.tsx`.
- Modify: `apps/web/src/app/(dashboard)/assigned/page.tsx`.
- Modify: `apps/web/src/app/(dashboard)/pool/page.tsx`.
- Modify: `apps/web/src/app/(dashboard)/done/page.tsx`.
- Modify: `apps/web/src/app/(dashboard)/all/page.tsx`.
- Create: `apps/web/src/app/(dashboard)/admin/users/page.tsx`.
- Create: `apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx`.
- Create: `apps/web/src/components/app/app-shell.tsx`.
- Create: `apps/web/src/components/auth/google-login-button.tsx`.
- Create: `apps/web/src/components/auth/logout-button.tsx`.
- Create: `apps/web/src/components/requests/request-list.tsx`.
- Create: `apps/web/src/components/requests/request-card.tsx`.
- Create: `apps/web/src/components/requests/request-form.tsx`.
- Create: `apps/web/src/components/requests/request-actions.tsx`.
- Create: `apps/web/src/components/requests/reassign-dialog.tsx`.
- Create: `apps/web/src/components/requests/done-dialog.tsx`.
- Create: `apps/web/src/components/notifications/notification-list.tsx`.
- Create: `apps/web/src/components/users/role-management-table.tsx`.
- Create: `apps/web/src/lib/api/requests.ts`.
- Create: `apps/web/src/lib/api/users.ts`.
- Create: `apps/web/src/lib/api/notifications.ts`.
- Create: `apps/web/src/lib/api/query-keys.ts`.
- Create: `apps/web/src/hooks/use-current-user.ts`.
- Create: `apps/web/src/hooks/use-requests.ts`.
- Create: `apps/web/src/hooks/use-request-actions.ts`.
- Create: `apps/web/src/hooks/use-users.ts`.
- Create: `apps/web/src/hooks/use-notifications.ts`.
- Modify: `apps/web/src/types/index.ts` as backend response types evolve.

Docs and config files:

- Modify: `docs/architecture.md` when architecture boundaries change.
- Modify: `docs/api-contract.md` when endpoint behavior changes.
- Modify: `docs/frontend-ui-framework.md` when frontend route, component, state, or UI framework rules change.
- Modify: `API_CONTRACT_TEAM_REQUEST_HUB.md` for external contract changes.
- Modify: `apps/api/README.md` and `apps/web/README.md` when commands change.

---

## Phase 1: Backend Stabilization

### Task 1.1: Add Route-Level Backend Tests For Role Updates

**Files:**

- Create: `apps/api/tests/test_users_routes.py`
- Modify: `apps/api/app/routes/users.py` only if the test exposes a route mismatch

- [ ] **Step 1: Write the failing route test**

Create `apps/api/tests/test_users_routes.py`:

```python
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app
from app.schemas.users import CurrentUser


class UserRoutesTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_lead_updates_user_role(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead User",
            role="lead",
        )

        with patch("app.services.users.user_repository.update_user_role") as update_role:
            update_role.return_value = {
                "id": "user-1",
                "email": "user@example.com",
                "name": "User",
                "avatar_url": None,
                "role": "be",
                "created_at": "2026-05-20T00:00:00Z",
            }

            response = TestClient(app).patch(
                "/users/user-1/role",
                json={"role": "be"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "be")
        update_role.assert_called_once_with("user-1", "be")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_users_routes
```

Expected: pass if current route is correct, fail with a concrete route/schema issue if not.

- [ ] **Step 3: Fix only the route mismatch if the test fails**

Use this target route shape in `apps/api/app/routes/users.py`:

```python
@router.patch("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return users.update_user_role(user_id, payload, current_user)
```

- [ ] **Step 4: Run all backend tests**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_users_routes.py apps/api/app/routes/users.py
git commit -m "test: cover lead role update route"
```

### Task 1.2: Add Request Workflow Integration Tests With Mocked Repositories

**Files:**

- Create: `apps/api/tests/test_request_service_workflow.py`
- Modify: `apps/api/app/services/request_service.py` only if side effects are missing

- [ ] **Step 1: Write failing service tests for side effects**

Create `apps/api/tests/test_request_service_workflow.py`:

```python
import unittest
from unittest.mock import patch

from app.schemas.requests import DoneRequest, ReassignRequest
from app.schemas.users import CurrentUser
from app.services import request_service


class RequestServiceWorkflowTests(unittest.TestCase):
    def test_reassign_active_request_records_assignment_and_status_reset(self):
        current_user = CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead",
            role="lead",
        )
        original_request = {
            "id": "request-1",
            "title": "Fix API",
            "status": "in_progress",
            "created_by": "creator-1",
            "assigned_to": "old-user",
        }
        updated_request = {
            **original_request,
            "status": "pending",
            "assigned_to": "new-user",
        }

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=original_request),
            patch("app.services.request_service.users.ensure_active_user") as ensure_active_user,
            patch("app.services.request_service.request_repository.update_request", return_value=updated_request),
            patch("app.services.request_service.assignments.record_assignment") as record_assignment,
            patch("app.services.request_service.status_logs.record_status_change") as record_status_change,
            patch("app.services.request_service.notifications.notify_reassigned") as notify_reassigned,
        ):
            result = request_service.reassign_request(
                "request-1",
                ReassignRequest(assigned_to="new-user", reason="Wrong owner"),
                current_user,
            )

        self.assertEqual(result["assigned_to"], "new-user")
        ensure_active_user.assert_called_once_with("new-user")
        record_assignment.assert_called_once()
        record_status_change.assert_called_once()
        self.assertEqual(notify_reassigned.call_count, 2)

    def test_mark_done_records_status_log_and_notifies_creator(self):
        current_user = CurrentUser(
            id="assignee-1",
            email="assignee@example.com",
            name="Assignee",
            role="be",
        )
        original_request = {
            "id": "request-1",
            "title": "Fix API",
            "status": "in_progress",
            "created_by": "creator-1",
            "assigned_to": "assignee-1",
        }
        updated_request = {
            **original_request,
            "status": "done",
            "reply": "Fixed endpoint response.",
        }

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=original_request),
            patch("app.services.request_service.request_repository.update_request", return_value=updated_request),
            patch("app.services.request_service.status_logs.record_status_change") as record_status_change,
            patch("app.services.request_service.notifications.notify_done") as notify_done,
        ):
            result = request_service.mark_done(
                "request-1",
                DoneRequest(reply="Fixed endpoint response."),
                current_user,
            )

        self.assertEqual(result["status"], "done")
        record_status_change.assert_called_once()
        notify_done.assert_called_once_with("creator-1", updated_request)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow
```

Expected: pass if side effects are already wired; fail on the missing side effect.

- [ ] **Step 3: Fix missing side effects only**

Use the existing service helpers:

```python
assignments.record_assignment(...)
status_logs.record_status_change(...)
notifications.notify_reassigned(...)
notifications.notify_done(...)
```

- [ ] **Step 4: Run all backend tests**

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/tests/test_request_service_workflow.py apps/api/app/services/request_service.py
git commit -m "test: cover request workflow side effects"
```

### Task 1.3: Verify Backend Against OpenAPI Import

**Files:**

- Modify only files required by failures from this task

- [ ] **Step 1: Run backend import check**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "import os; os.environ['SUPABASE_URL']='http://localhost'; os.environ['SUPABASE_ANON_KEY']='anon'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='service'; os.environ['SUPABASE_JWT_SECRET']='secret'; import app.main; print('import ok')"
```

Expected:

```txt
import ok
```

- [ ] **Step 2: Run compile check**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m compileall app tests
```

Expected: command exits with code 0.

- [ ] **Step 3: Commit fixes if any were required**

```bash
git add apps/api/app apps/api/tests
git commit -m "fix: stabilize backend imports"
```

Skip the commit if no files changed.

---

## Phase 2: Auth UI

### Task 2.1: Implement Google Login Button

**Files:**

- Create: `apps/web/src/components/auth/google-login-button.tsx`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Create the client login component**

Create `apps/web/src/components/auth/google-login-button.tsx`:

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    setIsLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/dashboard`,
      },
    });

    if (error) {
      setIsLoading(false);
      throw error;
    }
  }

  return (
    <Button type="button" className="w-full" onClick={handleLogin} disabled={isLoading}>
      {isLoading ? "Redirecting..." : "Continue with Google"}
    </Button>
  );
}
```

- [ ] **Step 2: Render the login component**

Modify `apps/web/src/app/(auth)/login/page.tsx`:

```tsx
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border p-6">
        <h1 className="text-2xl font-semibold">Team Request Hub</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your team Google account.
        </p>
        <div className="mt-6">
          <GoogleLoginButton />
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run frontend checks**

Run:

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/google-login-button.tsx apps/web/src/app/\(auth\)/login/page.tsx
git commit -m "feat: add Google login UI"
```

### Task 2.2: Implement Current User Hook And Logout

**Files:**

- Create: `apps/web/src/lib/api/users.ts`
- Create: `apps/web/src/hooks/use-current-user.ts`
- Create: `apps/web/src/components/auth/logout-button.tsx`

- [ ] **Step 1: Add users API client**

Create `apps/web/src/lib/api/users.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { Role, User } from "@/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
  role: Role;
}

export interface UserRoleUpdate {
  role: Role;
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/users/me");
}

export function listUsers() {
  return apiFetch<User[]>("/users");
}

export function updateUserRole(userId: string, payload: UserRoleUpdate) {
  return apiFetch<User>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Add current user hook**

Create `apps/web/src/hooks/use-current-user.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/api/users";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
  });
}
```

- [ ] **Step 3: Add logout button**

Create `apps/web/src/components/auth/logout-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
```

- [ ] **Step 4: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api/users.ts apps/web/src/hooks/use-current-user.ts apps/web/src/components/auth/logout-button.tsx
git commit -m "feat: add current user and logout helpers"
```

---

## Phase 3: Frontend App Shell And Data Layer

### Task 3.1: Add Query Keys And Request API Client

**Files:**

- Create: `apps/web/src/lib/api/query-keys.ts`
- Create: `apps/web/src/lib/api/requests.ts`

- [ ] **Step 1: Add query keys**

Create `apps/web/src/lib/api/query-keys.ts`:

```ts
import type { RequestView } from "@/lib/api/requests";

export const queryKeys = {
  currentUser: ["current-user"] as const,
  users: ["users"] as const,
  requests: (view: RequestView) => ["requests", view] as const,
  request: (id: string) => ["request", id] as const,
  notifications: ["notifications"] as const,
};
```

- [ ] **Step 2: Add request API functions**

Create `apps/web/src/lib/api/requests.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { InternalRequest, RequestPriority, RequestStatus } from "@/types";

export type RequestView = "assigned" | "created" | "pool" | "done" | "all";

export interface InternalRequestCreatePayload {
  title: string;
  description: string;
  tags: string[];
  priority: RequestPriority;
  assigned_to?: string | null;
  reference_links: string[];
}

export interface ReassignPayload {
  assigned_to: string;
  reason?: string | null;
}

export interface StatusPayload {
  status: RequestStatus;
  reason?: string | null;
}

export interface DonePayload {
  reply: string;
}

export interface CancelPayload {
  reason?: string | null;
}

export function listRequests(view: RequestView) {
  return apiFetch<InternalRequest[]>(`/requests?view=${view}`);
}

export function getRequest(requestId: string) {
  return apiFetch<InternalRequest>(`/requests/${requestId}`);
}

export function createRequest(payload: InternalRequestCreatePayload) {
  return apiFetch<InternalRequest>("/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function selfAssignRequest(requestId: string) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/self-assign`, {
    method: "POST",
  });
}

export function reassignRequest(requestId: string, payload: ReassignPayload) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/reassign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRequestStatus(requestId: string, payload: StatusPayload) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markRequestDone(requestId: string, payload: DonePayload) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/done`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelRequest(requestId: string, payload: CancelPayload) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api/query-keys.ts apps/web/src/lib/api/requests.ts
git commit -m "feat: add request api client"
```

### Task 3.2: Add Request Query And Mutation Hooks

**Files:**

- Create: `apps/web/src/hooks/use-requests.ts`
- Create: `apps/web/src/hooks/use-request-actions.ts`

- [ ] **Step 1: Add request list hook**

Create `apps/web/src/hooks/use-requests.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { listRequests, type RequestView } from "@/lib/api/requests";
import { queryKeys } from "@/lib/api/query-keys";

export function useRequests(view: RequestView) {
  return useQuery({
    queryKey: queryKeys.requests(view),
    queryFn: () => listRequests(view),
  });
}
```

- [ ] **Step 2: Add request action hook**

Create `apps/web/src/hooks/use-request-actions.ts`:

```ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelRequest,
  createRequest,
  markRequestDone,
  reassignRequest,
  selfAssignRequest,
  updateRequestStatus,
  type CancelPayload,
  type DonePayload,
  type InternalRequestCreatePayload,
  type ReassignPayload,
  type StatusPayload,
} from "@/lib/api/requests";

export function useRequestActions() {
  const queryClient = useQueryClient();

  function invalidateRequests() {
    void queryClient.invalidateQueries({ queryKey: ["requests"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  return {
    create: useMutation({
      mutationFn: (payload: InternalRequestCreatePayload) => createRequest(payload),
      onSuccess: invalidateRequests,
    }),
    selfAssign: useMutation({
      mutationFn: (requestId: string) => selfAssignRequest(requestId),
      onSuccess: invalidateRequests,
    }),
    reassign: useMutation({
      mutationFn: ({ requestId, payload }: { requestId: string; payload: ReassignPayload }) =>
        reassignRequest(requestId, payload),
      onSuccess: invalidateRequests,
    }),
    updateStatus: useMutation({
      mutationFn: ({ requestId, payload }: { requestId: string; payload: StatusPayload }) =>
        updateRequestStatus(requestId, payload),
      onSuccess: invalidateRequests,
    }),
    markDone: useMutation({
      mutationFn: ({ requestId, payload }: { requestId: string; payload: DonePayload }) =>
        markRequestDone(requestId, payload),
      onSuccess: invalidateRequests,
    }),
    cancel: useMutation({
      mutationFn: ({ requestId, payload }: { requestId: string; payload: CancelPayload }) =>
        cancelRequest(requestId, payload),
      onSuccess: invalidateRequests,
    }),
  };
}
```

- [ ] **Step 3: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-requests.ts apps/web/src/hooks/use-request-actions.ts
git commit -m "feat: add request hooks"
```

### Task 3.3: Build Dashboard App Shell

**Files:**

- Create: `apps/web/src/components/app/app-shell.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add app shell**

Create `apps/web/src/components/app/app-shell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

const baseNavItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assigned", label: "Assigned" },
  { href: "/requests", label: "Created" },
  { href: "/pool", label: "Pool" },
  { href: "/done", label: "Done" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: currentUser } = useCurrentUser();
  const navItems =
    currentUser?.role === "lead"
      ? [...baseNavItems, { href: "/all", label: "All" }, { href: "/admin/users", label: "Users" }]
      : baseNavItems;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="font-semibold">
            Team Request Hub
          </Link>
          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="text-sm text-muted-foreground">
                {currentUser.name ?? currentUser.email ?? "User"} · {currentUser.role}
              </span>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-6 md:grid-cols-[180px_1fr]">
        <nav className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm text-muted-foreground",
                pathname === item.href && "bg-muted text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use app shell in dashboard layout**

Modify `apps/web/src/app/(dashboard)/layout.tsx`:

```tsx
import { AppShell } from "@/components/app/app-shell";

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 3: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/app/app-shell.tsx apps/web/src/app/\(dashboard\)/layout.tsx
git commit -m "feat: add dashboard app shell"
```

---

## Phase 4: Request List And Create UI

### Task 4.1: Build Reusable Request List

**Files:**

- Create: `apps/web/src/components/requests/request-card.tsx`
- Create: `apps/web/src/components/requests/request-list.tsx`

- [ ] **Step 1: Add request card**

Create `apps/web/src/components/requests/request-card.tsx`:

```tsx
import type { InternalRequest } from "@/types";

export function RequestCard({ request }: { request: InternalRequest }) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{request.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {request.description}
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs">{request.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Priority: {request.priority}</span>
        {request.tags.map((tag) => (
          <span key={tag} className="rounded bg-muted px-2 py-1">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Add request list**

Create `apps/web/src/components/requests/request-list.tsx`:

```tsx
"use client";

import { RequestCard } from "@/components/requests/request-card";
import { useRequests } from "@/hooks/use-requests";
import type { RequestView } from "@/lib/api/requests";

export function RequestList({ view }: { view: RequestView }) {
  const { data, isLoading, error } = useRequests(view);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading requests...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Could not load requests.</p>;
  }

  if (!data?.length) {
    return <p className="text-sm text-muted-foreground">No requests found.</p>;
  }

  return (
    <div className="grid gap-3">
      {data.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/requests/request-card.tsx apps/web/src/components/requests/request-list.tsx
git commit -m "feat: add request list components"
```

### Task 4.2: Wire List Pages To API Views

**Files:**

- Modify: `apps/web/src/app/(dashboard)/assigned/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/pool/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/done/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/all/page.tsx`

- [ ] **Step 1: Replace assigned page**

Use this in `apps/web/src/app/(dashboard)/assigned/page.tsx`:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function AssignedPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Assigned to me</h1>
      <div className="mt-4">
        <RequestList view="assigned" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace created requests page**

Use this in `apps/web/src/app/(dashboard)/requests/page.tsx`:

```tsx
import Link from "next/link";
import { RequestList } from "@/components/requests/request-list";
import { Button } from "@/components/ui/button";

export default function RequestsPage() {
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Created by me</h1>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </div>
      <div className="mt-4">
        <RequestList view="created" />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace pool page**

Use this in `apps/web/src/app/(dashboard)/pool/page.tsx`:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function PoolPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Pool</h1>
      <div className="mt-4">
        <RequestList view="pool" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace done page**

Use this in `apps/web/src/app/(dashboard)/done/page.tsx`:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function DonePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Done</h1>
      <div className="mt-4">
        <RequestList view="done" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Replace all page**

Use this in `apps/web/src/app/(dashboard)/all/page.tsx`:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function AllRequestsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">All requests</h1>
      <div className="mt-4">
        <RequestList view="all" />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/\(dashboard\)
git commit -m "feat: wire request list pages"
```

### Task 4.3: Add Create Request Form

**Files:**

- Create: `apps/web/src/components/requests/request-form.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/new/page.tsx`

- [ ] **Step 1: Add request form**

Create `apps/web/src/components/requests/request-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/use-request-actions";
import type { RequestPriority } from "@/types";

const priorities: RequestPriority[] = ["low", "medium", "high", "urgent"];

export function RequestForm() {
  const router = useRouter();
  const actions = useRequestActions();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("medium");
  const [tags, setTags] = useState("");
  const [referenceLinks, setReferenceLinks] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await actions.create.mutateAsync({
      title,
      description,
      priority,
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      reference_links: referenceLinks.split("\n").map((link) => link.trim()).filter(Boolean),
      assigned_to: null,
    });
    router.push("/requests");
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-2xl gap-4">
      <label className="grid gap-2 text-sm">
        Title
        <input
          className="rounded-md border bg-background px-3 py-2"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={160}
        />
      </label>
      <label className="grid gap-2 text-sm">
        Description
        <textarea
          className="min-h-32 rounded-md border bg-background px-3 py-2"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-2 text-sm">
        Priority
        <select
          className="rounded-md border bg-background px-3 py-2"
          value={priority}
          onChange={(event) => setPriority(event.target.value as RequestPriority)}
        >
          {priorities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm">
        Tags
        <input
          className="rounded-md border bg-background px-3 py-2"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="api, backend, urgent"
        />
      </label>
      <label className="grid gap-2 text-sm">
        Reference links
        <textarea
          className="min-h-20 rounded-md border bg-background px-3 py-2"
          value={referenceLinks}
          onChange={(event) => setReferenceLinks(event.target.value)}
          placeholder="One URL per line"
        />
      </label>
      <Button type="submit" disabled={actions.create.isPending}>
        {actions.create.isPending ? "Creating..." : "Create request"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Use form on new request page**

Modify `apps/web/src/app/(dashboard)/requests/new/page.tsx`:

```tsx
import { RequestForm } from "@/components/requests/request-form";

export default function NewRequestPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Create request</h1>
      <div className="mt-4">
        <RequestForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/requests/request-form.tsx apps/web/src/app/\(dashboard\)/requests/new/page.tsx
git commit -m "feat: add request creation form"
```

---

## Phase 5: Request Actions

### Task 5.1: Add Basic Request Action Buttons

**Files:**

- Create: `apps/web/src/components/requests/request-actions.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`

- [ ] **Step 1: Add request actions component**

Create `apps/web/src/components/requests/request-actions.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRequestActions } from "@/hooks/use-request-actions";
import type { InternalRequest } from "@/types";

export function RequestActions({ request }: { request: InternalRequest }) {
  const { data: currentUser } = useCurrentUser();
  const actions = useRequestActions();
  const isLead = currentUser?.role === "lead";
  const isCreator = currentUser?.id === request.created_by;
  const isAssignee = currentUser?.id === request.assigned_to;
  const isClosed = request.status === "done" || request.status === "cancelled";

  if (!currentUser || isClosed) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {!request.assigned_to && request.status === "pending" && (
        <Button size="sm" onClick={() => actions.selfAssign.mutate(request.id)}>
          Self assign
        </Button>
      )}
      {(isAssignee || isLead) && request.status === "pending" && request.assigned_to && (
        <Button
          size="sm"
          onClick={() =>
            actions.updateStatus.mutate({
              requestId: request.id,
              payload: { status: "acknowledged" },
            })
          }
        >
          Acknowledge
        </Button>
      )}
      {(isAssignee || isLead) && request.status === "acknowledged" && (
        <Button
          size="sm"
          onClick={() =>
            actions.updateStatus.mutate({
              requestId: request.id,
              payload: { status: "in_progress" },
            })
          }
        >
          Start
        </Button>
      )}
      {(isCreator || isLead) && (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            actions.cancel.mutate({
              requestId: request.id,
              payload: { reason: "Cancelled from request list" },
            })
          }
        >
          Cancel
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render actions inside request card**

Modify `apps/web/src/components/requests/request-card.tsx`:

```tsx
import { RequestActions } from "@/components/requests/request-actions";
import type { InternalRequest } from "@/types";

export function RequestCard({ request }: { request: InternalRequest }) {
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-medium">{request.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {request.description}
          </p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs">{request.status}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Priority: {request.priority}</span>
        {request.tags.map((tag) => (
          <span key={tag} className="rounded bg-muted px-2 py-1">
            {tag}
          </span>
        ))}
      </div>
      <RequestActions request={request} />
    </article>
  );
}
```

- [ ] **Step 3: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/requests/request-actions.tsx apps/web/src/components/requests/request-card.tsx
git commit -m "feat: add request action buttons"
```

### Task 5.2: Add Done Action With Reply

**Files:**

- Create: `apps/web/src/components/requests/done-dialog.tsx`
- Modify: `apps/web/src/components/requests/request-actions.tsx`

- [ ] **Step 1: Add done dialog**

Create `apps/web/src/components/requests/done-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/use-request-actions";

export function DoneDialog({ requestId }: { requestId: string }) {
  const actions = useRequestActions();
  const [isOpen, setIsOpen] = useState(false);
  const [reply, setReply] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await actions.markDone.mutateAsync({ requestId, payload: { reply } });
    setReply("");
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <Button size="sm" onClick={() => setIsOpen(true)}>
        Mark done
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 grid gap-2">
      <textarea
        className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
        value={reply}
        onChange={(event) => setReply(event.target.value)}
        placeholder="Describe what changed"
        required
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={actions.markDone.isPending}>
          Submit reply
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Use done dialog in request actions**

Add this import in `apps/web/src/components/requests/request-actions.tsx`:

```tsx
import { DoneDialog } from "@/components/requests/done-dialog";
```

Add this action before the cancel button:

```tsx
{(isAssignee || isLead) && request.status === "in_progress" && (
  <DoneDialog requestId={request.id} />
)}
```

- [ ] **Step 3: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/requests/done-dialog.tsx apps/web/src/components/requests/request-actions.tsx
git commit -m "feat: add done reply action"
```

---

## Phase 6: Lead Admin And Notifications

### Task 6.1: Add Users Hook And Role Management Table

**Files:**

- Create: `apps/web/src/hooks/use-users.ts`
- Create: `apps/web/src/components/users/role-management-table.tsx`
- Create: `apps/web/src/app/(dashboard)/admin/users/page.tsx`

- [ ] **Step 1: Add users hook**

Create `apps/web/src/hooks/use-users.ts`:

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listUsers, updateUserRole } from "@/lib/api/users";
import { queryKeys } from "@/lib/api/query-keys";
import type { Role } from "@/types";

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: listUsers,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      updateUserRole(userId, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
}
```

- [ ] **Step 2: Add role management table**

Create `apps/web/src/components/users/role-management-table.tsx`:

```tsx
"use client";

import { useUpdateUserRole, useUsers } from "@/hooks/use-users";
import type { Role } from "@/types";

const roles: Role[] = ["fe", "be", "lead"];

export function RoleManagementTable() {
  const { data, isLoading, error } = useUsers();
  const updateRole = useUpdateUserRole();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading users...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Could not load users.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Email</th>
            <th className="px-3 py-2">Role</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((user) => (
            <tr key={user.id} className="border-t">
              <td className="px-3 py-2">{user.name ?? "Unnamed"}</td>
              <td className="px-3 py-2">{user.email}</td>
              <td className="px-3 py-2">
                <select
                  className="rounded-md border bg-background px-2 py-1"
                  value={user.role}
                  onChange={(event) =>
                    updateRole.mutate({ userId: user.id, role: event.target.value as Role })
                  }
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Add admin users page**

Create `apps/web/src/app/(dashboard)/admin/users/page.tsx`:

```tsx
import { RoleManagementTable } from "@/components/users/role-management-table";

export default function AdminUsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="mt-4">
        <RoleManagementTable />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-users.ts apps/web/src/components/users/role-management-table.tsx apps/web/src/app/\(dashboard\)/admin/users/page.tsx
git commit -m "feat: add lead user role management"
```

### Task 6.2: Add Notifications Client And List

**Files:**

- Create: `apps/web/src/lib/api/notifications.ts`
- Create: `apps/web/src/hooks/use-notifications.ts`
- Create: `apps/web/src/components/notifications/notification-list.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add notifications API client**

Create `apps/web/src/lib/api/notifications.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { Notification } from "@/types";

export function listNotifications(unreadOnly = false) {
  return apiFetch<Notification[]>(`/notifications?unread_only=${unreadOnly}`);
}

export function markNotificationRead(notificationId: string) {
  return apiFetch<Notification>(`/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>("/notifications/read-all", {
    method: "POST",
  });
}
```

- [ ] **Step 2: Add notification hook**

Create `apps/web/src/hooks/use-notifications.ts`:

```ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { queryKeys } from "@/lib/api/query-keys";

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => listNotifications(false),
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }

  return {
    markRead: useMutation({
      mutationFn: markNotificationRead,
      onSuccess: invalidate,
    }),
    markAllRead: useMutation({
      mutationFn: markAllNotificationsRead,
      onSuccess: invalidate,
    }),
  };
}
```

- [ ] **Step 3: Add notification list component**

Create `apps/web/src/components/notifications/notification-list.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useNotificationActions, useNotifications } from "@/hooks/use-notifications";

export function NotificationList() {
  const { data, isLoading, error } = useNotifications();
  const actions = useNotificationActions();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading notifications...</p>;
  }

  if (error) {
    return <p className="text-sm text-destructive">Could not load notifications.</p>;
  }

  if (!data?.length) {
    return <p className="text-sm text-muted-foreground">No notifications.</p>;
  }

  return (
    <div className="grid gap-3">
      <div>
        <Button size="sm" variant="outline" onClick={() => actions.markAllRead.mutate()}>
          Mark all read
        </Button>
      </div>
      {data.map((notification) => (
        <div key={notification.id} className="rounded-lg border p-3">
          <p className="text-sm">{notification.message}</p>
          {!notification.is_read && (
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              onClick={() => actions.markRead.mutate(notification.id)}
            >
              Mark read
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Render notifications on dashboard**

Modify `apps/web/src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { NotificationList } from "@/components/notifications/notification-list";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <section className="mt-6">
        <h2 className="text-lg font-medium">Notifications</h2>
        <div className="mt-3">
          <NotificationList />
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Run frontend checks**

```bash
cd apps/web
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/api/notifications.ts apps/web/src/hooks/use-notifications.ts apps/web/src/components/notifications/notification-list.tsx apps/web/src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add notification list"
```

---

## Phase 7: Full Verification

### Task 7.1: Run Backend Verification

**Files:**

- Modify files only if checks fail

- [ ] **Step 1: Run backend unit tests**

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected:

```txt
OK
```

- [ ] **Step 2: Run backend compile check**

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m compileall app tests
```

Expected: command exits with code 0.

- [ ] **Step 3: Run backend import check**

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "import os; os.environ['SUPABASE_URL']='http://localhost'; os.environ['SUPABASE_ANON_KEY']='anon'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='service'; os.environ['SUPABASE_JWT_SECRET']='secret'; import app.main; print('import ok')"
```

Expected:

```txt
import ok
```

### Task 7.2: Run Frontend Verification

**Files:**

- Modify files only if checks fail

- [ ] **Step 1: Run lint**

```bash
cd apps/web
npm run lint
```

Expected: command exits with code 0.

- [ ] **Step 2: Run build**

```bash
cd apps/web
npm run build
```

Expected: command exits with code 0.

### Task 7.3: Manual End-To-End Smoke Test

**Files:**

- Modify files only if the smoke test exposes a real bug

- [ ] **Step 1: Apply Supabase schema**

Apply `DB_SCHEMA_TEAM_REQUEST_HUB.sql` in Supabase SQL editor.

Expected tables:

```txt
public.users
public.internal_requests
public.assignment_history
public.request_status_logs
public.notifications
```

- [ ] **Step 2: Start backend**

```bash
cd apps/api
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

Expected:

```txt
Uvicorn running on http://127.0.0.1:8000
```

- [ ] **Step 3: Start frontend**

```bash
cd apps/web
npm run dev
```

Expected:

```txt
Local: http://localhost:3000
```

- [ ] **Step 4: Test user flow**

In browser:

```txt
1. Open http://localhost:3000
2. Confirm redirect to /login when unauthenticated
3. Sign in with Google
4. Confirm redirect to /dashboard
5. Create request
6. Confirm request appears in Created by me
7. Open Pool from another user or unassigned request
8. Self-assign request
9. Acknowledge request
10. Start request
11. Mark done with reply
12. Confirm notification appears for creator
13. As lead, update another user's role from Users page
```

Expected: each action completes without 4xx/5xx errors except intentional permission failures for non-lead role update.

### Task 7.4: Update Documentation After Implementation

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/api-contract.md`
- Modify: `apps/api/SETUP_BE_TEAM_REQUEST_HUB.md`
- Modify: `apps/web/README.md`
- Modify: `README.md`

- [ ] **Step 1: Update implementation status**

Add a "Current State" section to `docs/architecture.md` with:

```md
## Current State

- Google OAuth login is implemented in the frontend.
- Request list, create, status, done, cancel, and self-assign flows are implemented.
- Lead role management is implemented.
- Notifications list and read actions are implemented.
```

- [ ] **Step 2: Update contract if route behavior changed**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "import os; os.environ['SUPABASE_URL']='http://localhost'; os.environ['SUPABASE_ANON_KEY']='anon'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='service'; os.environ['SUPABASE_JWT_SECRET']='secret'; from app.main import app; print(sorted([route.path for route in app.routes if hasattr(route, 'path')]))"
```

Compare the printed routes with `docs/api-contract.md` and `API_CONTRACT_TEAM_REQUEST_HUB.md`.

- [ ] **Step 3: Run final checks**

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

```bash
cd apps/web
npm run lint
npm run build
```

Expected: all commands pass.

- [ ] **Step 4: Commit docs**

```bash
git add docs README.md apps/api/SETUP_BE_TEAM_REQUEST_HUB.md apps/web/README.md API_CONTRACT_TEAM_REQUEST_HUB.md
git commit -m "docs: update mvp implementation status"
```

---

## Execution Notes

- Do not implement FE business logic outside backend contracts.
- Do not create `apps/web/src/app/api`.
- Do not query Supabase tables directly from frontend code.
- Keep backend services as the only workflow decision layer.
- Keep commits small by task.
- After each frontend task, run `npm run lint` and `npm run build`.
- After each backend task, run `uv --cache-dir .uv-cache run python -m unittest discover tests`.

## Self-Review

Spec coverage:

- Auth is covered by Phase 2.
- Backend stabilization is covered by Phase 1.
- Request data and UI are covered by Phases 3, 4, and 5.
- Lead role management is covered by Phase 6.
- Notifications are covered by Phase 6.
- Final verification and docs are covered by Phase 7.

Placeholder scan:

- This plan intentionally avoids placeholder tasks. Each implementation task names concrete files, code, commands, and expected results.

Type consistency:

- Frontend API functions use existing backend route names.
- Frontend types use existing `Role`, `RequestStatus`, `RequestPriority`, `InternalRequest`, and `Notification` names from `apps/web/src/types/index.ts`.
