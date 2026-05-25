# Frontend UI Framework

This document turns the static files in `ui-frameware/` into the working UI
framework for the Next.js frontend.

`ui-frameware/` is a visual reference, not production code. Do not copy its
HTML, CDN Tailwind setup, Google font imports, Material Symbols, inline scripts,
external images, hard-coded demo data, or decorative background effects into
`apps/web`.

## Source References

```txt
ui-frameware/login_team_request_hub/
ui-frameware/dashboard_team_request_hub/
ui-frameware/assigned_to_me_team_request_hub/
ui-frameware/created_by_me_team_request_hub/
ui-frameware/pool_team_request_hub/
ui-frameware/create_new_request_team_request_hub/
ui-frameware/request_detail_team_request_hub/
ui-frameware/cinematic_precision/DESIGN.md
```

Use the screenshots and HTML to understand layout density, hierarchy, and
screen intent. Rebuild the UI with React components, app routes, Tailwind v4,
shadcn/ui, lucide icons, TanStack Query, and the backend API client.

## Product UI Direction

Team Request Hub is an internal operational tool. The UI should be quiet,
structured, fast to scan, and efficient for repeated work.

Keep:

- Light neutral surfaces.
- Clear request cards and request lists.
- Compact status and priority badges.
- Persistent app navigation.
- Strong visual hierarchy for request title, status, priority, owner, assignee,
  and next action.

Adjust:

- Remove cinematic hero treatment from authenticated pages.
- Remove decorative ambient blobs, image panels, and oversized marketing-style
  sections.
- Use compact tool layouts instead of large editorial cards.
- Keep `letter-spacing: 0` for body text; use light negative tracking only through typography tokens where it improves precision.
- Keep card radius at `8px` or less unless a shadcn component requires its own
  token.

Do not use:

- Tailwind CDN.
- Material Symbols.
- Frontend Supabase DB queries.
- Frontend business permission decisions beyond UI visibility.
- Hard-coded users, dates, counts, or request data.

## Design Tokens

Map the existing visual direction into a restrained app theme.

```txt
background:        #f9fafb
surface:           #ffffff
surface-muted:     #f3f4f6
border:            #e5e7eb
text-primary:      #111827
text-secondary:    #4b5563
text-muted:        #6b7280
primary:           #111827
primary-foreground:#ffffff
link:              #2563eb
focus:             #2563eb
success:           #16a34a
warning:           #f59e0b
danger:            #dc2626
info:              #2563eb
```

Typography:

```txt
font family: Inter only, through next/font/google
strategy:    centralized typography utilities in apps/web/src/app/globals.css
body text:   keep letter-spacing 0 for Vietnamese readability
precision:   use light negative tracking only on headings, buttons, links, badges, and compact metadata

Token              Use
text-page-title    page h1 headings
text-section-title section/dialog headings
text-card-title    request/card titles
text-body          standard body copy
text-body-medium   labels and emphasized text
text-caption       timestamps and secondary metadata
text-caption-strong badges and compact labels
text-button        standard button labels
text-button-sm     small button labels
text-link          inline/action links
text-stat-value    dashboard stat values
text-stat-label    dashboard stat labels
```

Spacing and shape:

```txt
base spacing: 4px/8px scale
page gutter mobile: 16px
page gutter desktop: 24px
app shell sidebar width: 240px
top bar height: 56-64px
card radius: 8px
button radius: 6-8px
input height: 40px
```

## Route Map

Implement routes inside `apps/web/src/app`.

```txt
/(auth)/login
  Source: ui-frameware/login_team_request_hub
  Purpose: Supabase Google OAuth login.

/(dashboard)/dashboard
  Source: ui-frameware/dashboard_team_request_hub
  Purpose: current workload summary, urgent requests, recent activity.

/(dashboard)/assigned
  Source: ui-frameware/assigned_to_me_team_request_hub
  Purpose: requests assigned to current user.

/(dashboard)/requests
  Source: ui-frameware/created_by_me_team_request_hub
  Purpose: requests created by current user.

/(dashboard)/pool
  Source: ui-frameware/pool_team_request_hub
  Purpose: unassigned requests available for all active users to self-assign.

/(dashboard)/done
  Source: no direct mockup
  Purpose: completed requests relevant to current user.

/(dashboard)/all
  Source: no direct mockup
  Purpose: lead-only all requests view.

/(dashboard)/requests/new
  Source: ui-frameware/create_new_request_team_request_hub
  Purpose: create an internal request.

/(dashboard)/requests/[requestId]
  Source: ui-frameware/request_detail_team_request_hub
  Purpose: request detail, actions, done reply, assignment history, status logs.

/(dashboard)/admin/users
  Source: no direct mockup
  Purpose: lead-only role management.
```

