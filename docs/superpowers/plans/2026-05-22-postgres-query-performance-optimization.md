# Postgres Query Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Supabase Postgres performance for request lists, dashboard reads, notifications, and audit logs without changing product behavior.

**Architecture:** Keep the existing `routes -> services -> repositories -> Supabase` backend boundary. Add indexes that match the current access patterns, narrow repository projections where full rows are unnecessary, and cap unbounded reads at the service/route boundary.

**Tech Stack:** Supabase PostgreSQL, FastAPI, Supabase Python client, Pydantic, Python `unittest`, GitNexus impact analysis.

---

## Scope Boundary

This plan focuses only on database/query performance. It does not replace the broader backend API performance plan at `docs/superpowers/plans/2026-05-22-backend-api-performance-optimization.md`.

Do not change frontend UI, auth strategy, notification delivery behavior, or request workflow rules in this plan.

## Existing Findings

The schema is already strong in several areas:

- Foreign key columns such as `internal_requests.created_by`, `internal_requests.assigned_to`, `assignment_history.request_id`, `request_status_logs.request_id`, and `notifications.user_id` are indexed.
- `internal_requests.tags` has a GIN index.
- `idx_internal_requests_pool` is a good partial index for `assigned_to is null and status = 'pending'` pool reads.
- `idx_notifications_user_unread` is a good partial index for unread notification reads.

Remaining optimization targets:

- Composite indexes are missing for common filtered-and-ordered request list queries.
- `request_repository.py` uses `select("*")` for list views even when the API mostly needs response fields.
- `list_notifications`, `list_assignment_history`, and `list_status_logs` are unbounded.
- `get_dashboard_data` uses an `or_` predicate that can be harder for Postgres to optimize than separate index-friendly reads.

## Files And Responsibilities

- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql` - add composite and partial indexes that match current repository predicates and sort order.
- Modify: `docs/database-schema.md` - document the performance index intent.
- Modify: `apps/api/app/repositories/request_repository.py` - centralize request projections and optionally split dashboard reads into index-friendly queries.
- Modify: `apps/api/app/repositories/notification_repository.py` - add bounded notification reads and use explicit selected columns.
- Modify: `apps/api/app/services/notifications.py` - normalize notification list limits.
- Modify: `apps/api/app/routes/notifications.py` - expose optional bounded `limit` query parameter while preserving current default behavior.
- Modify: `apps/api/app/repositories/assignment_repository.py` - add bounded history reads and explicit columns.
- Modify: `apps/api/app/repositories/status_log_repository.py` - add bounded status-log reads and explicit columns.
- Modify: `apps/api/app/services/request_service.py` - pass bounded audit-log limits from service calls.
- Modify: `apps/api/app/routes/requests.py` - expose optional bounded `limit` for assignment history and status logs if route functions currently call the service without a limit.
- Test: `apps/api/tests/test_notification_routes.py` - verify notification limit parameter is passed.
- Test: `apps/api/tests/test_request_routes.py` - verify history/log limit parameters are passed if the route contract changes.
- Test: `apps/api/tests/test_dashboard_service.py` - verify dashboard summary behavior stays unchanged after repository query refactor.
- Modify: `docs/api-contract.md` - document optional limit parameters if route contracts are extended.

Required repo rule:

- Before editing existing Python functions/classes/methods, run `gitnexus_impact` for each modified symbol.
- Before committing, run `gitnexus_detect_changes()` and confirm the affected scope is limited to expected repository/service/route flows.

---

## Task 1: Add Query-Matching Postgres Indexes

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `docs/database-schema.md`

- [ ] **Step 1: Confirm current indexes**

Run this SQL in Supabase SQL editor or via the SQL client connected to the project:

```sql
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'internal_requests',
    'notifications',
    'assignment_history',
    'request_status_logs',
    'notification_deliveries'
  )
