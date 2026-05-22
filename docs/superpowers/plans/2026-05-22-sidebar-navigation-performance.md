# Sidebar Navigation Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sidebar navigation between Dashboard, Pool, All requests, Assigned, Created, and Done feel responsive by reducing route-change API round trips, cutting heavy list-card render work, and limiting request-list payloads.

**Architecture:** Keep FastAPI as the source of truth for permissions and request views. Optimize the frontend list path by lifting shared data queries to the list parent, removing full workflow actions from list cards, and relying on detail pages for heavy action UI. Optimize backend list endpoints by adding explicit `limit` support and returning bounded, newest-first lists.

**Tech Stack:** Next.js 15 App Router, React 19, TanStack Query v5, TypeScript strict mode, Tailwind CSS v4, FastAPI, Supabase PostgreSQL, unittest.

---

## Root Cause Summary

Observed lag when clicking sidebar items like `Pool`, `All requests`, `Assigned`, and `Created` is mostly caused by:

- Each sidebar route mounts a new `RequestList`, which fetches `GET /requests?view=...`.
- `RequestCard` calls `useActiveUsers()` for every card and renders full `RequestActions`.
- `RequestActions` calls `useCurrentUser()` and creates mutation hooks for every card.
- `All requests` and `Done` can return unbounded lists from Supabase.
- Dashboard currently calls several request-list endpoints at once.

This plan intentionally does **not** replace Supabase. It reduces avoidable app work first.

## Files And Responsibilities

Backend:

- Modify: `apps/api/app/repositories/request_repository.py` - add bounded list queries with `limit`.
- Modify: `apps/api/app/services/request_service.py` - accept `limit` and enforce safe range.
- Modify: `apps/api/app/routes/requests.py` - expose `limit` query param.
- Test: `apps/api/tests/test_request_service_rules.py` - validate limit clamping/default behavior.

Frontend list performance:

- Modify: `apps/web/src/lib/api/requests.ts` - add optional `limit` param to `listRequests`.
- Modify: `apps/web/src/lib/api/query-keys.ts` - include request list params in query key.
- Modify: `apps/web/src/hooks/use-requests.ts` - support `limit`, raise stale time for list navigation.
- Modify: `apps/web/src/components/requests/request-list.tsx` - fetch active users/current user once and pass labels/action permissions down.
- Modify: `apps/web/src/components/requests/request-card.tsx` - make card presentational; remove `useActiveUsers()` and remove full `RequestActions` from list cards.
- Modify: `apps/web/src/components/requests/request-actions.tsx` - optionally accept `currentUser` prop so detail/list can avoid repeated hooks.
- Modify: `apps/web/src/components/requests/request-detail.tsx` - keep full actions on detail page.

Dashboard:

- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx` - use smaller limits per dashboard section and avoid fetching full done/all data.

Verification:

- Run backend unit tests.
- Run frontend lint/build.
- Run local browser smoke for route changes.

Required repo rule:

- Before editing any function/class/method, run GitNexus impact analysis if available. If GitNexus MCP is unavailable in the session, record that direct source inspection was used.

---

## Task 1: Add Bounded Request List API

**Files:**
- Modify: `apps/api/app/repositories/request_repository.py`
- Modify: `apps/api/app/services/request_service.py`
- Modify: `apps/api/app/routes/requests.py`
- Test: `apps/api/tests/test_request_service_rules.py`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis if available:

```txt
gitnexus_impact({target: "list_requests", direction: "upstream"})
gitnexus_impact({target: "list_all_requests", direction: "upstream"})
gitnexus_impact({target: "list_pool_requests", direction: "upstream"})
```

If unavailable, record:

```txt
GitNexus unavailable; used direct source inspection for list_requests and repository list functions.
```

- [ ] **Step 2: Add failing unit tests for limit behavior**

In `apps/api/tests/test_request_service_rules.py`, add:

```python
from unittest.mock import patch

from app.schemas.users import CurrentUser
from app.services import request_service


class RequestListLimitTests(unittest.TestCase):
    def test_list_requests_uses_default_limit(self):
        current_user = CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead",
            role="lead",
            is_active=True,
        )

        with patch(
            "app.services.request_service.request_repository.list_all_requests",
            return_value=[],
        ) as list_all:
            request_service.list_requests("all", current_user)

        list_all.assert_called_once_with(limit=50)

    def test_list_requests_clamps_large_limit(self):
        current_user = CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead",
            role="lead",
            is_active=True,
        )

        with patch(
            "app.services.request_service.request_repository.list_all_requests",
            return_value=[],
        ) as list_all:
            request_service.list_requests("all", current_user, limit=500)

        list_all.assert_called_once_with(limit=100)
```

- [ ] **Step 3: Run test and verify failure**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_rules"
```

Expected: FAIL because `list_requests` does not accept `limit` and repository functions do not accept `limit`.

- [ ] **Step 4: Add repository limits**

In `apps/api/app/repositories/request_repository.py`, change list functions to accept `limit: int = 50` and apply `.limit(limit)` before `.execute()`:

```python
def list_pool_requests(limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select("*")
        .is_("assigned_to", "null")
        .eq("status", "pending")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
```