## Frontend Architecture

Use the existing boundary from `apps/web/README.md`.

```txt
src/app/
  Route files and route layouts only.

src/components/app/
  AppShell, AppSidebar, AppTopbar, UserMenu, NotificationBell.

src/components/auth/
  GoogleLoginButton, LogoutButton.

src/components/requests/
  RequestCard, RequestList, RequestFilters, RequestStatusBadge,
  RequestPriorityBadge, RequestForm, RequestDetail, RequestTimeline,
  RequestActions, DoneRequestDialog, ReassignRequestDialog,
  CancelRequestDialog.

src/components/notifications/
  NotificationList, NotificationItem, NotificationEmptyState.

src/components/admin/
  UserRoleTable, UserRoleSelect.

src/components/shared/
  PageHeader, EmptyState, ErrorState, LoadingState, ConfirmDialog.

src/hooks/
  useCurrentUser, useRequests, useRequest, useRequestActions,
  useNotifications, useUsers.

src/lib/api/
  users.ts, requests.ts, notifications.ts, query-keys.ts.

src/types/
  Shared frontend domain types matching backend schemas.
```

Rules:

- Pages compose hooks and components.
- Hooks own TanStack Query usage.
- API modules own HTTP calls through `apiFetch`.
- Components receive typed props and do not call `fetch` directly.
- UI can hide unavailable actions, but backend remains the source of truth for
  permissions.

## Navigation

Authenticated pages use one app shell.

Primary nav:

```txt
Dashboard
Assigned to me
Created by me
Pool
Done
All requests    lead only
Users           lead only
New request
```

Top bar:

```txt
current page title
notification bell
current user name/email
role badge
logout menu item
```

Mobile:

- Collapse sidebar into a sheet/drawer.
- Keep primary actions reachable in the page header.
- Avoid table-only layouts on narrow screens; use list cards.

## Request Status And Priority UI

Statuses from the backend:

```txt
pending
acknowledged
in_progress
done
cancelled
```

Priority values:

```txt
low
medium
high
urgent
```

Badge guidance:

```txt
pending:       neutral
acknowledged: info
in_progress:  info with stronger emphasis
done:         success
cancelled:    muted danger

low:          muted
medium:       neutral
high:         warning
urgent:       danger
```

Badges must be readable without relying on color alone. Include text labels.

## Role-Based Actions

Roles:

```txt
fe
be
lead
```

Visibility rules:

```txt
Create request:
  fe, be, lead

View assigned requests:
  fe, be, lead

View created requests:
  fe, be, lead

View pool:
  fe, be, lead

View all requests:
  lead

Manage user roles:
  lead
```

Request actions:

```txt
Self assign:
  fe, be, or lead, only unassigned pool requests.

Acknowledge:
  assigned fe, be, or lead, when status is pending.

Start:
  assigned fe, be, or lead, when status is acknowledged.

Done with reply:
  assigned fe, be, or lead, when status is in_progress.

Cancel:
  creator or lead, when request is not done/cancelled.

Reassign:
  lead (any request), creator, or assignee.
```

Render disabled or hidden states consistently. If an action is hidden because of
role or status, the detail page should still show the current status and
timeline so the user understands request progress.

## Screen Requirements

### Login

Build from the login mockup, but simplify it.

Required:

- Product name.
- Short internal-tool description.
- Google OAuth button.
- Loading state while redirecting.
- Error alert for OAuth/session errors.

Avoid:

- Decorative image panel.
- Enterprise SSO button unless it is backed by a real flow.
- Marketing copy that implies features not implemented.

### Dashboard

Required:

- Current user summary.
- Counts for assigned, created, pool, done, and urgent requests when available.
- Recent requests list.
- Recent notifications or activity list.
- Lead-only link to all requests/users.

Data should come from backend list endpoints. If aggregate endpoints do not
exist yet, compute lightweight counts from fetched lists in the hook layer for
the MVP.