order by tablename, indexname;
```

Expected: existing single-column indexes and the current partial indexes are present.

- [ ] **Step 2: Add composite request indexes to schema**

In `DB_SCHEMA_TEAM_REQUEST_HUB.sql`, after the existing `idx_internal_requests_created_at` index, add:

```sql
create index if not exists idx_internal_requests_assigned_to_created_at
  on public.internal_requests(assigned_to, created_at desc)
  where assigned_to is not null;

create index if not exists idx_internal_requests_created_by_created_at
  on public.internal_requests(created_by, created_at desc);

create index if not exists idx_internal_requests_status_created_at
  on public.internal_requests(status, created_at desc);

create index if not exists idx_internal_requests_done_created_at
  on public.internal_requests(created_at desc)
  where status = 'done';
```

Rationale:

```txt
list_assigned_requests: where assigned_to = ? order by created_at desc limit ?
list_created_requests: where created_by = ? order by created_at desc limit ?
list_done_requests: where status = 'done' order by created_at desc limit ?
dashboard reads: repeated created_at-desc bounded list patterns
```

- [ ] **Step 3: Add notification delivery index for pending work**

In `DB_SCHEMA_TEAM_REQUEST_HUB.sql`, after `idx_notification_deliveries_status`, add:

```sql
create index if not exists idx_notification_deliveries_pending_created_at
  on public.notification_deliveries(created_at)
  where status = 'pending';
```

This supports future retry or queue scans without adding overhead to sent/failed rows.

- [ ] **Step 4: Document index intent**

In `docs/database-schema.md`, add this section after `## Tables`:

```md
## Performance Indexes

Request list endpoints are optimized for bounded `created_at desc` reads by assignee, creator, status, and the unassigned pending pool. Notification reads are optimized by user and unread state. Audit history tables are indexed by request id so detail views can load timeline data without scanning all history rows.
```

- [ ] **Step 5: Verify index DDL syntax**

Run the relevant schema statements in a Supabase branch or local disposable database before applying to production.

Expected: each `create index if not exists` statement succeeds.

- [ ] **Step 6: Commit**

```bash
git add DB_SCHEMA_TEAM_REQUEST_HUB.sql docs/database-schema.md
git commit -m "perf: add query-matching postgres indexes"
```

---

## Task 2: Narrow Request Repository Projections

**Files:**
- Modify: `apps/api/app/repositories/request_repository.py`
- Test: `apps/api/tests/test_dashboard_service.py`

- [ ] **Step 1: Run impact analysis**

Run:

```txt
gitnexus_impact({target: "list_assigned_requests", direction: "upstream", file_path: "apps/api/app/repositories/request_repository.py"})
gitnexus_impact({target: "list_created_requests", direction: "upstream", file_path: "apps/api/app/repositories/request_repository.py"})
gitnexus_impact({target: "list_pool_requests", direction: "upstream", file_path: "apps/api/app/repositories/request_repository.py"})
gitnexus_impact({target: "list_done_requests", direction: "upstream", file_path: "apps/api/app/repositories/request_repository.py"})
gitnexus_impact({target: "get_dashboard_data", direction: "upstream", file_path: "apps/api/app/repositories/request_repository.py"})
```

Proceed only if risk is not HIGH or CRITICAL. If risk is HIGH or CRITICAL, stop and report it before editing.

- [ ] **Step 2: Add projection constants**

In `apps/api/app/repositories/request_repository.py`, add under `REQUESTS_TABLE`:

```python
REQUEST_DETAIL_COLUMNS = "*"
REQUEST_LIST_COLUMNS = ",".join(
    [
        "id",
        "title",
        "description",
        "tags",
        "priority",
        "status",
        "created_by",
        "assigned_to",
        "reference_links",
        "reply",
        "acknowledged_at",
        "started_at",
        "done_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    ]
)
```

Keep `REQUEST_DETAIL_COLUMNS = "*"` because workflow mutation and detail code may rely on the full row.

- [ ] **Step 3: Replace list `select("*")` calls**

Change only list-style reads from:

```python
.select("*")
```

to:

```python
.select(REQUEST_LIST_COLUMNS)
```

Apply to:

```txt
list_assigned_requests
list_created_requests
list_pool_requests
list_done_requests
list_all_requests
get_dashboard_data
```

Leave these as `select("*")` or switch to `REQUEST_DETAIL_COLUMNS` without changing behavior:

```txt
get_request_or_404
create_request
update_request
assign_if_unassigned
```

- [ ] **Step 4: Verify dashboard service tests**

Run:

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service
```

Expected: PASS.

- [ ] **Step 5: Verify request service tests**

Run:

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow tests.test_request_service_rules
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/repositories/request_repository.py apps/api/tests/test_dashboard_service.py
git commit -m "perf: narrow request list projections"
```

---

## Task 3: Bound Notification Reads

**Files:**
- Modify: `apps/api/app/repositories/notification_repository.py`
- Modify: `apps/api/app/services/notifications.py`
- Modify: `apps/api/app/routes/notifications.py`
- Modify: `docs/api-contract.md`
- Test: `apps/api/tests/test_notification_routes.py`

- [ ] **Step 1: Run impact analysis**

Run:

```txt
gitnexus_impact({target: "list_notifications", direction: "upstream", file_path: "apps/api/app/repositories/notification_repository.py"})
gitnexus_impact({target: "list_notifications", direction: "upstream", file_path: "apps/api/app/services/notifications.py"})
gitnexus_api_impact({route: "/notifications", repo: "Team-Request-Hub"})
```

Proceed only if risk is not HIGH or CRITICAL. If risk is HIGH or CRITICAL, stop and report it before editing.

- [ ] **Step 2: Add route test first**

In `apps/api/tests/test_notification_routes.py`, update `test_list_notifications_passes_unread_only_param` to expect the default limit:

```python
def test_list_notifications_passes_unread_only_param(self):
    app.dependency_overrides[get_current_user] = lambda: _user()

    with patch("app.services.notifications.list_notifications", return_value=[]) as mock:
        TestClient(app).get("/notifications?unread_only=true")

    mock.assert_called_once_with("user-1", True, 50)
```

Add:

```python
def test_list_notifications_passes_limit_param(self):
    app.dependency_overrides[get_current_user] = lambda: _user()

    with patch("app.services.notifications.list_notifications", return_value=[]) as mock:
        response = TestClient(app).get("/notifications?limit=25")

    self.assertEqual(response.status_code, 200)
    mock.assert_called_once_with("user-1", False, 25)
```

- [ ] **Step 3: Run test and confirm failure**

Run:

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_notification_routes
```

Expected: FAIL because route/service signatures do not accept `limit` yet.

- [ ] **Step 4: Add service limit normalization**

In `apps/api/app/services/notifications.py`, add constants near `TELEGRAM_TYPES`:

```python
DEFAULT_NOTIFICATION_LIST_LIMIT = 50
MAX_NOTIFICATION_LIST_LIMIT = 100
```

Add helper:

```python
def normalize_notification_list_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_NOTIFICATION_LIST_LIMIT

    return max(1, min(limit, MAX_NOTIFICATION_LIST_LIMIT))
```

Change `list_notifications` to:

```python
def list_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int | None = None,
) -> list[dict]:
    normalized_limit = normalize_notification_list_limit(limit)
    return notification_repository.list_notifications(
        user_id,
        unread_only,
        limit=normalized_limit,
    )
```

- [ ] **Step 5: Add repository limit and projection**

In `apps/api/app/repositories/notification_repository.py`, add near imports:

```python
NOTIFICATION_COLUMNS = "id,user_id,request_id,type,message,is_read,created_at"
```

Change `list_notifications` to:

```python
def list_notifications(
    user_id: str,
    unread_only: bool = False,
    limit: int = 50,
) -> list[dict]:
    query = (
        get_supabase_admin()
        .table("notifications")
        .select(NOTIFICATION_COLUMNS)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
    )

    if unread_only:
        query = query.eq("is_read", False)

    result = query.limit(limit).execute()
    return result.data or []