Apply the same pattern to:

```txt
list_assigned_requests(user_id, limit=50)
list_created_requests(user_id, limit=50)
list_done_requests(limit=50)
list_all_requests(limit=50)
```

- [ ] **Step 5: Add service limit normalization**

In `apps/api/app/services/request_service.py`, add:

```python
DEFAULT_REQUEST_LIST_LIMIT = 50
MAX_REQUEST_LIST_LIMIT = 100


def normalize_request_list_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_REQUEST_LIST_LIMIT

    return max(1, min(limit, MAX_REQUEST_LIST_LIMIT))
```

Change signature:

```python
def list_requests(
    view: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    normalized_limit = normalize_request_list_limit(limit)
```

Pass `normalized_limit` into all repository list functions.

- [ ] **Step 6: Add route query param**

In `apps/api/app/routes/requests.py`, change:

```python
async def list_requests(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    view: str = "assigned",
    limit: int | None = None,
):
    require_active_current_user(current_user)
    return request_service.list_requests(view, current_user, limit)
```

- [ ] **Step 7: Run backend tests**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run python -m unittest discover tests"
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```powershell
rtk git add apps/api/app/repositories/request_repository.py apps/api/app/services/request_service.py apps/api/app/routes/requests.py apps/api/tests/test_request_service_rules.py
rtk git commit -m "perf: bound request list queries"
```

---

## Task 2: Make Request Cards Presentational