### Assigned To Me

Required:

- Filter by status and priority.
- Request list cards.
- Primary next action per request when available.
- Link to request detail.
- Empty state when no assigned requests exist.

### Created By Me

Required:

- Requests created by current user.
- Status and assignee visibility.
- Cancel action when allowed.
- Link to request detail.
- Empty state with link to create request.

### Pool

Required:

- Unassigned requests.
- Filter by priority.
- Self-assign action.
- Empty state when pool is empty.
- Accessible to `be` and `lead`.

### Done

Required:

- Completed requests relevant to the current user.
- Done reply preview.
- Completion timestamp when backend data is available.
- Link to detail.

### All Requests

Required:

- Lead-only.
- Filter by status, priority, creator, assignee where feasible.
- Request list or compact table.
- Link to detail.

### Create Request

Required:

- Title.
- Description.
- Priority.
- Optional assignee when backend allows it.
- Submit, cancel/back.
- Field validation.
- Success redirect to created request detail or created list.

### Request Detail

Required:

- Request title, description, priority, status, creator, assignee, timestamps.
- Action bar based on role and status.
- Done reply dialog with required reply.
- Reassign dialog where allowed.
- Cancel confirmation.
- Assignment history.
- Status timeline.
- Related notifications are optional for MVP.

### Admin Users

Required:

- Lead-only.
- User list.
- Role selector for each user.
- Save/update state.
- Error state for forbidden access.

## State Requirements

Every data-backed view needs these states:

```txt
loading:     skeleton or compact spinner matching the page layout
empty:       concise message plus one useful action where relevant
error:       retry action and readable message
forbidden:   explain that the role cannot access the view
success:     toast or inline confirmation after mutations
```

Mutation behavior:

- Disable the triggering control while the mutation is pending.
- Invalidate the relevant query keys after success.
- Show backend validation/permission errors as user-readable messages.
- Do not optimistically change workflow status unless rollback is implemented.

## API Mapping

Use `src/lib/api/client.ts` for all backend calls.

Required API modules:

```txt
src/lib/api/users.ts
  getCurrentUser()
  listUsers()
  updateUserRole(userId, role)

src/lib/api/requests.ts
  listRequests(params)
  getRequest(requestId)
  createRequest(input)
  assignRequest(requestId)
  reassignRequest(requestId, assigneeId)
  acknowledgeRequest(requestId)
  startRequest(requestId)
  completeRequest(requestId, reply)
  cancelRequest(requestId)
  getAssignmentHistory(requestId)
  getStatusLogs(requestId)

src/lib/api/notifications.ts
  listNotifications()
  markNotificationRead(notificationId)
  markAllNotificationsRead()
```

Query key pattern:

```txt
['current-user']
['users']
['requests', params]
['request', requestId]
['request-assignment-history', requestId]
['request-status-logs', requestId]
['notifications']
```

## Accessibility

Minimum requirements:

- Buttons and icon buttons have accessible names.
- Dialogs trap focus and close with Escape.
- Forms use labels connected to inputs.
- Invalid fields show text errors.
- Status and priority badges include text.
- Focus rings are visible.
- Color contrast meets normal app UI expectations.

## Implementation Phasing

Use this document as input for FE phase plans.

Recommended order:

```txt
FE Phase 1: Auth UI and current user
FE Phase 2: App shell, navigation, shared states
FE Phase 3: Request API hooks and request lists
FE Phase 4: Create request and request detail
FE Phase 5: Request actions and notifications
FE Phase 6: Admin users and role management
FE Phase 7: responsive polish, lint, build, browser verification
```

Before coding each phase, create a phase-specific plan under:

```txt
docs/superpowers/plans/YYYY-MM-DD-phase-N-<phase-name>-detail.md
```

Each phase plan must reference:

```txt
docs/frontend-ui-framework.md
docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
apps/web/README.md
```

## Done Criteria For Frontend

The frontend is ready for MVP review when:

```txt
npm run lint
npm run build
```

pass from `apps/web`, and the browser flow supports:

```txt
login
logout
current user display
role-aware navigation
create request
view created requests
view assigned requests
view pool
self-assign
acknowledge
start
done with reply
cancel
notifications
lead role management
lead all requests view
request detail timeline/history
mobile usable layout
```