```

- [ ] **Step 6: Add route limit parameter**

In `apps/api/app/routes/notifications.py`, change the route function to:

```python
@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    unread_only: bool = False,
    limit: int = 50,
):
    require_active_current_user(current_user)
    return notifications.list_notifications(current_user.id, unread_only, limit)
```

- [ ] **Step 7: Update API docs**

In `docs/api-contract.md`, replace:

```txt
GET  /notifications?unread_only=false
```

with:

```txt
GET  /notifications?unread_only=false&limit=50
```

Add below it:

```md
`limit` defaults to `50` and is capped by the backend at `100`.
```

- [ ] **Step 8: Verify notification tests**

Run:

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_notification_routes
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/app/repositories/notification_repository.py apps/api/app/services/notifications.py apps/api/app/routes/notifications.py apps/api/tests/test_notification_routes.py docs/api-contract.md
git commit -m "perf: bound notification reads"
```

---

## Task 4: Bound Audit History Reads

**Files:**
- Modify: `apps/api/app/repositories/assignment_repository.py`
- Modify: `apps/api/app/repositories/status_log_repository.py`
- Modify: `apps/api/app/services/request_service.py`
- Modify: `apps/api/app/routes/requests.py`
- Modify: `docs/api-contract.md`
- Test: `apps/api/tests/test_request_routes.py`

- [ ] **Step 1: Run impact analysis**

Run:

```txt
gitnexus_impact({target: "list_assignment_history", direction: "upstream", file_path: "apps/api/app/repositories/assignment_repository.py"})
gitnexus_impact({target: "list_status_logs", direction: "upstream", file_path: "apps/api/app/repositories/status_log_repository.py"})
gitnexus_impact({target: "list_assignment_history", direction: "upstream", file_path: "apps/api/app/services/request_service.py"})
gitnexus_impact({target: "list_status_logs", direction: "upstream", file_path: "apps/api/app/services/request_service.py"})
```

Proceed only if risk is not HIGH or CRITICAL. If risk is HIGH or CRITICAL, stop and report it before editing.

- [ ] **Step 2: Add request route tests first**

In `apps/api/tests/test_request_routes.py`, add or update route tests for history/log limit passing:

```python
def test_assignment_history_passes_limit_param(self):
    app.dependency_overrides[get_current_user] = lambda: _user()

    with patch("app.routes.requests.request_service.list_assignment_history", return_value=[]) as mock:
        response = TestClient(app).get("/requests/request-1/assignment-history?limit=25")

    self.assertEqual(response.status_code, 200)
    mock.assert_called_once_with("request-1", _user(), limit=25)


def test_status_logs_passes_limit_param(self):
    app.dependency_overrides[get_current_user] = lambda: _user()

    with patch("app.routes.requests.request_service.list_status_logs", return_value=[]) as mock:
        response = TestClient(app).get("/requests/request-1/status-logs?limit=25")

    self.assertEqual(response.status_code, 200)
    mock.assert_called_once_with("request-1", _user(), limit=25)
```

If `_user()` returns new object instances that do not compare equal in the existing tests, assert positional fields instead:

```python
args = mock.call_args.args
self.assertEqual(args[0], "request-1")
self.assertEqual(args[1].id, "user-1")
self.assertEqual(mock.call_args.kwargs["limit"], 25)
```

- [ ] **Step 3: Add repository projections and limits**

In `apps/api/app/repositories/assignment_repository.py`, add:

```python
ASSIGNMENT_HISTORY_COLUMNS = "id,request_id,from_user_id,to_user_id,assigned_by,reason,created_at"
```

Change `list_assignment_history` to:

```python
def list_assignment_history(request_id: str, limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("assignment_history")
        .select(ASSIGNMENT_HISTORY_COLUMNS)
        .eq("request_id", request_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
```

In `apps/api/app/repositories/status_log_repository.py`, add:

```python
STATUS_LOG_COLUMNS = "id,request_id,from_status,to_status,changed_by,reason,created_at"
```

Change `list_status_logs` to:

```python
def list_status_logs(request_id: str, limit: int = 50) -> list[dict]:
    result = (
        get_supabase_admin()
        .table("request_status_logs")
        .select(STATUS_LOG_COLUMNS)
        .eq("request_id", request_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
```

- [ ] **Step 4: Add service limit normalization**

In `apps/api/app/services/request_service.py`, near the existing request-list limit constants, add:

```python
DEFAULT_HISTORY_LIST_LIMIT = 50
MAX_HISTORY_LIST_LIMIT = 100
```

Add helper:

```python
def normalize_history_list_limit(limit: int | None) -> int:
    if limit is None:
        return DEFAULT_HISTORY_LIST_LIMIT

    return max(1, min(limit, MAX_HISTORY_LIST_LIMIT))
```

Change service functions to:

```python
def list_assignment_history(
    request_id: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    return assignment_repository.list_assignment_history(
        request_id,
        limit=normalize_history_list_limit(limit),
    )


def list_status_logs(
    request_id: str,
    current_user: CurrentUser,
    limit: int | None = None,
) -> list[dict]:
    request = request_repository.get_request_or_404(request_id)
    ensure_can_view_request(current_user, request)
    return status_log_repository.list_status_logs(
        request_id,
        limit=normalize_history_list_limit(limit),
    )
```

- [ ] **Step 5: Add route limit parameter**

In `apps/api/app/routes/requests.py`, update the history route functions to accept `limit: int = 50` and pass it to the service:

```python
return request_service.list_assignment_history(request_id, current_user, limit=limit)
```

and:

```python
return request_service.list_status_logs(request_id, current_user, limit=limit)
```

- [ ] **Step 6: Update API docs**

In `docs/api-contract.md`, replace:

```txt
GET    /requests/{request_id}/assignment-history
GET    /requests/{request_id}/status-logs
```

with:

```txt
GET    /requests/{request_id}/assignment-history?limit=50
GET    /requests/{request_id}/status-logs?limit=50
```

Add:

```md
History and status-log `limit` values default to `50` and are capped by the backend at `100`.
```

- [ ] **Step 7: Verify request route tests**

Run:

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_request_routes
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/app/repositories/assignment_repository.py apps/api/app/repositories/status_log_repository.py apps/api/app/services/request_service.py apps/api/app/routes/requests.py apps/api/tests/test_request_routes.py docs/api-contract.md
git commit -m "perf: bound request audit reads"
```

---

## Task 5: Optional Dashboard Query Split

**Files:**
- Modify: `apps/api/app/repositories/request_repository.py`
- Modify: `apps/api/app/services/dashboard.py`
- Test: `apps/api/tests/test_dashboard_service.py`

- [ ] **Step 1: Measure before changing**

Use Supabase SQL editor with representative data and run:

```sql
explain analyze
select *
from public.internal_requests
where assigned_to = '00000000-0000-0000-0000-000000000000'
   or created_by = '00000000-0000-0000-0000-000000000000'
   or (status = 'pending' and assigned_to is null)
order by created_at desc
limit 200;
```

Replace the UUID with a real user id. If the plan uses indexes efficiently and latency is acceptable, skip this task.

- [ ] **Step 2: Run impact analysis if proceeding**

Run:

```txt
gitnexus_impact({target: "get_dashboard_data", direction: "upstream", file_path: "apps/api/app/repositories/request_repository.py"})
gitnexus_impact({target: "get_dashboard_summary", direction: "upstream", file_path: "apps/api/app/services/dashboard.py"})
```

Proceed only if risk is not HIGH or CRITICAL. If risk is HIGH or CRITICAL, stop and report it before editing.

- [ ] **Step 3: Add index-friendly repository helper**

In `apps/api/app/repositories/request_repository.py`, add:

```python
def get_dashboard_data_split(user_id: str, limit: int = 50) -> list[dict]:
    rows_by_id: dict[str, dict] = {}

    for row in list_assigned_requests(user_id, limit=limit):
        rows_by_id[row["id"]] = row

    for row in list_created_requests(user_id, limit=limit):
        rows_by_id[row["id"]] = row

    for row in list_pool_requests(limit=limit):
        rows_by_id[row["id"]] = row

    for row in list_done_requests(limit=limit, user_id=user_id):
        rows_by_id[row["id"]] = row

    return sorted(
        rows_by_id.values(),
        key=lambda item: item.get("created_at") or "",
        reverse=True,
    )[: limit * 4]
