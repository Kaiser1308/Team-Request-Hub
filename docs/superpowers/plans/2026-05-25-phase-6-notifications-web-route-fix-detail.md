# Notifications Web Route Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-app notifications usable on the web by adding the missing authenticated `/notifications` page and verifying the existing notification list, topbar unread count, and mark-read actions work end-to-end.

**Architecture:** Keep the frontend boundary unchanged: route pages compose components, `NotificationList` owns the notification UI state, hooks own TanStack Query usage, and `src/lib/api/notifications.ts` owns HTTP calls through `apiFetch`. Backend notification records and permissions remain source-of-truth in FastAPI and Supabase; this plan does not add realtime subscriptions or provider logic.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, next-intl, Tailwind CSS v4, shadcn/ui Button, lucide-react, TanStack Query v5, FastAPI `/notifications` endpoints through `apiFetch`.

---

## Context

Read before execution:

```txt
AGENTS.md
apps/web/AGENTS.md
apps/web/README.md
docs/architecture.md
docs/api-contract.md
docs/database-schema.md
docs/frontend-ui-framework.md
docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
docs/superpowers/plans/2026-05-20-phase-6-lead-admin-notifications-detail.md
```

Current evidence from repository inspection:

```txt
- apps/web/src/components/notifications/notification-list.tsx exists.
- apps/web/src/hooks/use-notifications.ts exists.
- apps/web/src/lib/api/notifications.ts exists.
- apps/web/src/components/app/app-shell.tsx fetches unread notifications and renders a bell count.
- apps/web/src/app/(dashboard)/dashboard/page.tsx links to /notifications.
- apps/web/src/app/(dashboard)/notifications/page.tsx does not exist.
```

Likely root cause:

```txt
The web UI links to /notifications but the App Router route is missing, so the notification screen cannot render even though the list component and API hook exist.
```

## Scope

In scope:

```txt
- Add authenticated /notifications page under the dashboard route group.
- Reuse the existing NotificationList component.
- Add notification page title handling in AppShell if the current title falls back to app name.
- Add missing i18n labels for the notification page if needed.
- Verify mark-read and mark-all-read query invalidation still refreshes both full and unread notification queries.
- Run frontend lint/build.
- Run backend notification route tests only if backend behavior is suspected or touched.
```

Out of scope:

```txt
- Backend notification schema changes.
- Real-time Supabase notification subscriptions.
- Telegram provider changes.
- Email, push, Slack, or browser notification providers.
- Request workflow changes beyond using existing invalidation behavior.
- New test framework setup.
```

## Files

Create:

```txt
apps/web/src/app/(dashboard)/notifications/page.tsx
```

Modify only if needed:

```txt
apps/web/src/components/app/app-shell.tsx
apps/web/src/i18n/messages/en.json
apps/web/src/i18n/messages/vi.json
apps/web/src/hooks/use-notifications.ts
```

Do not modify unless verification proves a backend mismatch:

```txt
apps/api/app/routes/notifications.py
apps/api/app/notification_module/_store.py
apps/api/app/notification_module/__init__.py
```

## Task 1: Add The Notifications Page

**Files:**

- Create: `apps/web/src/app/(dashboard)/notifications/page.tsx`

- [ ] **Step 1: Confirm route is missing**

Run from the repo root:

```bash
test ! -f 'apps/web/src/app/(dashboard)/notifications/page.tsx'
```

Expected: command exits `0`. If the file exists, read it and skip to Task 2.

- [ ] **Step 2: Create the route page**

Create `apps/web/src/app/(dashboard)/notifications/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { NotificationList } from "@/components/notifications/notification-list";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold text-[#111827]">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          {t("description")}
        </p>
      </div>
      <NotificationList />
    </div>
  );
}
```

- [ ] **Step 3: Add missing translation keys**

Modify `apps/web/src/i18n/messages/en.json` under `notifications`:

```json
"title": "Notifications",
"description": "Review request activity, status updates, and assignment changes."
```

Modify `apps/web/src/i18n/messages/vi.json` under `notifications`:

```json
"title": "Thông báo",
"description": "Xem hoạt động yêu cầu, cập nhật trạng thái và thay đổi phân công."
```

Keep existing notification keys unchanged.

- [ ] **Step 4: Run frontend checks**

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

## Task 2: Fix App Shell Navigation Details If Needed

**Files:**

- Modify: `apps/web/src/components/app/app-shell.tsx` only if the `/notifications` page title or bell link is wrong
- Modify: `apps/web/src/i18n/messages/en.json` only if adding nav/title key
- Modify: `apps/web/src/i18n/messages/vi.json` only if adding nav/title key

- [ ] **Step 1: Run required impact analysis before editing AppShell**

Run before any `AppShell` edit:

```txt
gitnexus_impact({target: "AppShell", file_path: "apps/web/src/components/app/app-shell.tsx", kind: "Function", direction: "upstream", repo: "Team-Request-Hub"})
```

Expected: review risk and direct callers. If risk is HIGH or CRITICAL, stop and report before editing.

- [ ] **Step 2: Update title mapping if `/notifications` shows app name**

If `getPageTitle()` does not map `/notifications`, update `apps/web/src/components/app/app-shell.tsx`:

```tsx
type NavLabelKey =
  | "dashboard"
  | "assigned"
  | "created"
  | "pool"
  | "done"
  | "all"
  | "users"
  | "newRequest"
  | "files"
  | "notifications";
```

Then add to `titleByKey`:

```tsx
"/notifications": "notifications",
```

Then add `nav.notifications` translations if missing:

```json
"notifications": "Notifications"
```

```json
"notifications": "Thông báo"
```

- [ ] **Step 3: Update the bell link only if current behavior is misleading**

If the bell still links to `/dashboard`, update it to the dedicated route:

```tsx
<Link
  href="/notifications"
  aria-label={tShell("openNotifications")}
  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-white"
>
  <Bell className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
  <span ref={unreadRef}>{unreadCount}</span>
</Link>
```

- [ ] **Step 4: Run frontend checks**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected: both pass.

## Task 3: Verify Notification Query Invalidation

**Files:**

- Modify: `apps/web/src/hooks/use-notifications.ts` only if invalidation does not refresh both query variants

- [ ] **Step 1: Inspect current query keys**

Confirm `useNotifications(false)` uses:

```ts
queryKeys.notifications
```

Confirm `useNotifications(true)` uses:

```ts
[...queryKeys.notifications, "unread"] as const
```

Confirm mutations invalidate the prefix:

```ts
void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
```

Expected: TanStack Query prefix invalidation refreshes both `['notifications']` and `['notifications', 'unread']`.

- [ ] **Step 2: Run required impact analysis before editing hook**

Only if Step 1 shows invalidation is wrong, run:

```txt
gitnexus_impact({target: "useNotificationActions", file_path: "apps/web/src/hooks/use-notifications.ts", kind: "Function", direction: "upstream", repo: "Team-Request-Hub"})
```

Expected: review direct callers and risk before editing.

- [ ] **Step 3: Fix invalidation only if needed**

If exact matching or stale behavior prevents unread count refresh, update `invalidateNotifications()`:

```ts
function invalidateNotifications() {
  void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  void queryClient.invalidateQueries({
    queryKey: [...queryKeys.notifications, "unread"] as const,
  });
}
```

Do not change `staleTime` or add polling unless the user explicitly asks for realtime-like behavior.

- [ ] **Step 4: Run frontend checks**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected: both pass.

## Task 4: Runtime Smoke Test

**Files:**

- Modify: none unless smoke test exposes a concrete bug

- [ ] **Step 1: Start backend if environment is available**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

Expected: server starts. If `.env` values are missing, skip runtime smoke and report the missing environment constraint.

- [ ] **Step 2: Start frontend**

Run from `apps/web`:

```bash
npm run dev
```

Expected: Next.js starts on local dev port.

- [ ] **Step 3: Manual web flow**

Using a logged-in active user:

```txt
1. Open /dashboard.
2. Click the bell in the topbar.
3. Confirm browser lands on /notifications.
4. Confirm notification list renders loading, empty, error, or list state without a 404.
5. Trigger a workflow action that creates a notification, such as assigning or reassigning a request to the current user.
6. Confirm unread count increases after query refresh or page reload.
7. Click Mark read on one notification.
8. Confirm the row changes to Read and the topbar unread count decreases.
9. Click Mark all read.
10. Confirm all visible notifications are read and the unread count reaches 0.
```

If no backend-created notifications exist, verify at minimum that `/notifications` renders the empty state and mark this as partial smoke coverage.

## Task 5: Final Verification And Handoff

**Files:**

- Modify: none unless verification exposes a concrete bug

- [ ] **Step 1: Run frontend verification**

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

- [ ] **Step 2: Run backend tests only if backend files changed**

If backend files did not change, report:

```txt
Backend verification skipped because this route fix is frontend-only and no backend files changed.
```

If backend files changed, run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_notification_routes
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: all tests pass.

- [ ] **Step 3: Run GitNexus change detection before any commit**

Run:

```txt
gitnexus_detect_changes({scope: "all", repo: "Team-Request-Hub"})
```

Expected: changed symbols are limited to notification page/i18n/app shell/hook if those were touched.

- [ ] **Step 4: Report outcome**

Final report must include:

```txt
- Files created.
- Files modified.
- Impact analysis result for any edited symbol.
- npm run lint result.
- npm run build result.
- Backend verification run or skipped.
- Runtime smoke test run, partial, or skipped.
- Remaining risk, especially that notifications require backend-created records and an active logged-in user.
```

## Done Criteria

This fix is complete when:

```txt
- /notifications exists under apps/web/src/app/(dashboard).
- Dashboard "Open notifications" link resolves to a real page.
- Topbar bell resolves to /notifications or another deliberate notification surface.
- NotificationList renders on the notification page.
- Mark read and mark all read still invalidate notification queries.
- npm run lint passes from apps/web.
- npm run build passes from apps/web.
- Backend files remain unchanged unless a verified API bug is found.
```

## Known Risks

```txt
- Without real Supabase/backend env, runtime smoke can only be partially verified by build/lint.
- Empty notification state is valid on fresh databases until request workflow actions create notification records.
- Existing implementation is pull-based, not realtime; unread counts update on query invalidation, focus/refetch, route navigation, or manual reload, not instantly from database changes.
```