**Files:**
- Modify: `apps/web/src/components/requests/request-list.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`
- Modify: `apps/web/src/components/requests/request-actions.tsx`
- Modify: `apps/web/src/components/requests/request-detail.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis if available:

```txt
gitnexus_impact({target: "RequestCard", direction: "upstream"})
gitnexus_impact({target: "RequestList", direction: "upstream"})
gitnexus_impact({target: "RequestActions", direction: "upstream"})
```

- [ ] **Step 2: Change RequestCard props**

In `apps/web/src/components/requests/request-card.tsx`, remove:

```ts
import { RequestActions } from "@/components/requests/request-actions";
import { findUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
```

Change component signature:

```tsx
export function RequestCard({
  request,
  creatorLabel,
  assigneeLabel,
}: {
  request: InternalRequest;
  creatorLabel: string;
  assigneeLabel: string;
}) {
  const nextAction = getNextActionLabel(request);
```

Remove:

```tsx
<RequestActions request={request} />
```

Keep only the detail link and compact `Next action` text.

- [ ] **Step 3: Lift active users query to RequestList**

In `apps/web/src/components/requests/request-list.tsx`, import:

```ts
import { findUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
```

Inside `RequestList`:

```ts
const activeUsersQuery = useActiveUsers();
```

When rendering cards:

```tsx
{filteredRequests.map((request) => (
  <RequestCard
    key={request.id}
    request={request}
    creatorLabel={findUserLabel(activeUsersQuery.data, request.created_by)}
    assigneeLabel={findUserLabel(activeUsersQuery.data, request.assigned_to)}
  />
))}
```

- [ ] **Step 4: Keep full action UI only on detail**

Confirm `apps/web/src/components/requests/request-detail.tsx` still renders:

```tsx
<RequestActions request={request} />
```

Do not remove actions from detail page.

- [ ] **Step 5: Optional current user prop**

If `RequestActions` is only used in detail, it can keep its own `useCurrentUser()`. If list still needs a small primary action later, add this prop instead:

```tsx
export function RequestActions({
  request,
  currentUser: currentUserProp,
}: {
  request: InternalRequest;
  currentUser?: CurrentUser;
}) {
  const { data: hookCurrentUser } = useCurrentUser();
  const currentUser = currentUserProp ?? hookCurrentUser;
```

Do not add this prop unless needed by the final implementation.

- [ ] **Step 6: Verify frontend**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
rtk git add apps/web/src/components/requests/request-list.tsx apps/web/src/components/requests/request-card.tsx apps/web/src/components/requests/request-actions.tsx apps/web/src/components/requests/request-detail.tsx
rtk git commit -m "perf: lighten request list cards"
```

---

## Task 3: Wire List Limits And Longer Navigation Cache

**Files:**
- Modify: `apps/web/src/lib/api/requests.ts`
- Modify: `apps/web/src/lib/api/query-keys.ts`
- Modify: `apps/web/src/hooks/use-requests.ts`
- Modify: `apps/web/src/components/requests/request-list.tsx`

- [ ] **Step 1: Update API client**

In `apps/web/src/lib/api/requests.ts`, change:

```ts
export interface ListRequestsParams {
  view: RequestView;
  limit?: number;
}

export function listRequests({ view, limit = 50 }: ListRequestsParams) {
  const searchParams = new URLSearchParams({
    view,
    limit: String(limit),
  });
  return apiFetch<InternalRequest[]>(`/requests?${searchParams.toString()}`);
}
```

- [ ] **Step 2: Update query keys**

In `apps/web/src/lib/api/query-keys.ts`, change list key:

```ts
list: (view: RequestView, limit: number) =>
  ["requests", view, { limit }] as const,
```

- [ ] **Step 3: Update request hook**

In `apps/web/src/hooks/use-requests.ts`, change:

```ts
export function useRequests(view: RequestView, limit = 50) {
  return useQuery({
    queryKey: queryKeys.requests.list(view, limit),
    queryFn: () => listRequests({ view, limit }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}
```

The longer `staleTime` makes sidebar back-and-forth instant for recently visited views.

- [ ] **Step 4: Pass limit from RequestList**

In `apps/web/src/components/requests/request-list.tsx`, add prop:

```ts
limit?: number;
```

Default:

```ts
limit = 50,
```

Call:

```ts
useRequests(view, limit);
```

- [ ] **Step 5: Verify frontend**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
rtk git add apps/web/src/lib/api/requests.ts apps/web/src/lib/api/query-keys.ts apps/web/src/hooks/use-requests.ts apps/web/src/components/requests/request-list.tsx
rtk git commit -m "perf: cache bounded request views"
```

---

## Task 4: Reduce Dashboard API Fan-Out

**Files:**
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Inspect current dashboard queries**

Confirm current dashboard calls:

```txt
useCurrentUser()
useRequests("assigned")
useRequests("created")
useRequests("pool")
useRequests("done")
useNotifications(false)
```

- [ ] **Step 2: Use smaller limits**

Change dashboard request hooks to:

```ts
const assignedQuery = useRequests("assigned", 10);
const createdQuery = useRequests("created", 10);
const poolQuery = useRequests("pool", 10);
const doneQuery = useRequests("done", 10);
```

If dashboard only needs counts and recent items, use displayed array lengths as approximate visible counts and link to full pages for complete data.

- [ ] **Step 3: Avoid rendering full request cards on dashboard**

If dashboard currently renders `RequestCard`, replace with compact rows:

```tsx
<Link
  key={request.id}
  href={`/requests/${request.id}`}
  className="flex items-center justify-between rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm"
>
  <span className="truncate font-medium">{request.title}</span>
  <span className="text-xs text-[#6b7280]">{request.status}</span>
</Link>
```

Do not render `RequestActions` on dashboard.

- [ ] **Step 4: Verify frontend**

Run:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run lint"
rtk powershell -NoProfile -Command "cd apps\web; npm run build"
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
rtk git add 'apps/web/src/app/(dashboard)/dashboard/page.tsx'
rtk git commit -m "perf: reduce dashboard request fan-out"
```

---

## Task 5: Measure Navigation Improvement

**Files:**
- Create: `docs/sidebar-navigation-performance.md`

- [ ] **Step 1: Start backend and frontend**

Backend:

```powershell
rtk powershell -NoProfile -Command "cd apps\api; uv --cache-dir .uv-cache run uvicorn app.main:app --port 8000"
```

Frontend:

```powershell
rtk powershell -NoProfile -Command "cd apps\web; npm run dev"
```

- [ ] **Step 2: Browser manual timing**

In Chrome/Edge DevTools Network tab, measure these clicks after initial app load:

```txt
Dashboard -> Pool
Pool -> All requests
All requests -> Assigned
Assigned -> Created
Created -> Pool
```

Record:

```txt
Route clicked
Number of API requests
Slowest API endpoint
Slowest API duration
UI perceived response: instant / acceptable / laggy
```

- [ ] **Step 3: Create performance note**

Create `docs/sidebar-navigation-performance.md`:

```md
# Sidebar Navigation Performance

## Changes

- Request lists are bounded.
- Request cards are presentational on list pages.
- Full request actions render on detail pages only.
- Request list query cache is kept warm for sidebar navigation.
- Dashboard uses smaller request limits.

## Manual Measurements

| Navigation | API count | Slowest endpoint | Slowest duration | Perceived response |
| --- | ---: | --- | ---: | --- |
| Dashboard -> Pool |  |  |  |  |
| Pool -> All requests |  |  |  |  |
| All requests -> Assigned |  |  |  |  |
| Assigned -> Created |  |  |  |  |
| Created -> Pool |  |  |  |  |

## Remaining Bottlenecks

List any endpoint still over 500ms.
```

- [ ] **Step 4: Commit**

Run:

```powershell
rtk git add docs/sidebar-navigation-performance.md
rtk git commit -m "docs: record sidebar navigation performance"
```

---

## Acceptance Criteria

- Sidebar clicks to recently visited request views feel instant or near-instant because cached list data is reused for 60 seconds.
- `RequestCard` no longer calls `useActiveUsers()`.
- List pages no longer render full `RequestActions` on every card.
- Request list API defaults to `limit=50` and clamps large values to `100`.
- Dashboard request sections use small limits and do not render heavy card actions.
- Backend tests pass.
- Frontend lint and build pass.
- Manual performance note documents before/after navigation behavior.

## Follow-Up If Still Laggy

Only do these after Task 5 measurements prove they are needed:

- Add `GET /dashboard/summary` to replace multiple dashboard queries.
- Add cursor pagination for request lists.
- Replace `supabase.auth.get_user(token)` with local JWT verification.
- Add backend timing logs around Supabase queries to identify slow endpoints.