```

This trades one complex `or_` query for four simple bounded reads that match the composite/partial indexes.

- [ ] **Step 4: Update dashboard service only if needed**

If measurement showed the `or_` query is slow, change `apps/api/app/services/dashboard.py` line that calls `get_dashboard_data` to:

```python
raw_requests = request_repository.get_dashboard_data_split(current_user.id)
```

Do not change dashboard response shape.

- [ ] **Step 5: Verify dashboard tests**

Run:

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service
```

Expected: PASS after updating test patches from `get_dashboard_data` to `get_dashboard_data_split` only if the service was changed.

- [ ] **Step 6: Commit if changed**

```bash
git add apps/api/app/repositories/request_repository.py apps/api/app/services/dashboard.py apps/api/tests/test_dashboard_service.py
git commit -m "perf: split dashboard request reads"
```

---

## Task 6: Final Verification And Change Detection

**Files:**
- No code files unless fixing verification failures.

- [ ] **Step 1: Run backend tests**

Run:

```bash
cd apps/api && uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

- [ ] **Step 2: Run GitNexus change detection**

Run:

```txt
gitnexus_detect_changes({scope: "all", repo: "Team-Request-Hub"})
```

Expected: changed symbols are limited to request, notification, assignment, status-log repository/service/route flows plus schema/docs.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff --stat
git diff -- DB_SCHEMA_TEAM_REQUEST_HUB.sql docs/database-schema.md docs/api-contract.md apps/api/app/repositories/request_repository.py apps/api/app/repositories/notification_repository.py apps/api/app/services/notifications.py apps/api/app/routes/notifications.py apps/api/app/repositories/assignment_repository.py apps/api/app/repositories/status_log_repository.py apps/api/app/services/request_service.py apps/api/app/routes/requests.py apps/api/tests/test_notification_routes.py apps/api/tests/test_request_routes.py apps/api/tests/test_dashboard_service.py
```

Expected: no unrelated files or unrelated behavior changes.

- [ ] **Step 4: Optional database plan check**

After indexes are applied to a Supabase branch or staging database, run `explain analyze` for these representative queries:

```sql
explain analyze
select id, title, status, created_at
from public.internal_requests
where assigned_to = '00000000-0000-0000-0000-000000000000'
order by created_at desc
limit 50;

explain analyze
select id, title, status, created_at
from public.internal_requests
where created_by = '00000000-0000-0000-0000-000000000000'
order by created_at desc
limit 50;

explain analyze
select id, type, is_read, created_at
from public.notifications
where user_id = '00000000-0000-0000-0000-000000000000'
  and is_read = false
order by created_at desc
limit 50;
```

Expected: query plans use the new composite indexes or existing partial indexes instead of full sequential scans on large tables.

---

## Acceptance Criteria

- Request list queries have matching composite indexes for filter plus `created_at desc` ordering.
- Notification list endpoint returns at most 50 rows by default and at most 100 rows when requested.
- Assignment history and status-log endpoints return at most 50 rows by default and at most 100 rows when requested.
- Repository list reads use explicit projections rather than `select("*")` where behavior allows.
- Dashboard behavior and response shape stay unchanged.
- Backend test suite passes.
- GitNexus change detection shows only expected flows are affected.

## Expected Performance Result

- Request list views avoid bitmap/index combination work for common `where + order by + limit` patterns.
- Notification and audit endpoints cannot accidentally return unbounded result sets.
- Network payloads from Supabase to FastAPI are smaller for list endpoints.
- Dashboard query behavior remains measurable, with a safe optional split-query path if `or_` plans poorly on real data.
