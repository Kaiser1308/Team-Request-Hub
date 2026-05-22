# Phase 6 Lead Admin And Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish lead-facing user role management and in-app notifications so leads can manage roles and all users can read backend-generated notifications.

**Architecture:** User and notification data flows through `src/lib/api/*` modules and TanStack Query hooks. UI components live under `src/components/admin` and `src/components/notifications`; route pages compose these components only. Backend remains the source of truth for permissions, so lead-only UI is hidden by role but forbidden backend responses must still render cleanly.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui Button, TanStack Query v5, FastAPI `/users` and `/notifications` endpoints through `apiFetch`.

---

## Required Context

Read these before coding:

```txt
AGENTS.md
apps/web/AGENTS.md
apps/web/README.md
docs/frontend-ui-framework.md
docs/api-contract.md
docs/permissions.md
docs/superpowers/plans/2026-05-20-phase-5-request-actions-detail.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

Use `ui-frameware/dashboard_team_request_hub/` only as visual reference for
dashboard density and hierarchy. There is no direct mockup for admin users; keep
it utilitarian and table/list focused.

## Phase Scope

In scope:

```txt
- Add useUsers and useUpdateUserRole hooks.
- Add lead-only role management UI.
- Add /admin/users page.
- Add notifications API client.
- Add notifications hooks and mutation hooks.
- Add notification list with loading, error, empty, unread, mark-read, and mark-all-read states.
- Render notifications on dashboard.
- Optionally add a compact unread count to AppShell if it does not create a layout refactor.
- Verify lint and build.
```

Out of scope:

```txt
- Request workflow action changes.
- Backend changes.
- Real-time Supabase notification subscriptions.
- Email/push/slack notification providers.
- Advanced user search, pagination, or audit logs.
- Dashboard analytics beyond a small notifications section.
```

Known current state:

```txt
- apps/web/src/lib/api/users.ts already has listUsers and updateUserRole.
- apps/web/src/lib/api/query-keys.ts already has users and notifications keys.
- apps/web/src/components/app/app-shell.tsx already hides /admin/users nav for non-leads.
- apps/web/src/app/(dashboard)/admin/users/page.tsx may not exist yet.
- apps/web/src/lib/api/notifications.ts does not exist yet.
- apps/web/src/hooks/use-notifications.ts does not exist yet.
```

Risks:

```txt
- Runtime role management requires the current user to have role lead.
- On fresh databases, notification lists may be empty until request actions create notifications.
- Backend forbidden errors must be shown as readable UI, not hidden behind loading loops.
```

---

## Files

Create:

```txt
apps/web/src/hooks/use-users.ts
apps/web/src/components/admin/user-role-table.tsx
apps/web/src/app/(dashboard)/admin/users/page.tsx
apps/web/src/lib/api/notifications.ts
apps/web/src/hooks/use-notifications.ts
apps/web/src/components/notifications/notification-list.tsx
```

Modify:

```txt
apps/web/src/app/(dashboard)/dashboard/page.tsx
apps/web/src/components/app/app-shell.tsx only if adding unread count remains small
```

Do not modify:

```txt
apps/api/*
apps/web/src/components/requests/*
apps/web/src/hooks/use-request-actions.ts
apps/web/src/lib/api/requests.ts
apps/web/src/app/(auth)/*
```

---

## Task 1: Add Users Hooks

**Files:**

- Create: `apps/web/src/hooks/use-users.ts`

- [ ] **Step 1: Create users hooks**

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

- [ ] **Step 2: Run frontend verification**

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

## Task 2: Add Lead User Role Management Page

**Files:**

- Create: `apps/web/src/components/admin/user-role-table.tsx`
- Create: `apps/web/src/app/(dashboard)/admin/users/page.tsx`

- [ ] **Step 1: Create user role table**

Create `apps/web/src/components/admin/user-role-table.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUpdateUserRole, useUsers } from "@/hooks/use-users";
import type { Role } from "@/types";

const roles: Role[] = ["fe", "be", "lead"];

function roleLabel(role: Role) {
  return role.toUpperCase();
}

export function UserRoleTable() {
  const currentUserQuery = useCurrentUser();
  const usersQuery = useUsers();
  const updateRole = useUpdateUserRole();

  if (currentUserQuery.isLoading || usersQuery.isLoading) {
    return (
      <div className="h-40 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />
    );
  }

  if (currentUserQuery.data?.role !== "lead") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Only lead users can manage roles.
      </div>
    );
  }

  if (usersQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {usersQuery.error instanceof Error
            ? usersQuery.error.message
            : "Could not load users."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void usersQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!usersQuery.data?.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
        No users found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e5e7eb] bg-white">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="bg-[#f3f4f6] text-xs text-[#6b7280]">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {usersQuery.data.map((user) => (
            <tr key={user.id} className="border-t border-[#e5e7eb]">
              <td className="px-4 py-3 text-[#111827]">
                {user.name ?? "Unnamed"}
              </td>
              <td className="px-4 py-3 text-[#4b5563]">{user.email}</td>
              <td className="px-4 py-3">
                <select
                  className="h-9 rounded-md border border-[#e5e7eb] bg-white px-2 text-sm"
                  value={user.role}
                  disabled={updateRole.isPending}
                  onChange={(event) =>
                    updateRole.mutate({
                      userId: user.id,
                      role: event.target.value as Role,
                    })
                  }
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-[#6b7280]">
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                }).format(new Date(user.created_at))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {updateRole.error ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {updateRole.error instanceof Error
            ? updateRole.error.message
            : "Could not update this user role."}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Create admin users page**

Create directory and file:

```txt
apps/web/src/app/(dashboard)/admin/users/page.tsx
```

Use this content:

```tsx
import { UserRoleTable } from "@/components/admin/user-role-table";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Lead-only role management for Team Request Hub.
        </p>
      </div>
      <UserRoleTable />
    </div>
  );
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

## Task 3: Add Notifications API And Hooks

**Files:**

- Create: `apps/web/src/lib/api/notifications.ts`
- Create: `apps/web/src/hooks/use-notifications.ts`

- [ ] **Step 1: Create notifications API client**

Create `apps/web/src/lib/api/notifications.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { Notification } from "@/types";

export function listNotifications(unreadOnly = false) {
  const searchParams = new URLSearchParams({
    unread_only: String(unreadOnly),
  });
  return apiFetch<Notification[]>(
    `/notifications?${searchParams.toString()}`,
  );
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

- [ ] **Step 2: Create notification hooks**

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

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: unreadOnly
      ? [...queryKeys.notifications, "unread"] as const
      : queryKeys.notifications,
    queryFn: () => listNotifications(unreadOnly),
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  function invalidateNotifications() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }

  return {
    markRead: useMutation({
      mutationFn: markNotificationRead,
      onSuccess: invalidateNotifications,
    }),
    markAllRead: useMutation({
      mutationFn: markAllNotificationsRead,
      onSuccess: invalidateNotifications,
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

## Task 4: Add Notification List And Dashboard Section

**Files:**

- Create: `apps/web/src/components/notifications/notification-list.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx` only for a compact unread count, if implemented.

- [ ] **Step 1: Create notification list**

Create `apps/web/src/components/notifications/notification-list.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  useNotificationActions,
  useNotifications,
} from "@/hooks/use-notifications";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationList() {
  const notificationsQuery = useNotifications(false);
  const actions = useNotificationActions();
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  if (notificationsQuery.isLoading) {
    return (
      <div className="h-32 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />
    );
  }

  if (notificationsQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {notificationsQuery.error instanceof Error
            ? notificationsQuery.error.message
            : "Could not load notifications."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void notificationsQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!notifications.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3">
        <p className="text-sm font-medium text-[#111827]">
          {unreadCount} unread
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!unreadCount || actions.markAllRead.isPending}
          onClick={() => actions.markAllRead.mutate()}
        >
          Mark all read
        </Button>
      </div>

      <div className="divide-y divide-[#e5e7eb]">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-sm text-[#111827]">{notification.message}</p>
              <p className="mt-1 text-xs text-[#6b7280]">
                {formatDate(notification.created_at)}
              </p>
              {notification.request_id ? (
                <Link
                  href={`/requests/${notification.request_id}`}
                  className="mt-1 inline-flex text-xs text-blue-700 hover:underline"
                >
                  View request
                </Link>
              ) : null}
            </div>
            {!notification.is_read ? (
              <Button
                type="button"
                variant="outline"
                disabled={actions.markRead.isPending}
                onClick={() => actions.markRead.mutate(notification.id)}
              >
                Mark read
              </Button>
            ) : (
              <span className="text-xs text-[#6b7280]">Read</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render notifications on dashboard**

Modify `apps/web/src/app/(dashboard)/dashboard/page.tsx`:

```tsx
import { NotificationList } from "@/components/notifications/notification-list";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Current notifications and request activity.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <NotificationList />
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Optional app shell unread count**

Only do this if it is a small change. If implemented, modify
`apps/web/src/components/app/app-shell.tsx`:

```tsx
import { useNotifications } from "@/hooks/use-notifications";
```

Inside `AppShell`, after `useCurrentUser()`:

```tsx
  const notificationsQuery = useNotifications(true);
  const unreadCount = notificationsQuery.data?.length ?? 0;
```

In the top bar, before `<LogoutButton />`:

```tsx
            <Link
              href="/dashboard"
              className="rounded-md border border-[#e5e7eb] px-3 py-2 text-xs text-[#4b5563]"
            >
              {unreadCount} unread
            </Link>
```

If this creates noisy loading errors for non-authenticated states, skip it and
only keep the dashboard notification list.

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

## Task 5: Final Verification And Handoff Report

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

- [ ] **Step 2: Backend verification policy**

If no backend files changed, skip backend tests and report:

```txt
Backend verification skipped because Phase 6 is frontend-only and no backend files changed.
```

If any backend file changed unexpectedly, stop and explain why before
continuing. Then run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

- [ ] **Step 3: Optional runtime smoke test**

If backend/frontend dev servers are running and the user can log in:

```txt
- lead user can open /admin/users
- non-lead user sees a forbidden/role message or no nav entry for Users
- lead can change a user's role
- dashboard shows notifications
- mark read works
- mark all read works
```

If runtime smoke is not run, report that it was not run and why.

- [ ] **Step 4: Report changed files and remaining risk**

Final report must include:

```txt
- Files created.
- Files modified.
- npm run lint result.
- npm run build result.
- Whether backend verification was skipped or run.
- Whether runtime smoke was run.
- Remaining risks, especially that role management requires a lead user and notifications require backend-created records.
```

## Done Criteria

Phase 6 is complete when:

```txt
- useUsers exists.
- useUpdateUserRole exists and invalidates users/current-user queries.
- /admin/users exists.
- UserRoleTable renders loading, forbidden, error, empty, and table states.
- UserRoleTable calls updateUserRole through the hook.
- notifications API client exists.
- notification hooks exist.
- NotificationList renders loading, error, empty, unread, read, mark-read, and mark-all-read states.
- Dashboard renders NotificationList.
- No request workflow action logic is changed.
- npm run lint passes from apps/web.
- npm run build passes from apps/web.
```
