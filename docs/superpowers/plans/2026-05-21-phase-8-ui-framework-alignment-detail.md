# Phase 8 UI Framework Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the existing Next.js frontend with the `ui-frameware/` visual references while preserving the current backend API boundary and implemented request workflows.

**Architecture:** This phase is frontend-only. Route files remain thin composers, hooks own TanStack Query, API modules continue using `apiFetch`, and reusable UI lives under `apps/web/src/components`. The static `ui-frameware/` HTML and screenshots are visual references only; rebuild the interface with React, Tailwind CSS v4, shadcn-style primitives, and lucide icons.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict mode, Tailwind CSS v4, shadcn/ui conventions, lucide-react, TanStack Query v5, Supabase auth session client, FastAPI backend API.

---

## Required Context

Read these before editing:

```txt
AGENTS.md
apps/web/README.md
docs/frontend-ui-framework.md
docs/api-contract.md
docs/permissions.md
docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

Use these visual references:

```txt
ui-frameware/login_team_request_hub/screen.png
ui-frameware/dashboard_team_request_hub/screen.png
ui-frameware/assigned_to_me_team_request_hub/screen.png
ui-frameware/created_by_me_team_request_hub/screen.png
ui-frameware/pool_team_request_hub/screen.png
ui-frameware/create_new_request_team_request_hub/screen.png
ui-frameware/request_detail_team_request_hub/screen.png
ui-frameware/cinematic_precision/DESIGN.md
```

Do not copy from `ui-frameware/*/code.html` directly. Use it only to understand layout hierarchy, density, labels, and screen intent.

Before editing any function, component, hook, or exported symbol, run GitNexus impact analysis as required by `AGENTS.md`. If the risk is HIGH or CRITICAL, stop and report the blast radius before changing code.

---

## Scope

In scope:

```txt
- Improve visual fidelity against ui-frameware screenshots.
- Standardize app shell, page headers, cards, badges, filters, dialogs, and states.
- Improve mobile behavior for dashboard routes.
- Keep all existing runtime data flows through hooks and apiFetch.
- Verify lint, build, and a CLI-friendly route/state checklist. Do not require screenshot capture from a CLI-only worker.
```

Out of scope:

```txt
- Backend endpoint changes.
- Supabase schema changes.
- New product workflow rules.
- Frontend Supabase table queries.
- Copying static HTML, Tailwind CDN classes, Material Symbols, demo data, inline scripts, or decorative blob backgrounds from ui-frameware.
```

---

## File Map

Expected frontend files to inspect and likely modify:

```txt
apps/web/src/app/globals.css
apps/web/src/app/(auth)/login/page.tsx
apps/web/src/app/(dashboard)/layout.tsx
apps/web/src/app/(dashboard)/dashboard/page.tsx
apps/web/src/app/(dashboard)/assigned/page.tsx
apps/web/src/app/(dashboard)/requests/page.tsx
apps/web/src/app/(dashboard)/pool/page.tsx
apps/web/src/app/(dashboard)/done/page.tsx
apps/web/src/app/(dashboard)/all/page.tsx
apps/web/src/app/(dashboard)/requests/new/page.tsx
apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx
apps/web/src/app/(dashboard)/admin/users/page.tsx
apps/web/src/components/app/app-shell.tsx
apps/web/src/components/auth/google-login-button.tsx
apps/web/src/components/auth/logout-button.tsx
apps/web/src/components/notifications/notification-list.tsx
apps/web/src/components/requests/request-actions.tsx
apps/web/src/components/requests/request-card.tsx
apps/web/src/components/requests/request-detail.tsx
apps/web/src/components/requests/request-form.tsx
apps/web/src/components/requests/request-list.tsx
apps/web/src/components/requests/request-priority-badge.tsx
apps/web/src/components/requests/request-status-badge.tsx
apps/web/src/components/requests/request-timeline.tsx
apps/web/src/components/admin/user-role-table.tsx
apps/web/src/components/ui/button.tsx
```

Create these only if the current implementation does not already provide equivalent focused primitives:

```txt
apps/web/src/components/shared/page-header.tsx
apps/web/src/components/shared/empty-state.tsx
apps/web/src/components/shared/error-state.tsx
apps/web/src/components/shared/loading-state.tsx
apps/web/src/components/shared/filter-bar.tsx
```

Do not modify API behavior unless a UI compile error exposes a mismatched frontend type:

```txt
apps/web/src/lib/api/client.ts
apps/web/src/lib/api/requests.ts
apps/web/src/lib/api/users.ts
apps/web/src/lib/api/notifications.ts
apps/web/src/hooks/use-notifications.ts
apps/web/src/hooks/use-users.ts
apps/web/src/types/index.ts
```

---

## Task 1: UI Baseline Audit

**Files:**

- Create: `docs/superpowers/reports/2026-05-21-ui-framework-audit.md`

- [ ] **Step 1: Capture current route inventory**

Run:

```powershell
rtk powershell -NoProfile -Command "Get-ChildItem -LiteralPath apps\web\src\app -Recurse -File | Select-Object FullName"
```

Expected: route files include login, dashboard, assigned, requests, pool, done, all, request detail, create request, and admin users.

- [ ] **Step 2: Inspect current UI components**

Run:

```powershell
rtk powershell -NoProfile -Command "Get-ChildItem -LiteralPath apps\web\src\components -Recurse -File | Select-Object FullName"
```

Expected: request, notification, admin, app shell, auth, and button components are present.

- [ ] **Step 3: Write the audit report**

Create `docs/superpowers/reports/2026-05-21-ui-framework-audit.md` with this structure:

```markdown
# UI Framework Audit

## Reference Rules

- Source of truth: docs/frontend-ui-framework.md
- Visual reference only: ui-frameware/
- No static HTML, Tailwind CDN, Material Symbols, hard-coded demo data, or decorative ambient blobs copied into apps/web.

## Screen Findings

| Screen | Reference | Current route | Required alignment work |
| --- | --- | --- | --- |
| Login | ui-frameware/login_team_request_hub/screen.png | apps/web/src/app/(auth)/login/page.tsx | Replace placeholder-style layout with compact product login, Google OAuth button, loading and error states. |
| Dashboard | ui-frameware/dashboard_team_request_hub/screen.png | apps/web/src/app/(dashboard)/dashboard/page.tsx | Align summary cards, recent requests, recent activity, and lead links with internal-tool density. |
| Assigned | ui-frameware/assigned_to_me_team_request_hub/screen.png | apps/web/src/app/(dashboard)/assigned/page.tsx | Align filters, request cards, next action, and empty state. |
| Created | ui-frameware/created_by_me_team_request_hub/screen.png | apps/web/src/app/(dashboard)/requests/page.tsx | Align creator-focused list, status/assignee metadata, cancel action, and create link. |
| Pool | ui-frameware/pool_team_request_hub/screen.png | apps/web/src/app/(dashboard)/pool/page.tsx | Align priority filter, self-assign action, and BE/lead-only view. |
| Create | ui-frameware/create_new_request_team_request_hub/screen.png | apps/web/src/app/(dashboard)/requests/new/page.tsx | Align form width, labels, validation text, priority selector, submit/back controls. |
| Detail | ui-frameware/request_detail_team_request_hub/screen.png | apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx | Align title/status block, action bar, reply dialogs, timeline, assignment history. |
| Done | docs/frontend-ui-framework.md | apps/web/src/app/(dashboard)/done/page.tsx | Use completed request cards with done reply preview and detail link. |
| All | docs/frontend-ui-framework.md | apps/web/src/app/(dashboard)/all/page.tsx | Lead-only compact all-requests list with filters. |
| Admin Users | docs/frontend-ui-framework.md | apps/web/src/app/(dashboard)/admin/users/page.tsx | Lead-only role management table with update state and forbidden state. |
```

- [ ] **Step 4: Commit the audit report**

Run:

```powershell
rtk git add docs/superpowers/reports/2026-05-21-ui-framework-audit.md
rtk git commit -m "docs: audit frontend ui framework alignment"
```

Expected: commit succeeds if the implementation session is using commits. If the working tree already contains unrelated user changes, stage only the audit report.

---

## Task 2: Theme Tokens And Shared Primitives

**Files:**

- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/ui/button.tsx`
- Create if missing: `apps/web/src/components/shared/page-header.tsx`
- Create if missing: `apps/web/src/components/shared/empty-state.tsx`
- Create if missing: `apps/web/src/components/shared/error-state.tsx`
- Create if missing: `apps/web/src/components/shared/loading-state.tsx`
- Create if missing: `apps/web/src/components/shared/filter-bar.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for these symbols before editing if they exist:

```txt
Button
PageHeader
EmptyState
ErrorState
LoadingState
FilterBar
```

Report direct callers, affected flows, and risk level.

- [ ] **Step 2: Normalize global visual tokens**

Set the app to the restrained light internal-tool theme from `docs/frontend-ui-framework.md`:

```txt
background: #f9fafb
surface: #ffffff
surface-muted: #f3f4f6
border: #e5e7eb
text-primary: #111827
text-secondary: #4b5563
text-muted: #6b7280
primary: #111827
primary-foreground: #ffffff
link/focus/info: #2563eb
success: #16a34a
warning: #f59e0b
danger: #dc2626
letter-spacing: 0
card radius: 8px or less
button radius: 6-8px
input height: 40px
```

Keep the existing Tailwind v4 setup. Do not add Tailwind CDN, Google font imports, or global decorative background effects.

- [ ] **Step 3: Add shared page state components**

Create focused components with these APIs if they do not already exist:

```tsx
type PageHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  meta?: React.ReactNode;
};
```

```tsx
type EmptyStateProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
};
```

```tsx
type ErrorStateProps = {
  title?: string;
  message: string;
  action?: React.ReactNode;
};
```

```tsx
type LoadingStateProps = {
  label?: string;
  rows?: number;
};
```

```tsx
type FilterBarProps = {
  children: React.ReactNode;
};
```

Each component must use compact spacing, visible focus styles where interactive children are present, and no nested card styling.

- [ ] **Step 4: Verify shared primitive compile**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: lint passes or reports only pre-existing unrelated issues. Fix issues introduced by this task before continuing.

- [ ] **Step 5: Commit shared UI primitives**

Run:

```powershell
rtk git add apps/web/src/app/globals.css apps/web/src/components/ui/button.tsx apps/web/src/components/shared
rtk git commit -m "feat: add frontend shared ui primitives"
```

Expected: commit includes only shared UI primitive changes.

---

## Task 3: App Shell And Navigation Alignment

**Files:**

- Modify: `apps/web/src/app/(dashboard)/layout.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`
- Modify if needed: `apps/web/src/components/auth/logout-button.tsx`
- Modify if needed: `apps/web/src/components/notifications/notification-list.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
AppShell
LogoutButton
NotificationList
```

Report direct callers, affected flows, and risk level.

- [ ] **Step 2: Align desktop shell**

Implement a persistent desktop shell with:

```txt
- 240px sidebar
- 56-64px top bar
- light neutral background
- white content surface only where a card/list item is actually framed
- active nav state
- role badge in top bar or user area
- notification bell/list entry point
- current user name/email when available
```

Primary nav order:

```txt
Dashboard
Assigned to me
Created by me
Pool
Done
All requests
Users
New request
```

Visibility:

```txt
fe: Dashboard, Created by me, Done, New request
be: Dashboard, Assigned to me, Created by me, Pool, Done, New request
lead: Dashboard, Assigned to me, Created by me, Pool, Done, All requests, Users, New request
```

- [ ] **Step 3: Align mobile shell**

Implement mobile behavior:

```txt
- sidebar collapses behind a menu button
- top bar remains visible
- page title is not duplicated awkwardly
- nav items remain keyboard and screen-reader accessible
- no horizontal scroll at 375px width
```

- [ ] **Step 4: Verify shell routes**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: lint passes.

- [ ] **Step 5: Commit app shell changes**

Run:

```powershell
rtk git add apps/web/src/app/(dashboard)/layout.tsx apps/web/src/components/app/app-shell.tsx apps/web/src/components/auth/logout-button.tsx apps/web/src/components/notifications/notification-list.tsx
rtk git commit -m "feat: align dashboard app shell"
```

Expected: commit includes only shell/navigation changes.

---

## Task 4: Badge, Request Card, And Request List Alignment

**Files:**

- Modify: `apps/web/src/components/requests/request-status-badge.tsx`
- Modify: `apps/web/src/components/requests/request-priority-badge.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`
- Modify: `apps/web/src/components/requests/request-list.tsx`
- Modify if needed: `apps/web/src/components/requests/request-actions.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
RequestStatusBadge
RequestPriorityBadge
RequestCard
RequestList
RequestActions
```

Report direct callers, affected flows, and risk level.

- [ ] **Step 2: Standardize status badges**

Status labels and emphasis:

```txt
pending: neutral
acknowledged: info
in_progress: info stronger emphasis
done: success
cancelled: muted danger
```

Each badge must include text, not icon/color only.

- [ ] **Step 3: Standardize priority badges**

Priority labels and emphasis:

```txt
low: muted
medium: neutral
high: warning
urgent: danger
```

Each badge must include text, not icon/color only.

- [ ] **Step 4: Align request card layout**

Request cards should show:

```txt
- title as the primary scan target
- status badge
- priority badge
- creator
- assignee or unassigned state
- timestamp if available
- short description preview
- primary next action if available
- link to detail
```

Use 8px radius or less, compact vertical rhythm, and stable dimensions so hover/loading states do not shift layout.

- [ ] **Step 5: Align request list states**

Request list must support:

```txt
- loading skeleton rows
- empty state with one useful action when relevant
- error state with retry when a retry callback is available
- forbidden copy when the route denies access
```

- [ ] **Step 6: Verify request components**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: lint passes.

- [ ] **Step 7: Commit request list component changes**

Run:

```powershell
rtk git add apps/web/src/components/requests
rtk git commit -m "feat: align request list components"
```

Expected: commit includes only request component changes.

---

## Task 5: Login And Dashboard Screens

**Files:**

- Modify: `apps/web/src/app/(auth)/login/page.tsx`
- Modify: `apps/web/src/components/auth/google-login-button.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
LoginPage
GoogleLoginButton
DashboardPage
```

Use the actual exported/default component names found in the files if they differ.

- [ ] **Step 2: Align login screen**

Build the login route from `ui-frameware/login_team_request_hub/screen.png` intent:

```txt
- product name is visible in first viewport
- concise internal-tool description
- one Google OAuth button
- loading state while redirecting
- readable error alert for OAuth/session errors
- no decorative image panel
- no enterprise SSO button unless backed by real flow
```

- [ ] **Step 3: Align dashboard screen**

Build the dashboard route from `ui-frameware/dashboard_team_request_hub/screen.png` intent:

```txt
- current user summary
- count cards for assigned, created, pool, done, urgent when data is available
- recent requests list
- recent notifications/activity list
- lead-only links to all requests and users
- compact responsive layout with no nested cards
```

If aggregate endpoints do not exist, compute lightweight counts from already fetched request lists in the hook/page layer without adding backend changes.

- [ ] **Step 4: Verify login and dashboard**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: lint passes.

- [ ] **Step 5: Commit login/dashboard changes**

Run:

```powershell
rtk git add apps/web/src/app/(auth)/login/page.tsx apps/web/src/components/auth/google-login-button.tsx apps/web/src/app/(dashboard)/dashboard/page.tsx
rtk git commit -m "feat: align login and dashboard ui"
```

Expected: commit includes only login/dashboard UI changes.

---

## Task 6: Request List Screens

**Files:**

- Modify: `apps/web/src/app/(dashboard)/assigned/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/pool/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/done/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/all/page.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for each page component that will be edited:

```txt
AssignedPage
RequestsPage
PoolPage
DonePage
AllRequestsPage
```

Use the actual exported/default component names found in the files if they differ.

- [ ] **Step 2: Align Assigned to Me**

Use `ui-frameware/assigned_to_me_team_request_hub/screen.png` for layout intent:

```txt
- page header
- status filter
- priority filter
- assigned request cards
- primary next action per request when available
- empty state when no assigned requests exist
```

- [ ] **Step 3: Align Created by Me**

Use `ui-frameware/created_by_me_team_request_hub/screen.png` for layout intent:

```txt
- page header with New request action
- created request cards
- status and assignee metadata
- cancel action when allowed
- empty state linking to create request
```

- [ ] **Step 4: Align Pool**

Use `ui-frameware/pool_team_request_hub/screen.png` for layout intent:

```txt
- BE/lead-only access handling
- priority filter
- unassigned request cards
- self-assign action
- empty state when pool is empty
```

- [ ] **Step 5: Align Done**

Use `docs/frontend-ui-framework.md` for layout intent:

```txt
- completed requests relevant to current user
- done reply preview
- completion timestamp when available
- detail link
```

- [ ] **Step 6: Align All Requests**

Use `docs/frontend-ui-framework.md` for layout intent:

```txt
- lead-only access handling
- compact all-requests list
- status, priority, creator, and assignee filters where current hooks support them
- detail link
```

- [ ] **Step 7: Verify request list screens**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: lint passes.

- [ ] **Step 8: Commit request list screens**

Run:

```powershell
rtk git add apps/web/src/app/(dashboard)/assigned/page.tsx apps/web/src/app/(dashboard)/requests/page.tsx apps/web/src/app/(dashboard)/pool/page.tsx apps/web/src/app/(dashboard)/done/page.tsx apps/web/src/app/(dashboard)/all/page.tsx
rtk git commit -m "feat: align request list screens"
```

Expected: commit includes only request list screen changes.

---

## Task 7: Create Request And Request Detail Screens

**Files:**

- Modify: `apps/web/src/app/(dashboard)/requests/new/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx`
- Modify: `apps/web/src/components/requests/request-form.tsx`
- Modify: `apps/web/src/components/requests/request-detail.tsx`
- Modify: `apps/web/src/components/requests/request-actions.tsx`
- Modify: `apps/web/src/components/requests/done-dialog.tsx`
- Modify: `apps/web/src/components/requests/reassign-dialog.tsx`
- Modify: `apps/web/src/components/requests/cancel-dialog.tsx`
- Modify: `apps/web/src/components/requests/request-timeline.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
RequestForm
RequestDetail
RequestActions
DoneDialog
ReassignDialog
CancelDialog
RequestTimeline
```

Report direct callers, affected flows, and risk level.

- [ ] **Step 2: Align create request**

Use `ui-frameware/create_new_request_team_request_hub/screen.png` for layout intent:

```txt
- title field
- description field
- priority control
- optional assignee only if current backend/frontend flow supports it
- submit button
- cancel/back action
- field validation messages
- success redirect behavior preserved
```

- [ ] **Step 3: Align request detail**

Use `ui-frameware/request_detail_team_request_hub/screen.png` for layout intent:

```txt
- title, description, priority, status
- creator, assignee, timestamps
- role/status-aware action bar
- done reply dialog with required reply
- reassign dialog where allowed
- cancel confirmation
- assignment history
- status timeline
```

- [ ] **Step 4: Verify dialogs**

Check:

```txt
- dialogs have accessible names
- dialogs close with Escape
- submit buttons disable while mutation is pending
- backend validation and permission errors are readable
- no optimistic workflow status changes without rollback
```

- [ ] **Step 5: Verify create/detail screens**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: lint passes.

- [ ] **Step 6: Commit create/detail changes**

Run:

```powershell
rtk git add apps/web/src/app/(dashboard)/requests/new/page.tsx apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx apps/web/src/components/requests/request-form.tsx apps/web/src/components/requests/request-detail.tsx apps/web/src/components/requests/request-actions.tsx apps/web/src/components/requests/done-dialog.tsx apps/web/src/components/requests/reassign-dialog.tsx apps/web/src/components/requests/cancel-dialog.tsx apps/web/src/components/requests/request-timeline.tsx
rtk git commit -m "feat: align request create and detail ui"
```

Expected: commit includes only create/detail UI changes.

---

## Task 8: Admin Users And Notifications

**Files:**

- Modify: `apps/web/src/app/(dashboard)/admin/users/page.tsx`
- Modify: `apps/web/src/components/admin/user-role-table.tsx`
- Modify: `apps/web/src/components/notifications/notification-list.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
UserRoleTable
NotificationList
AdminUsersPage
```

Use the actual exported/default component names found in the files if they differ.

- [ ] **Step 2: Align admin users**

Use `docs/frontend-ui-framework.md` for layout intent:

```txt
- lead-only access handling
- compact user list
- role selector for each user
- pending state while saving
- readable forbidden state
- readable backend error state
```

- [ ] **Step 3: Align notifications**

Notification list should support:

```txt
- compact list in dashboard/topbar context
- unread/read distinction without relying only on color
- empty state
- mutation pending state for mark read actions if present
```

- [ ] **Step 4: Verify admin and notifications**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: lint passes.

- [ ] **Step 5: Commit admin/notification changes**

Run:

```powershell
rtk git add apps/web/src/app/(dashboard)/admin/users/page.tsx apps/web/src/components/admin/user-role-table.tsx apps/web/src/components/notifications/notification-list.tsx
rtk git commit -m "feat: align admin and notification ui"
```

Expected: commit includes only admin and notification UI changes.

---

## Task 9: Responsive And Accessibility Pass

**Files:**

- Modify only files touched by Tasks 2-8.

- [ ] **Step 1: Check mobile widths**

Run the web app locally:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run dev"
```

Open the app at the printed local URL. Check these viewport widths:

```txt
375x812
768x1024
1440x900
```

- [ ] **Step 2: Verify no layout overflow**

Check these routes:

```txt
/login
/dashboard
/assigned
/requests
/pool
/done
/all
/requests/new
/requests/[requestId]
/admin/users
```

Expected:

```txt
- no incoherent overlapping text
- no horizontal scroll at 375px
- buttons keep readable labels
- cards/lists keep stable dimensions
- page titles fit their containers
```

- [ ] **Step 3: Verify accessibility basics**

Check:

```txt
- buttons and icon buttons have accessible names
- labels are connected to form inputs
- invalid fields show text errors
- focus rings are visible
- dialogs trap focus and close with Escape
- status and priority are text labels, not color-only indicators
```

- [ ] **Step 4: Fix only verified responsive/accessibility defects**

Keep fixes scoped to the route/component where the defect appears. Do not refactor unrelated code.

- [ ] **Step 5: Commit responsive/accessibility changes**

Run:

```powershell
rtk git add apps/web/src
rtk git commit -m "fix: polish frontend responsive accessibility"
```

Expected: commit includes only responsive/accessibility fixes from this pass.

---

## Task 10: Final Verification And CLI-Friendly Report

**Files:**

- Create: `docs/superpowers/reports/2026-05-21-ui-framework-verification.md`
- Modify: `apps/web/README.md` only if UI verification commands or current state are stale.

- [ ] **Step 1: Run lint**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run lint"
```

Expected: command exits 0.

- [ ] **Step 2: Run production build**

Run:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run build"
```

Expected: command exits 0. If the build fails due to missing environment variables, record the exact missing variable and verify with the documented `.env.example` values before changing code.

- [ ] **Step 3: Run route/state smoke review without screenshot requirements**

Start dev server if not already running:

```powershell
rtk powershell -NoProfile -Command "Set-Location apps\web; npm run dev"
```

Review these routes in whatever local preview method is available to the worker. A CLI-only worker may verify by server logs, route compilation output, redirects, and documented manual observations instead of screenshots:

```txt
/login
/dashboard
/assigned
/requests
/pool
/done
/all
/requests/new
/requests/[requestId]
/admin/users
```

Expected: routes compile and respond without blank screens or runtime errors. Auth-protected routes may redirect to login if no session exists; record that as expected if it happens. Do not require screenshots as an acceptance artifact.

- [ ] **Step 4: Write verification report**

Create `docs/superpowers/reports/2026-05-21-ui-framework-verification.md`:

```markdown
# UI Framework Verification

## Commands

| Command | Result |
| --- | --- |
| `npm run lint` from `apps/web` | PASS |
| `npm run build` from `apps/web` | PASS |

## Route Smoke

| Route | Result | Notes |
| --- | --- | --- |
| `/login` | PASS | Google OAuth button visible. |
| `/dashboard` | PASS | Redirects to login when unauthenticated or renders dashboard when authenticated. |
| `/assigned` | PASS | Role/session behavior matches current auth state. |
| `/requests` | PASS | Created request list state renders. |
| `/pool` | PASS | BE/lead-only state renders. |
| `/done` | PASS | Done list state renders. |
| `/all` | PASS | Lead-only state renders. |
| `/requests/new` | PASS | Create form renders. |
| `/requests/[requestId]` | PASS | Detail route renders with valid request id when backend data exists. |
| `/admin/users` | PASS | Lead-only role management state renders. |

## UI Rules Checked

- No Tailwind CDN, Material Symbols, copied static HTML, external demo images, or decorative ambient blobs added.
- Status and priority badges include text labels.
- Mobile width 375px has no horizontal scroll on checked pages.
- App shell uses role-aware navigation.
- Pages keep data access through hooks/API client.
- No screenshot artifact is required from CLI-only execution.
```

If any row fails, replace `PASS` with `FAIL` and include the concrete error text and route.

- [ ] **Step 5: Run GitNexus change detection**

Run `gitnexus_detect_changes()` through the available GitNexus MCP tooling before committing final verification changes.

Expected: changed symbols and flows are limited to frontend UI route/component alignment plus docs reports.

- [ ] **Step 6: Commit final report**

Run:

```powershell
rtk git add docs/superpowers/reports/2026-05-21-ui-framework-verification.md apps/web/README.md
rtk git commit -m "docs: verify frontend ui framework alignment"
```

Expected: commit includes the verification report and README only if README was actually updated.

---

## Done Criteria

This phase is done when:

```txt
- docs/superpowers/reports/2026-05-21-ui-framework-audit.md exists.
- Shared UI primitives are present or equivalent current components are documented in the audit.
- App shell and route screens follow docs/frontend-ui-framework.md and use ui-frameware screenshots as implementation references, not screenshot-based acceptance gates.
- Login, dashboard, request lists, create request, request detail, admin users, and notifications have loading/empty/error/forbidden states where data-backed.
- Mobile layout is usable at 375px width.
- npm run lint passes from apps/web.
- npm run build passes from apps/web, or the only blocker is a documented missing local env value.
- docs/superpowers/reports/2026-05-21-ui-framework-verification.md records final checks.
- GitNexus change detection reports only expected frontend UI/doc scope.
```

## Handoff Notes

Use the WSL2 performance diagnosis when choosing where to run the implementation. If builds are too slow from `/mnt/c`, clone or copy the repo into native WSL storage such as `~/team-request-hub`, install dependencies there, and run the same commands.

Keep all user data and workflow permissions backend-owned. The frontend may hide unavailable actions for clarity, but must still handle backend 403/validation responses cleanly.
