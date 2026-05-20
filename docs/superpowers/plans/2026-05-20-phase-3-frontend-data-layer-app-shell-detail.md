# Phase 3 Frontend Data Layer And App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the frontend request data layer, reusable query/mutation hooks, and a role-aware authenticated app shell without building request list/create/action UI yet.

**Architecture:** Pages stay thin under `src/app`; API modules call FastAPI through `apiFetch`; hooks own TanStack Query usage; shared shell components live under `src/components/app`. Supabase remains frontend-auth only, and all product data comes from the FastAPI backend with a Bearer Supabase JWT.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, TanStack Query v5, Supabase SSR/browser clients, FastAPI backend.

---

## Required Context

Read these before coding:

```txt
AGENTS.md
apps/web/AGENTS.md
apps/web/README.md
docs/architecture.md
docs/api-contract.md
docs/frontend-ui-framework.md
docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

Use `ui-frameware/` only as visual reference. Do not copy static HTML, CDN setup,
Material Symbols, external images, hard-coded demo data, or decorative effects.

## Phase Scope

In scope:

```txt
- Add request API client functions matching docs/api-contract.md.
- Add central TanStack Query keys.
- Add request query hooks.
- Add request mutation hooks with query invalidation.
- Update current-user hook to use central query keys.
- Add authenticated app shell with role-aware navigation, current user display, and logout.
- Keep existing placeholder pages as page content.
- Verify frontend lint and build pass.
```

Out of scope:

```txt
- Backend changes.
- Request card/list UI.
- Request create form.
- Request detail page.
- Request action buttons in the UI.
- Notification list UI.
- Admin role-management table.
- Browser OAuth smoke test unless explicitly requested after implementation.
```

Known current state:

```txt
- Phase 2 files exist: GoogleLoginButton, LogoutButton, users API client, useCurrentUser.
- apps/web/src/app/(dashboard)/layout.tsx is minimal and does not yet use AppShell.
- Dashboard pages are placeholders.
- Backend endpoints exist for /requests, request actions, assignment history, and status logs.
- apps/web npm run lint and npm run build passed after removing next/font/google.
```

Risks:

```txt
- Query hooks require an active Supabase session at runtime because apiFetch throws Unauthorized without a session.
- AppShell will call /users/me on protected pages; if the user profile trigger has not run, backend may return auth/profile errors.
- Do not overbuild request list UI in this phase. Placeholders can remain inside the new shell.
```

---

## Files

Create:

```txt
apps/web/src/lib/api/query-keys.ts
apps/web/src/lib/api/requests.ts
apps/web/src/hooks/use-requests.ts
apps/web/src/hooks/use-request-actions.ts
apps/web/src/components/app/app-shell.tsx
```

Modify:

```txt
apps/web/src/hooks/use-current-user.ts
apps/web/src/app/(dashboard)/layout.tsx
```

Do not modify:

```txt
apps/api/*
apps/web/src/app/(dashboard)/*/page.tsx except if needed to remove shell-conflicting wrapper styles
apps/web/src/app/(auth)/*
DB_SCHEMA_TEAM_REQUEST_HUB.sql
```

---

## Task 1: Add Query Keys And Request API Client

**Files:**

- Create: `apps/web/src/lib/api/query-keys.ts`
- Create: `apps/web/src/lib/api/requests.ts`
- Modify: `apps/web/src/hooks/use-current-user.ts`

- [ ] **Step 1: Create central query keys**

Create `apps/web/src/lib/api/query-keys.ts`:

```ts
import type { RequestView } from "@/lib/api/requests";

export const queryKeys = {
  currentUser: ["current-user"] as const,
  users: ["users"] as const,
  requests: {
    all: ["requests"] as const,
    list: (view: RequestView) => ["requests", view] as const,
    detail: (requestId: string) => ["requests", "detail", requestId] as const,
    assignmentHistory: (requestId: string) =>
      ["requests", "assignment-history", requestId] as const,
    statusLogs: (requestId: string) =>
      ["requests", "status-logs", requestId] as const,
  },
  notifications: ["notifications"] as const,
};
```

- [ ] **Step 2: Create request API client**

Create `apps/web/src/lib/api/requests.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type {
  AssignmentHistory,
  InternalRequest,
  RequestPriority,
  RequestStatus,
  RequestStatusLog,
} from "@/types";

export type RequestView = "assigned" | "created" | "pool" | "done" | "all";

export interface InternalRequestCreatePayload {
  title: string;
  description: string;
  tags: string[];
  priority: RequestPriority;
  assigned_to?: string | null;
  reference_links: string[];
}

export interface InternalRequestUpdatePayload {
  title?: string;
  description?: string;
  tags?: string[];
  priority?: RequestPriority;
  reference_links?: string[];
}

export interface ReassignRequestPayload {
  assigned_to: string;
  reason?: string | null;
}

export interface StatusUpdatePayload {
  status: Exclude<RequestStatus, "done" | "cancelled">;
  reason?: string | null;
}

export interface DoneRequestPayload {
  reply: string;
}

export interface CancelRequestPayload {
  reason?: string | null;
}

export function listRequests(view: RequestView) {
  const searchParams = new URLSearchParams({ view });
  return apiFetch<InternalRequest[]>(`/requests?${searchParams.toString()}`);
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

export function updateRequest(
  requestId: string,
  payload: InternalRequestUpdatePayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function selfAssignRequest(requestId: string) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/self-assign`, {
    method: "POST",
  });
}

export function reassignRequest(
  requestId: string,
  payload: ReassignRequestPayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/reassign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRequestStatus(
  requestId: string,
  payload: StatusUpdatePayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markRequestDone(
  requestId: string,
  payload: DoneRequestPayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/done`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelRequest(
  requestId: string,
  payload: CancelRequestPayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAssignmentHistory(requestId: string) {
  return apiFetch<AssignmentHistory[]>(
    `/requests/${requestId}/assignment-history`,
  );
}

export function getStatusLogs(requestId: string) {
  return apiFetch<RequestStatusLog[]>(`/requests/${requestId}/status-logs`);
}
```

- [ ] **Step 3: Update current-user hook to use query keys**

Modify `apps/web/src/hooks/use-current-user.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/api/users";
import { queryKeys } from "@/lib/api/query-keys";

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
    retry: false,
  });
}
```

- [ ] **Step 4: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

---

## Task 2: Add Request Query And Mutation Hooks

**Files:**

- Create: `apps/web/src/hooks/use-requests.ts`
- Create: `apps/web/src/hooks/use-request-actions.ts`

- [ ] **Step 1: Create request query hooks**

Create `apps/web/src/hooks/use-requests.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAssignmentHistory,
  getRequest,
  getStatusLogs,
  listRequests,
  type RequestView,
} from "@/lib/api/requests";
import { queryKeys } from "@/lib/api/query-keys";

export function useRequests(view: RequestView) {
  return useQuery({
    queryKey: queryKeys.requests.list(view),
    queryFn: () => listRequests(view),
  });
}

export function useRequest(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.detail(requestId),
    queryFn: () => getRequest(requestId),
    enabled: requestId.length > 0,
  });
}

export function useRequestAssignmentHistory(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.assignmentHistory(requestId),
    queryFn: () => getAssignmentHistory(requestId),
    enabled: requestId.length > 0,
  });
}

export function useRequestStatusLogs(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.statusLogs(requestId),
    queryFn: () => getStatusLogs(requestId),
    enabled: requestId.length > 0,
  });
}
```

- [ ] **Step 2: Create request mutation hooks**

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
  updateRequest,
  updateRequestStatus,
  type CancelRequestPayload,
  type DoneRequestPayload,
  type InternalRequestCreatePayload,
  type InternalRequestUpdatePayload,
  type ReassignRequestPayload,
  type StatusUpdatePayload,
} from "@/lib/api/requests";
import { queryKeys } from "@/lib/api/query-keys";

export function useRequestActions() {
  const queryClient = useQueryClient();

  function invalidateRequestData(requestId?: string) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

    if (requestId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(requestId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requests.assignmentHistory(requestId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requests.statusLogs(requestId),
      });
    }
  }

  return {
    create: useMutation({
      mutationFn: (payload: InternalRequestCreatePayload) =>
        createRequest(payload),
      onSuccess: () => invalidateRequestData(),
    }),
    update: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: InternalRequestUpdatePayload;
      }) => updateRequest(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    selfAssign: useMutation({
      mutationFn: (requestId: string) => selfAssignRequest(requestId),
      onSuccess: (_, requestId) => invalidateRequestData(requestId),
    }),
    reassign: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: ReassignRequestPayload;
      }) => reassignRequest(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    updateStatus: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: StatusUpdatePayload;
      }) => updateRequestStatus(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    markDone: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: DoneRequestPayload;
      }) => markRequestDone(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    cancel: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: CancelRequestPayload;
      }) => cancelRequest(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
  };
}
```

- [ ] **Step 3: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

---

## Task 3: Build Role-Aware Dashboard App Shell

**Files:**

- Create: `apps/web/src/components/app/app-shell.tsx`
- Modify: `apps/web/src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create app shell component**

Create `apps/web/src/components/app/app-shell.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  href: string;
  label: string;
  roles?: Role[];
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assigned", label: "Assigned to me", roles: ["be", "lead"] },
  { href: "/requests", label: "Created by me" },
  { href: "/pool", label: "Pool", roles: ["be", "lead"] },
  { href: "/done", label: "Done" },
  { href: "/all", label: "All requests", roles: ["lead"] },
  { href: "/admin/users", label: "Users", roles: ["lead"] },
];

function canSeeNavItem(item: NavItem, role?: Role) {
  return !item.roles || (role ? item.roles.includes(role) : false);
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: currentUser, isLoading, isError, error } = useCurrentUser();
  const visibleNavItems = navItems.filter((item) =>
    canSeeNavItem(item, currentUser?.role),
  );

  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#111827]">
      <header className="border-b border-[#e5e7eb] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/dashboard" className="font-semibold">
            Team Request Hub
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">
                {isLoading
                  ? "Loading user"
                  : currentUser?.name ?? currentUser?.email ?? "User"}
              </p>
              <p className="text-xs text-[#6b7280]">
                {currentUser?.role ? `Role: ${currentUser.role}` : "Session"}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <nav className="flex gap-2 overflow-x-auto rounded-lg border border-[#e5e7eb] bg-white p-2 lg:flex-col lg:overflow-visible">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-md px-3 py-2 text-sm text-[#4b5563]",
                  isActivePath(pathname, item.href) &&
                    "bg-[#f3f4f6] font-medium text-[#111827]",
                )}
              >
                {item.label}
              </Link>
            ))}
            <Button asChild className="mt-0 lg:mt-2">
              <Link href="/requests/new">New request</Link>
            </Button>
          </nav>
        </aside>

        <section className="min-w-0">
          {isError ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error instanceof Error
                ? error.message
                : "Unable to load the current user."}
            </div>
          ) : null}
          {children}
        </section>
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

- [ ] **Step 3: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

---

## Task 4: Final Verification And Handoff Report

**Files:**

- Modify: none unless verification exposes a real bug.

- [ ] **Step 1: Run full frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

- [ ] **Step 2: Run backend smoke verification only if backend files changed**

If no backend files changed, skip this step and say it was skipped because Phase
3 is frontend-only.

If backend files changed unexpectedly, stop and explain why. Then run from
`apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

Expected:

```txt
all backend tests pass
compileall exits 0
```

- [ ] **Step 3: Report changed files and remaining risk**

Final report must include:

```txt
- Files created.
- Files modified.
- npm run lint result.
- npm run build result.
- Whether backend verification was skipped or run.
- Remaining risks, especially that runtime app shell data requires a real logged-in Supabase session.
```

## Done Criteria

Phase 3 is complete when:

```txt
- apps/web/src/lib/api/query-keys.ts exists.
- apps/web/src/lib/api/requests.ts exists and matches docs/api-contract.md request endpoints.
- apps/web/src/hooks/use-requests.ts exists.
- apps/web/src/hooks/use-request-actions.ts exists.
- apps/web/src/hooks/use-current-user.ts uses queryKeys.currentUser.
- apps/web/src/components/app/app-shell.tsx exists.
- apps/web/src/app/(dashboard)/layout.tsx renders AppShell.
- Navigation visibility follows role rules from docs/frontend-ui-framework.md.
- npm run lint passes from apps/web.
- npm run build passes from apps/web.
```
