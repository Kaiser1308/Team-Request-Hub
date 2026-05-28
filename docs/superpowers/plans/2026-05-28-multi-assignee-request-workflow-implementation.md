# Multi-Assignee Request Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-assignee request support with shared request status, assignee action audit logs, add/remove assignee workflow, and consistent red unread-count badges.

**Architecture:** Use `request_assignees` as the backend source of truth while keeping `internal_requests.assigned_to` as a migration compatibility field. Backend services keep workflow rules and side effects; repositories own Supabase table access; frontend consumes `assignees[]` and stops driving UI from `assigned_to`.

**Tech Stack:** FastAPI, Pydantic, Supabase PostgreSQL, Python `unittest`, Next.js 15 App Router, React 19, TypeScript, TanStack Query v5, Tailwind CSS v4.

---

## File Map

Backend schema and docs:

- Modify `DB_SCHEMA_TEAM_REQUEST_HUB.sql`: add `request_assignees`, indexes, RLS policy coverage, and backfill insert from `internal_requests.assigned_to`.
- Modify `docs/database-schema.md`: document `request_assignees`.
- Modify `docs/api-contract.md`: document `assignee_ids`, `assignees[]`, add/remove endpoints.
- Modify `docs/permissions.md`: document multi-assignee visibility and add/remove rules.

Backend application:

- Modify `apps/api/app/schemas/requests.py`: add `assignee_ids`, `assignees`, add/remove payload schemas.
- Create `apps/api/app/repositories/request_assignee_repository.py`: table access for current assignees.
- Modify `apps/api/app/repositories/request_repository.py`: list by assignee membership and pool by no assignees.
- Modify `apps/api/app/core/permissions.py`: recognize `assignee_ids`/`assignees` membership with `assigned_to` fallback.
- Modify `apps/api/app/services/request_service.py`: create/add/remove/self-assign/status/done/list enrichment.
- Modify `apps/api/app/routes/requests.py`: add assignee endpoints and multi-recipient Telegram background dispatch.
- Modify `apps/api/app/services/dashboard.py`: compute counts from `assignees[]` membership after repository changes.

Backend tests:

- Modify `apps/api/tests/test_request_service_create_assign_cancel.py`: create/self-assign/cancel visibility tests.
- Modify `apps/api/tests/test_request_service_workflow.py`: status, list enrichment, add/remove workflow tests.
- Modify `apps/api/tests/test_permissions.py`: multi-assignee permission helper tests.
- Modify `apps/api/tests/test_dashboard_service.py`: dashboard count tests using `assignees[]`.
- Modify `apps/api/tests/test_request_routes.py`: add/remove route tests.

Frontend application:

- Modify `apps/web/src/types/index.ts`: add `assignees?: UserSummary[]`.
- Modify `apps/web/src/lib/api/requests.ts`: create payload and add/remove assignee API helpers.
- Modify `apps/web/src/hooks/use-request-actions.ts`: add mutations and cache invalidation.
- Modify `apps/web/src/components/requests/request-form.tsx`: multi-select assignees.
- Create `apps/web/src/components/requests/assignee-list.tsx`: shared plural assignee display.
- Create `apps/web/src/components/requests/assignee-management.tsx`: add/remove controls in detail.
- Modify `apps/web/src/components/requests/request-card.tsx`: render plural assignees and pool state.
- Modify `apps/web/src/components/requests/request-detail.tsx`: render plural assignees and management controls.
- Modify `apps/web/src/components/requests/request-actions.tsx`: use `assignees[]` membership for permissions.
- Modify or remove `apps/web/src/components/requests/reassign-dialog.tsx`: no whole-list replacement; replace usage with add/remove management.
- Create `apps/web/src/components/shared/unread-count-badge.tsx`: one red badge component.
- Modify `apps/web/src/components/app/app-shell.tsx`: topbar notification badge uses shared red badge.
- Modify `apps/web/src/app/(dashboard)/dashboard/page.tsx`: dashboard unread count uses shared red badge.

Verification commands:

- Backend tests: `uv --cache-dir .uv-cache run python -m unittest discover tests` from `apps/api`.
- Frontend lint: `npm run lint` from `apps/web`.
- Frontend build: `npm run build` from `apps/web`.

---

### Task 1: Backend Schemas And Assignee Repository

**Files:**
- Modify: `apps/api/app/schemas/requests.py`
- Create: `apps/api/app/repositories/request_assignee_repository.py`
- Test: `apps/api/tests/test_request_service_workflow.py`

- [ ] **Step 1: Add failing enrichment test for multiple assignees**

Add this test to `RequestServiceWorkflowTests` in `apps/api/tests/test_request_service_workflow.py`:

```python
    def test_enrich_requests_with_multiple_assignees(self):
        requests = [
            {
                "id": "request-1",
                "created_by": "creator-1",
                "status": "pending",
                "assigned_to": "assignee-1",
            }
        ]
        assignments_by_request = {
            "request-1": ["assignee-1", "assignee-2"],
        }
        users_by_id = {
            "creator-1": {"id": "creator-1", "email": "creator@example.com", "name": "Creator", "avatar_url": None},
            "assignee-1": {"id": "assignee-1", "email": "a1@example.com", "name": "A1", "avatar_url": None},
            "assignee-2": {"id": "assignee-2", "email": "a2@example.com", "name": "A2", "avatar_url": None},
        }

        with (
            patch("app.services.request_service.request_assignee_repository.list_assignee_ids_by_request_ids", return_value=assignments_by_request),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value=users_by_id),
        ):
            result = request_service.enrich_requests_with_users(requests)

        self.assertEqual([user["id"] for user in result[0]["assignees"]], ["assignee-1", "assignee-2"])
        self.assertEqual(result[0]["assignee"]["id"], "assignee-1")
```

- [ ] **Step 2: Run test to verify it fails**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow.RequestServiceWorkflowTests.test_enrich_requests_with_multiple_assignees
```

Expected: FAIL because `request_assignee_repository` is not imported and `assignees` is not enriched.

- [ ] **Step 3: Update request schemas**

In `apps/api/app/schemas/requests.py`, change these schema classes to include list-based assignments:

```python
class InternalRequestBase(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    priority: RequestPriority = "medium"
    assigned_to: str | None = None
    assignee_ids: list[str] = Field(default_factory=list)
    reference_links: list[str] = Field(default_factory=list)


class AddAssigneeRequest(BaseModel):
    user_id: str
    reason: str | None = None


class RemoveAssigneeRequest(BaseModel):
    reason: str | None = None
```

Update `InternalRequestOut` to add plural assignees while keeping compatibility fields:

```python
class InternalRequestOut(BaseModel):
    id: str
    title: str
    description: str
    tags: list[str]
    priority: RequestPriority
    status: RequestStatus
    created_by: str
    assigned_to: str | None = None
    reference_links: list[str]
    reply: str | None = None
    acknowledged_at: str | None = None
    started_at: str | None = None
    done_at: str | None = None
    cancelled_at: str | None = None
    created_at: str
    updated_at: str
    creator: UserSummary | None = None
    assignee: UserSummary | None = None
    assignees: list[UserSummary] = Field(default_factory=list)
```

- [ ] **Step 4: Create assignee repository**

Create `apps/api/app/repositories/request_assignee_repository.py`:

```python
from app.core.exceptions import ConflictError, DomainError, NotFoundError
from app.db.supabase import get_supabase_admin

REQUEST_ASSIGNEES_TABLE = "request_assignees"
REQUEST_ASSIGNEE_COLUMNS = "request_id,user_id,assigned_by,assigned_at"


def list_assignee_ids(request_id: str) -> list[str]:
    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .select("user_id")
        .eq("request_id", request_id)
        .order("assigned_at", desc=False)
        .execute()
    )
    return [row["user_id"] for row in result.data or []]


def list_assignee_ids_by_request_ids(request_ids: list[str]) -> dict[str, list[str]]:
    if not request_ids:
        return {}

    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .select("request_id,user_id,assigned_at")
        .in_("request_id", request_ids)
        .order("assigned_at", desc=False)
        .execute()
    )

    assignments: dict[str, list[str]] = {request_id: [] for request_id in request_ids}
    for row in result.data or []:
        assignments.setdefault(row["request_id"], []).append(row["user_id"])
    return assignments


def add_assignee(request_id: str, user_id: str, assigned_by: str) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .insert(
            {
                "request_id": request_id,
                "user_id": user_id,
                "assigned_by": assigned_by,
            }
        )
        .execute()
    )

    if not result.data:
        raise ConflictError("User is already assigned to this request")
    return result.data[0]


def add_assignees(request_id: str, user_ids: list[str], assigned_by: str) -> list[dict]:
    unique_user_ids = list(dict.fromkeys(user_ids))
    if not unique_user_ids:
        return []

    rows = [
        {"request_id": request_id, "user_id": user_id, "assigned_by": assigned_by}
        for user_id in unique_user_ids
    ]
    result = get_supabase_admin().table(REQUEST_ASSIGNEES_TABLE).insert(rows).execute()

    if len(result.data or []) != len(unique_user_ids):
        raise DomainError("Request assignees could not be created")
    return result.data


def remove_assignee(request_id: str, user_id: str) -> dict:
    result = (
        get_supabase_admin()
        .table(REQUEST_ASSIGNEES_TABLE)
        .delete()
        .eq("request_id", request_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        raise NotFoundError("Assignee not found on request")
    return result.data[0]
```

- [ ] **Step 5: Wire enrichment**

In `apps/api/app/services/request_service.py`, update imports:

```python
from app.repositories import request_assignee_repository, request_repository, user_repository
```

Replace `enrich_requests_with_users` with:

```python
def enrich_requests_with_users(requests: list[dict]) -> list[dict]:
    request_ids = [request["id"] for request in requests if request.get("id")]
    assignee_ids_by_request = request_assignee_repository.list_assignee_ids_by_request_ids(request_ids)

    user_ids: list[str] = []
    for request in requests:
        if request.get("created_by"):
            user_ids.append(request["created_by"])
        user_ids.extend(assignee_ids_by_request.get(request.get("id"), []))
        if request.get("assigned_to"):
            user_ids.append(request["assigned_to"])

    users_by_id = user_repository.list_user_summaries(user_ids)
    enriched = []
    for request in requests:
        item = dict(request)
        assignee_ids = assignee_ids_by_request.get(request.get("id"), [])
        assignees = [users_by_id[user_id] for user_id in assignee_ids if user_id in users_by_id]
        fallback_assignee = users_by_id.get(request.get("assigned_to"))

        item["creator"] = users_by_id.get(request.get("created_by"))
        item["assignees"] = assignees
        item["assignee"] = assignees[0] if assignees else fallback_assignee
        item["assigned_to"] = assignee_ids[0] if assignee_ids else request.get("assigned_to")
        enriched.append(item)
    return enriched
```

- [ ] **Step 6: Run focused test**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow.RequestServiceWorkflowTests.test_enrich_requests_with_multiple_assignees
```

Expected: PASS.

- [ ] **Step 7: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/api/app/schemas/requests.py apps/api/app/repositories/request_assignee_repository.py apps/api/app/services/request_service.py apps/api/tests/test_request_service_workflow.py
git commit -m "feat(api): add request assignee repository"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 2: Database Schema Migration And Request List Queries

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `apps/api/app/repositories/request_repository.py`
- Test: `apps/api/tests/test_request_service_workflow.py`

- [ ] **Step 1: Add failing list service tests**

In `apps/api/tests/test_request_service_workflow.py`, add:

```python
    def test_list_assigned_requests_uses_membership_repository_query(self):
        current_user = CurrentUser(id="user-1", email="user@example.com", name="User", role="be", is_active=True)
        requests = [{"id": "request-1", "created_by": "creator-1", "status": "pending"}]

        with (
            patch("app.services.request_service.request_repository.list_assigned_requests", return_value=requests) as list_assigned,
            patch("app.services.request_service.request_assignee_repository.list_assignee_ids_by_request_ids", return_value={"request-1": ["user-1", "user-2"]}),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.list_requests("assigned", current_user)

        list_assigned.assert_called_once_with("user-1", limit=50)
        self.assertEqual(result[0]["id"], "request-1")
```

- [ ] **Step 2: Run test to verify current behavior baseline**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow.RequestServiceWorkflowTests.test_list_assigned_requests_uses_membership_repository_query
```

Expected: PASS after Task 1 because service already calls `list_assigned_requests`; this test locks the service contract before repository SQL changes.

- [ ] **Step 3: Add schema table and backfill**

In `DB_SCHEMA_TEAM_REQUEST_HUB.sql`, after `assignment_history` indexes, add:

```sql
-- =========================================================
-- 4b. Current Request Assignees
-- =========================================================

create table if not exists public.request_assignees (
  request_id uuid not null references public.internal_requests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  assigned_by uuid not null references public.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index if not exists idx_request_assignees_request_id
  on public.request_assignees(request_id);

create index if not exists idx_request_assignees_user_assigned_at
  on public.request_assignees(user_id, assigned_at desc);

insert into public.request_assignees (request_id, user_id, assigned_by, assigned_at)
select id, assigned_to, created_by, created_at
from public.internal_requests
where assigned_to is not null
on conflict (request_id, user_id) do nothing;
```

In the RLS section, add policies matching backend service-role use and defense-in-depth authenticated reads for own assignments:

```sql
alter table public.request_assignees enable row level security;

drop policy if exists "Users can read own request assignments" on public.request_assignees;
create policy "Users can read own request assignments"
  on public.request_assignees
  for select
  to authenticated
  using (user_id = auth.uid());
```

- [ ] **Step 4: Update repository list queries**

In `apps/api/app/repositories/request_repository.py`, update `list_assigned_requests` to query request IDs from `request_assignees` then fetch requests:

```python
def list_assigned_requests(user_id: str, limit: int = 50) -> list[dict]:
    assignments = (
        get_supabase_admin()
        .table("request_assignees")
        .select("request_id,assigned_at")
        .eq("user_id", user_id)
        .order("assigned_at", desc=True)
        .limit(limit)
        .execute()
    )
    request_ids = [row["request_id"] for row in assignments.data or []]
    if not request_ids:
        return []

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .in_("id", request_ids)
        .neq("status", "done")
        .neq("status", "cancelled")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []
```

Update `list_pool_requests` to exclude requests with current assignees:

```python
def list_pool_requests(limit: int = 50) -> list[dict]:
    assignments = (
        get_supabase_admin()
        .table("request_assignees")
        .select("request_id")
        .execute()
    )
    assigned_request_ids = list({row["request_id"] for row in assignments.data or []})

    query = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .eq("status", "pending")
        .order("created_at", desc=True)
    )
    if assigned_request_ids:
        query = query.not_.in_("id", assigned_request_ids)

    result = query.limit(limit).execute()
    return result.data or []
```

Update `get_dashboard_data` to include membership-assigned requests with explicit request-id expansion:

```python
def get_dashboard_data(user_id: str) -> list[dict]:
    """Fetch dashboard-relevant requests for a user with multi-assignee membership."""
    assignments = (
        get_supabase_admin()
        .table("request_assignees")
        .select("request_id")
        .eq("user_id", user_id)
        .limit(200)
        .execute()
    )
    assigned_request_ids = [row["request_id"] for row in assignments.data or []]

    filters = [
        f"created_by.eq.{user_id}",
        "and(status.eq.pending,assigned_to.is.null)",
    ]
    if assigned_request_ids:
        filters.append(f"id.in.({','.join(assigned_request_ids)})")

    result = (
        get_supabase_admin()
        .table(REQUESTS_TABLE)
        .select(REQUEST_LIST_COLUMNS)
        .or_(",".join(filters))
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return result.data or []
```

This keeps `dashboard.get_dashboard_summary()` unchanged at the call boundary while letting service-level counting use enriched `assignees[]` membership.

- [ ] **Step 5: Run backend workflow tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow
```

Expected: PASS.

- [ ] **Step 6: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add DB_SCHEMA_TEAM_REQUEST_HUB.sql apps/api/app/repositories/request_repository.py apps/api/tests/test_request_service_workflow.py
git commit -m "feat(api): query requests by assignee membership"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 3: Multi-Assignee Permissions And Workflow Service

**Files:**
- Modify: `apps/api/app/core/permissions.py`
- Modify: `apps/api/app/services/request_service.py`
- Modify: `apps/api/app/repositories/assignment_repository.py`
- Test: `apps/api/tests/test_permissions.py`
- Test: `apps/api/tests/test_request_service_create_assign_cancel.py`
- Test: `apps/api/tests/test_request_service_workflow.py`

- [ ] **Step 1: Add permission tests**

In `apps/api/tests/test_permissions.py`, add tests for multi-assignee visibility/action:

```python
    def test_assignee_in_assignee_ids_can_view_request(self):
        user = CurrentUser(id="user-1", email="u@example.com", name="U", role="be", is_active=True)
        request = {"created_by": "creator-1", "assignee_ids": ["user-1", "user-2"], "status": "pending"}

        ensure_can_view_request(user, request)

    def test_assignee_in_assignee_ids_can_act_on_request(self):
        user = CurrentUser(id="user-1", email="u@example.com", name="U", role="be", is_active=True)
        request = {"created_by": "creator-1", "assignee_ids": ["user-1", "user-2"], "status": "pending"}

        ensure_is_assignee_or_lead(user, request)
```

- [ ] **Step 2: Run permission tests to verify failure**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_permissions
```

Expected: FAIL because permission helpers do not read `assignee_ids` yet.

- [ ] **Step 3: Update permission helpers**

In `apps/api/app/core/permissions.py`, add helper:

```python
def is_request_assignee(user: CurrentUser, request: dict) -> bool:
    assignee_ids = request.get("assignee_ids") or []
    if user.id in assignee_ids:
        return True

    assignees = request.get("assignees") or []
    if any(assignee.get("id") == user.id for assignee in assignees if isinstance(assignee, dict)):
        return True

    return request.get("assigned_to") == user.id
```

Replace direct `request.get("assigned_to") == user.id` checks in `ensure_can_view_request`, `ensure_can_reassign`, and `ensure_is_assignee_or_lead` with `is_request_assignee(user, request)`.

- [ ] **Step 4: Add create request tests for many assignees**

In `apps/api/tests/test_request_service_create_assign_cancel.py`, replace the single-assignee create test with:

```python
    def test_create_request_with_many_assignees_records_assignments(self):
        payload = InternalRequestCreate(
            title="New Request",
            description="Please help",
            assignee_ids=["assignee-1", "assignee-2"],
        )
        created = _request(id="new-1", assigned_to="assignee-1")

        with (
            patch("app.services.request_service.users.ensure_active_user") as ensure_active,
            patch("app.services.request_service.request_repository.create_request", return_value=created),
            patch("app.services.request_service.request_assignee_repository.add_assignees", return_value=[]),
            patch("app.services.request_service.assignment_repository.create_assignment_history") as record,
            patch("app.services.request_service.notification_module.notify_assigned") as notify,
            patch("app.services.request_service.request_assignee_repository.list_assignee_ids_by_request_ids", return_value={"new-1": ["assignee-1", "assignee-2"]}),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.create_request(payload, _user())

        ensure_active.assert_any_call("assignee-1")
        ensure_active.assert_any_call("assignee-2")
        self.assertEqual(record.call_count, 2)
        self.assertEqual(notify.call_count, 2)
        self.assertEqual(result["assignees"], [])
```

- [ ] **Step 5: Implement create workflow**

In `request_service.create_request`, before creating the request, normalize assignees:

```python
    data = payload.model_dump()
    assignee_ids = list(dict.fromkeys(data.pop("assignee_ids", [])))
    if data.get("assigned_to") and data["assigned_to"] not in assignee_ids:
        assignee_ids.insert(0, data["assigned_to"])

    for assignee_id in assignee_ids:
        users.ensure_active_user(assignee_id)

    data["assigned_to"] = assignee_ids[0] if assignee_ids else None
    data.update({"created_by": current_user.id, "status": "pending"})
    request = request_repository.create_request(data)

    request_assignee_repository.add_assignees(request["id"], assignee_ids, current_user.id)
    for assignee_id in assignee_ids:
        assignment_repository.create_assignment_history(
            request_id=request["id"],
            from_user_id=None,
            to_user_id=assignee_id,
            assigned_by=current_user.id,
            reason="Assigned on create",
        )
        notification_module.notify_assigned(assignee_id, request)

    return enrich_request_with_users(request)
```

- [ ] **Step 6: Add add/remove service tests**

In `apps/api/tests/test_request_service_workflow.py`, add:

```python
    def test_add_assignee_requires_current_actor_access_and_notifies_new_user(self):
        current_user = CurrentUser(id="assignee-1", email="a@example.com", name="A", role="be", is_active=True)
        request = {"id": "request-1", "title": "Fix", "status": "pending", "created_by": "creator-1", "assignee_ids": ["assignee-1"]}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=request),
            patch("app.services.request_service.request_assignee_repository.list_assignee_ids", return_value=["assignee-1"]),
            patch("app.services.request_service.users.ensure_active_user") as ensure_active,
            patch("app.services.request_service.request_assignee_repository.add_assignee") as add_assignee,
            patch("app.services.request_service.assignment_repository.create_assignment_history") as history,
            patch("app.services.request_service.notification_module.notify_assigned") as notify,
            patch("app.services.request_service.request_assignee_repository.list_assignee_ids_by_request_ids", return_value={"request-1": ["assignee-1", "assignee-2"]}),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.add_request_assignee("request-1", "assignee-2", None, current_user)

        ensure_active.assert_called_once_with("assignee-2")
        add_assignee.assert_called_once_with("request-1", "assignee-2", "assignee-1")
        history.assert_called_once()
        notify.assert_called_once_with("assignee-2", request)
        self.assertEqual(result["id"], "request-1")

    def test_remove_last_active_assignee_is_rejected(self):
        current_user = CurrentUser(id="assignee-1", email="a@example.com", name="A", role="be", is_active=True)
        request = {"id": "request-1", "title": "Fix", "status": "in_progress", "created_by": "creator-1", "assignee_ids": ["assignee-1"]}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=request),
            patch("app.services.request_service.request_assignee_repository.list_assignee_ids", return_value=["assignee-1"]),
        ):
            with self.assertRaises(HTTPException) as ctx:
                request_service.remove_request_assignee("request-1", "assignee-1", "handoff", current_user)

        self.assertEqual(ctx.exception.status_code, 400)
```

- [ ] **Step 7: Implement add/remove service methods**

In `apps/api/app/services/request_service.py`, add helpers:

```python
ACTIVE_STATUSES = {"acknowledged", "in_progress"}


def attach_assignee_ids(request: dict) -> dict:
    item = dict(request)
    item["assignee_ids"] = request_assignee_repository.list_assignee_ids(request["id"])
    return item


def ensure_can_manage_assignees(current_user: CurrentUser, request: dict) -> None:
    if is_lead(current_user) or request["created_by"] == current_user.id:
        return
    if current_user.id in (request.get("assignee_ids") or []):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot manage assignees for this request")
```

Add service functions:

```python
def add_request_assignee(request_id: str, user_id: str, reason: str | None, current_user: CurrentUser) -> dict:
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_can_manage_assignees(current_user, request)
    ensure_open_request(request)
    users.ensure_active_user(user_id)

    if user_id in request["assignee_ids"]:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User is already assigned to this request")

    request_assignee_repository.add_assignee(request_id, user_id, current_user.id)
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=None,
        to_user_id=user_id,
        assigned_by=current_user.id,
        reason=reason,
    )
    notification_module.notify_assigned(user_id, request)
    return enrich_request_with_users([request_repository.get_request_or_404(request_id)])[0]


def remove_request_assignee(request_id: str, user_id: str, reason: str | None, current_user: CurrentUser) -> dict:
    request = attach_assignee_ids(request_repository.get_request_or_404(request_id))
    ensure_can_manage_assignees(current_user, request)
    ensure_open_request(request)

    assignee_ids = request["assignee_ids"]
    if user_id not in assignee_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found on request")
    if request.get("status") in ACTIVE_STATUSES and not reason:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Reason is required to remove assignee from active request")
    if request.get("status") in ACTIVE_STATUSES and len(assignee_ids) == 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove the last assignee from an active request")

    request_assignee_repository.remove_assignee(request_id, user_id)
    assignment_repository.create_assignment_history(
        request_id=request_id,
        from_user_id=user_id,
        to_user_id=user_id,
        assigned_by=current_user.id,
        reason=reason,
    )
    return enrich_request_with_users([request_repository.get_request_or_404(request_id)])[0]
```

Update `update_status` and `mark_done` to call `attach_assignee_ids` before permission checks.

- [ ] **Step 8: Run backend service and permission tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_permissions tests.test_request_service_create_assign_cancel tests.test_request_service_workflow
```

Expected: PASS.

- [ ] **Step 9: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/api/app/core/permissions.py apps/api/app/services/request_service.py apps/api/tests/test_permissions.py apps/api/tests/test_request_service_create_assign_cancel.py apps/api/tests/test_request_service_workflow.py
git commit -m "feat(api): support multi-assignee workflow rules"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 4: Request Routes And Telegram Dispatch

**Files:**
- Modify: `apps/api/app/routes/requests.py`
- Modify: `apps/api/app/schemas/requests.py`
- Test: `apps/api/tests/test_request_routes.py`

- [ ] **Step 1: Add route tests for add/remove assignee**

In `apps/api/tests/test_request_routes.py`, add these methods to `RequestRoutesTests`:

```python
    def test_add_assignee_route_calls_service(self):
        current_user = CurrentUser(id="user-1", email="user@example.com", name="User", role="fe", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: current_user
        response_body = {
            "id": "request-1",
            "title": "T",
            "description": "D",
            "tags": [],
            "priority": "medium",
            "status": "pending",
            "created_by": "user-1",
            "assigned_to": None,
            "reference_links": [],
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
            "assignees": [],
        }

        with patch("app.routes.requests.request_service.add_request_assignee", return_value=response_body) as add_assignee:
            response = TestClient(app).post(
                "/requests/request-1/assignees",
                json={"user_id": "user-2", "reason": "Need help"},
            )

        self.assertEqual(response.status_code, 200)
        add_assignee.assert_called_once_with("request-1", "user-2", "Need help", unittest.mock.ANY)

    def test_remove_assignee_route_calls_service(self):
        current_user = CurrentUser(id="user-1", email="user@example.com", name="User", role="fe", is_active=True)
        app.dependency_overrides[get_current_user] = lambda: current_user
        response_body = {
            "id": "request-1",
            "title": "T",
            "description": "D",
            "tags": [],
            "priority": "medium",
            "status": "pending",
            "created_by": "user-1",
            "assigned_to": None,
            "reference_links": [],
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
            "assignees": [],
        }

        with patch("app.routes.requests.request_service.remove_request_assignee", return_value=response_body) as remove_assignee:
            response = TestClient(app).request(
                "DELETE",
                "/requests/request-1/assignees/user-2",
                json={"reason": "handoff"},
            )

        self.assertEqual(response.status_code, 200)
        remove_assignee.assert_called_once_with("request-1", "user-2", "handoff", unittest.mock.ANY)
```

- [ ] **Step 2: Run route tests to verify failure**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_routes
```

Expected: FAIL because routes do not exist.

- [ ] **Step 3: Add route imports and endpoints**

In `apps/api/app/routes/requests.py`, import schemas:

```python
    AddAssigneeRequest,
    RemoveAssigneeRequest,
```

Add endpoints before `/{request_id}/assignment-history`:

```python
@router.post("/{request_id}/assignees", response_model=InternalRequestOut)
async def add_request_assignee(
    request_id: str,
    payload: AddAssigneeRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    background_tasks: BackgroundTasks,
):
    require_active_current_user(current_user)
    result = request_service.add_request_assignee(request_id, payload.user_id, payload.reason, current_user)
    background_tasks.add_task(
        notification_module.dispatch_telegram_background,
        payload.user_id,
        result,
        False,
    )
    return result


@router.delete("/{request_id}/assignees/{user_id}", response_model=InternalRequestOut)
async def remove_request_assignee(
    request_id: str,
    user_id: str,
    payload: RemoveAssigneeRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    require_active_current_user(current_user)
    return request_service.remove_request_assignee(request_id, user_id, payload.reason, current_user)
```

Update create route background dispatch to loop over `result.get("assignees", [])`:

```python
    for assignee in result.get("assignees", []):
        background_tasks.add_task(
            notification_module.dispatch_telegram_background,
            assignee["id"],
            result,
            False,
        )
```

- [ ] **Step 4: Run route tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_routes
```

Expected: PASS.

- [ ] **Step 5: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/api/app/routes/requests.py apps/api/app/schemas/requests.py apps/api/tests/test_request_routes.py
git commit -m "feat(api): add request assignee routes"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 5: Dashboard And Backend Regression Pass

**Files:**
- Modify: `apps/api/app/services/dashboard.py`
- Modify: `apps/api/tests/test_dashboard_service.py`

- [ ] **Step 1: Update dashboard tests for `assignees[]`**

In `apps/api/tests/test_dashboard_service.py`, update mock enriched requests so assigned membership is represented as plural assignees:

```python
mock_enriched["assignees"] = [{"id": "user-1", "email": "a@a.com", "name": "A"}]
```

In `test_dashboard_summary_computes_counts_correctly`, update `noop_enrich` to add:

```python
                if r["id"] == "r1":
                    e["assignees"] = [user_map["user-1"]]
                elif r["id"] == "r4":
                    e["assignees"] = [user_map["user-2"]]
                else:
                    e["assignees"] = []
```

- [ ] **Step 2: Run dashboard tests to reveal count assumptions**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service
```

Expected: FAIL if `dashboard.py` still only checks `assigned_to`.

- [ ] **Step 3: Update dashboard membership helper**

In `apps/api/app/services/dashboard.py`, add or update helper logic:

```python
def is_assigned_to_user(request: dict, user_id: str) -> bool:
    return any(assignee.get("id") == user_id for assignee in request.get("assignees", [])) or request.get("assigned_to") == user_id


def has_assignees(request: dict) -> bool:
    return bool(request.get("assignees")) or bool(request.get("assigned_to"))
```

Use `is_assigned_to_user(request, current_user.id)` for assigned counts/recent lists. Use `not has_assignees(request)` for pool counts/recent lists.

- [ ] **Step 4: Run backend full test suite**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

- [ ] **Step 5: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/api/app/services/dashboard.py apps/api/tests/test_dashboard_service.py
git commit -m "feat(api): compute dashboard from multi-assignee data"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 6: Frontend API Types And Mutations

**Files:**
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/lib/api/requests.ts`
- Modify: `apps/web/src/hooks/use-request-actions.ts`

- [ ] **Step 1: Update frontend request types**

In `apps/web/src/types/index.ts`, add `assignees` to `InternalRequest`:

```ts
export interface InternalRequest {
  id: string;
  title: string;
  description: string;
  tags: string[];
  priority: RequestPriority;
  status: RequestStatus;
  created_by: string;
  assigned_to?: string | null;
  reference_links: string[];
  reply?: string | null;
  acknowledged_at?: string | null;
  started_at?: string | null;
  done_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  creator?: UserSummary | null;
  assignee?: UserSummary | null;
  assignees?: UserSummary[];
}
```

- [ ] **Step 2: Update request API module**

In `apps/web/src/lib/api/requests.ts`, update create payload and add helper types/functions:

```ts
export interface InternalRequestCreatePayload {
  title: string;
  description: string;
  tags: string[];
  priority: RequestPriority;
  assigned_to?: string | null;
  assignee_ids?: string[];
  reference_links: string[];
}

export interface AddAssigneePayload {
  user_id: string;
  reason?: string | null;
}

export interface RemoveAssigneePayload {
  reason?: string | null;
}

export function addRequestAssignee(
  requestId: string,
  payload: AddAssigneePayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/assignees`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function removeRequestAssignee(
  requestId: string,
  userId: string,
  payload: RemoveAssigneePayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/assignees/${userId}`, {
    method: "DELETE",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Add request action mutations**

In `apps/web/src/hooks/use-request-actions.ts`, import the new helpers and types:

```ts
  addRequestAssignee,
  removeRequestAssignee,
  type AddAssigneePayload,
  type RemoveAssigneePayload,
```

Add mutations before `reassign`:

```ts
    addAssignee: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: AddAssigneePayload;
      }) => addRequestAssignee(requestId, payload),
      onSuccess: (updatedRequest, variables) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(variables.requestId);
      },
    }),
    removeAssignee: useMutation({
      mutationFn: ({
        requestId,
        userId,
        payload,
      }: {
        requestId: string;
        userId: string;
        payload: RemoveAssigneePayload;
      }) => removeRequestAssignee(requestId, userId, payload),
      onSuccess: (updatedRequest, variables) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(variables.requestId);
      },
    }),
```

- [ ] **Step 4: Run frontend lint for type/import failures**

Run from `apps/web`:

```bash
npm run lint
```

Expected: PASS or existing unrelated warnings only. Fix any new import/type errors from this task before continuing.

- [ ] **Step 5: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/web/src/types/index.ts apps/web/src/lib/api/requests.ts apps/web/src/hooks/use-request-actions.ts
git commit -m "feat(web): add multi-assignee API bindings"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 7: Frontend Assignee Rendering And Permissions

**Files:**
- Create: `apps/web/src/components/requests/assignee-list.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`
- Modify: `apps/web/src/components/requests/request-detail.tsx`
- Modify: `apps/web/src/components/requests/request-actions.tsx`

- [ ] **Step 1: Create shared assignee display**

Create `apps/web/src/components/requests/assignee-list.tsx`:

```tsx
import { formatUserSummaryLabel } from "@/components/requests/user-display";
import type { UserSummary } from "@/types";

interface AssigneeListProps {
  assignees?: UserSummary[] | null;
  fallback: string;
  compact?: boolean;
}

export function AssigneeList({ assignees, fallback, compact = false }: AssigneeListProps) {
  const visibleAssignees = assignees ?? [];

  if (visibleAssignees.length === 0) {
    return <span className="text-[#6b7280]">{fallback}</span>;
  }

  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {visibleAssignees.map((assignee) => (
        <span
          key={assignee.id}
          className="inline-flex max-w-[180px] items-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-2 py-0.5 text-caption text-[#4b5563]"
        >
          <span className="truncate">
            {formatUserSummaryLabel(assignee) ?? assignee.id}
          </span>
        </span>
      ))}
      {compact && visibleAssignees.length > 3 ? null : null}
    </span>
  );
}
```

- [ ] **Step 2: Update request card rendering**

In `request-card.tsx`, replace `formatUserSummaryLabel(request.assignee)` usage with `AssigneeList`:

```tsx
import { AssigneeList } from "@/components/requests/assignee-list";
```

Use:

```tsx
const hasAssignees = Boolean(request.assignees?.length ?? request.assigned_to);
```

Replace the assignee metadata line:

```tsx
<span className="inline-flex items-center gap-1">
  {t("card.assignee", { name: "" })}
  <AssigneeList assignees={request.assignees} fallback={t("card.unassigned")} compact />
</span>
```

Update pending action logic:

```tsx
if (request.status === "pending") {
  actionLabel = hasAssignees ? t("card.acknowledge") : t("card.selfAssign");
}
```

- [ ] **Step 3: Update detail assignee rendering**

In `request-detail.tsx`, import `AssigneeList` and replace the assigned field:

```tsx
import { AssigneeList } from "@/components/requests/assignee-list";
```

Use:

```tsx
<div>
  <p className="text-caption text-[#6b7280]">{t("detail.assigned")}</p>
  <AssigneeList assignees={request.assignees} fallback={tCommon("notSet")} />
</div>
```

- [ ] **Step 4: Update action permissions**

In `request-actions.tsx`, change assignee checks:

```tsx
const assigneeIds = request.assignees?.map((assignee) => assignee.id) ?? [];
const isAssignee = currentUser ? assigneeIds.includes(currentUser.id) || currentUser.id === request.assigned_to : false;
const hasAssignees = assigneeIds.length > 0 || Boolean(request.assigned_to);
```

Replace `!request.assigned_to` with `!hasAssignees`, and `Boolean(request.assigned_to)` with `hasAssignees`.

- [ ] **Step 5: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: PASS. Fix any JSX/i18n string shape issue introduced by this task.

- [ ] **Step 6: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/web/src/components/requests/assignee-list.tsx apps/web/src/components/requests/request-card.tsx apps/web/src/components/requests/request-detail.tsx apps/web/src/components/requests/request-actions.tsx
git commit -m "feat(web): render multiple request assignees"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 8: Frontend Create Form And Assignee Management Controls

**Files:**
- Modify: `apps/web/src/components/requests/request-form.tsx`
- Create: `apps/web/src/components/requests/assignee-management.tsx`
- Modify: `apps/web/src/components/requests/request-detail.tsx`
- Modify: `apps/web/src/components/requests/request-actions.tsx`

- [ ] **Step 1: Update create form to submit `assignee_ids`**

In `request-form.tsx`, replace `assignedTo` state with:

```tsx
const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
```

Add toggler:

```tsx
function toggleAssignee(userId: string) {
  setAssigneeIds((current) =>
    current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId],
  );
}
```

Submit payload:

```tsx
await actions.create.mutateAsync({
  title: title.trim(),
  description: description.trim(),
  priority,
  tags: splitCommaList(""),
  reference_links: splitLineList(""),
  assigned_to: assigneeIds[0] ?? null,
  assignee_ids: assigneeIds,
});
```

Replace the `<select>` with checkbox list:

```tsx
<fieldset className="grid gap-2 text-sm font-medium text-[#111827]">
  <legend>{t("form.assignee")}</legend>
  <div className="grid gap-2 rounded-md border border-[#e5e7eb] bg-white p-3">
    {(activeUsersQuery.data ?? []).map((user) => (
      <label key={user.id} className="flex items-center gap-2 text-sm font-normal text-[#4b5563]">
        <input
          type="checkbox"
          checked={assigneeIds.includes(user.id)}
          onChange={() => toggleAssignee(user.id)}
          disabled={activeUsersQuery.isLoading}
        />
        {formatUserLabel(user)}
      </label>
    ))}
    {(activeUsersQuery.data ?? []).length === 0 ? (
      <p className="text-xs font-normal text-[#6b7280]">{t("form.leaveInPool")}</p>
    ) : null}
  </div>
  <span className="text-xs font-normal text-[#6b7280]">{t("form.assigneeHelp")}</span>
</fieldset>
```

- [ ] **Step 2: Create assignee management component**

Create `apps/web/src/components/requests/assignee-management.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatUserLabel, formatUserSummaryLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
import { useRequestActions } from "@/hooks/use-request-actions";
import type { InternalRequest, UserSummary } from "@/types";

function isActiveStatus(status: InternalRequest["status"]) {
  return status === "acknowledged" || status === "in_progress";
}

export function AssigneeManagement({ request }: { request: InternalRequest }) {
  const t = useTranslations("requests");
  const activeUsersQuery = useActiveUsers();
  const actions = useRequestActions();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [removeReasonByUser, setRemoveReasonByUser] = useState<Record<string, string>>({});
  const assignees = request.assignees ?? [];
  const assignedIds = new Set(assignees.map((assignee) => assignee.id));
  const availableUsers = (activeUsersQuery.data ?? []).filter((user) => !assignedIds.has(user.id));
  const requiresReason = isActiveStatus(request.status);

  async function addAssignee() {
    if (!selectedUserId) return;
    await actions.addAssignee.mutateAsync({
      requestId: request.id,
      payload: { user_id: selectedUserId },
    });
    setSelectedUserId("");
  }

  async function removeAssignee(assignee: UserSummary) {
    const reason = removeReasonByUser[assignee.id]?.trim() ?? "";
    await actions.removeAssignee.mutateAsync({
      requestId: request.id,
      userId: assignee.id,
      payload: { reason: reason || null },
    });
    setRemoveReasonByUser((current) => ({ ...current, [assignee.id]: "" }));
  }

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          className="h-10 flex-1 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm"
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          disabled={activeUsersQuery.isLoading || actions.addAssignee.isPending}
        >
          <option value="">{t("actions.selectTeammate")}</option>
          {availableUsers.map((user) => (
            <option key={user.id} value={user.id}>{formatUserLabel(user)}</option>
          ))}
        </select>
        <Button type="button" onClick={() => void addAssignee()} disabled={!selectedUserId || actions.addAssignee.isPending}>
          {t("actions.addAssignee")}
        </Button>
      </div>

      <div className="grid gap-2">
        {assignees.map((assignee) => (
          <div key={assignee.id} className="grid gap-2 rounded-md border border-[#e5e7eb] bg-white p-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <span className="text-sm text-[#4b5563]">{formatUserSummaryLabel(assignee) ?? assignee.id}</span>
            {requiresReason ? (
              <input
                className="h-9 rounded-md border border-[#e5e7eb] px-2 text-sm"
                placeholder={t("actions.reason")}
                value={removeReasonByUser[assignee.id] ?? ""}
                onChange={(event) => setRemoveReasonByUser((current) => ({ ...current, [assignee.id]: event.target.value }))}
              />
            ) : null}
            <Button type="button" variant="outline" onClick={() => void removeAssignee(assignee)} disabled={actions.removeAssignee.isPending}>
              {t("actions.removeAssignee")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add i18n keys**

In the request i18n config file that defines `requests.actions`, add these keys for both Vietnamese and English:

```ts
addAssignee: "Add assignee",
removeAssignee: "Remove",
```

Vietnamese:

```ts
addAssignee: "Thêm người nhận",
removeAssignee: "Gỡ",
```

- [ ] **Step 4: Render management in detail for allowed users**

In `request-detail.tsx`, import `useCurrentUser` and `AssigneeManagement`:

```tsx
import { AssigneeManagement } from "@/components/requests/assignee-management";
import { useCurrentUser } from "@/hooks/use-current-user";
```

Inside component:

```tsx
const { data: currentUser } = useCurrentUser();
```

After `const request = requestQuery.data;`, calculate:

```tsx
const assigneeIds = request.assignees?.map((assignee) => assignee.id) ?? [];
const canManageAssignees = Boolean(
  currentUser &&
    request.status !== "done" &&
    request.status !== "cancelled" &&
    (currentUser.role === "lead" ||
      currentUser.id === request.created_by ||
      assigneeIds.includes(currentUser.id) ||
      currentUser.id === request.assigned_to),
);
```

Render below the metadata grid:

```tsx
{canManageAssignees ? <AssigneeManagement request={request} /> : null}
```

- [ ] **Step 5: Remove reassign button usage**

In `request-actions.tsx`, remove `ReassignDialog` import and remove the `canReassign` render line. Assignee changes now happen through `AssigneeManagement`.

- [ ] **Step 6: Run frontend lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 7: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/web/src/components/requests/request-form.tsx apps/web/src/components/requests/assignee-management.tsx apps/web/src/components/requests/request-detail.tsx apps/web/src/components/requests/request-actions.tsx apps/web/src/i18n/request.ts
git commit -m "feat(web): add assignee management UI"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 9: Red Unread Badge Component

**Files:**
- Create: `apps/web/src/components/shared/unread-count-badge.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create shared badge**

Create `apps/web/src/components/shared/unread-count-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

interface UnreadCountBadgeProps {
  count: number;
  className?: string;
  showZero?: boolean;
}

export function UnreadCountBadge({ count, className, showZero = false }: UnreadCountBadgeProps) {
  if (count <= 0 && !showZero) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium leading-none text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
```

- [ ] **Step 2: Update top bar and sidebar badges**

In `app-shell.tsx`, import:

```tsx
import { UnreadCountBadge } from "@/components/shared/unread-count-badge";
```

Replace sidebar badge span with:

```tsx
<UnreadCountBadge count={badge} />
```

Replace topbar count span:

```tsx
<span ref={unreadRef}>
  <UnreadCountBadge count={unreadCount} showZero />
</span>
```

- [ ] **Step 3: Update dashboard unread summary**

In `dashboard/page.tsx`, import `UnreadCountBadge` and render the count beside the unread notification text:

```tsx
<div className="flex items-center gap-2 px-4 py-5">
  <UnreadCountBadge count={notificationsUnread} showZero />
  <p className="text-body text-[#111827]">{t("unreadNotifications", { count: notificationsUnread })}</p>
</div>
```

- [ ] **Step 4: Run frontend lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Commit if requested**

If the user explicitly requested commits, run:

```bash
git add apps/web/src/components/shared/unread-count-badge.tsx apps/web/src/components/app/app-shell.tsx 'apps/web/src/app/(dashboard)/dashboard/page.tsx'
git commit -m "feat(web): standardize unread badges"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

### Task 10: Documentation And Final Verification

**Files:**
- Modify: `docs/api-contract.md`
- Modify: `docs/database-schema.md`
- Modify: `docs/permissions.md`

- [ ] **Step 1: Update API contract docs**

In `docs/api-contract.md`, update Requests section:

```txt
POST   /requests/{request_id}/assignees
DELETE /requests/{request_id}/assignees/{user_id}
```

Document create payload field:

```json
{
  "assignee_ids": ["uuid-1", "uuid-2"]
}
```

Document response field:

```json
{
  "assignees": [
    {"id": "uuid", "email": "user@example.com", "name": "User", "avatar_url": null}
  ]
}
```

- [ ] **Step 2: Update database schema docs**

In `docs/database-schema.md`, change the `internal_requests` bullet to mention compatibility `assignee`, and add:

```md
- `public.request_assignees`: current many-to-many request assignment membership with `request_id`, `user_id`, `assigned_by`, and `assigned_at`. This is the source of truth for current assignees.
```

- [ ] **Step 3: Update permissions docs**

In `docs/permissions.md`, update Request Access:

```md
- Assignees can see and act on requests where they are current members in `request_assignees`.
- Creator, lead, or a current assignee can add/remove assignees on open requests.
- Removing an assignee from an active request requires a reason; the last assignee cannot be removed from `acknowledged` or `in_progress` requests.
```

- [ ] **Step 4: Run full backend verification**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

- [ ] **Step 5: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
```

Expected: PASS.

Then run from `apps/web`:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Run GitNexus change detection before any commit**

Run GitNexus detect changes:

```txt
gitnexus_detect_changes(scope="all", repo="Team-Request-Hub")
```

Expected: changed symbols and affected processes are limited to request assignment workflow, dashboard counts, notification badge rendering, and docs.

- [ ] **Step 7: Commit if requested**

If the user explicitly requested commits, run:

```bash
git status --short
git diff -- docs/api-contract.md docs/database-schema.md docs/permissions.md
git add docs/api-contract.md docs/database-schema.md docs/permissions.md
git commit -m "docs: document multi-assignee request workflow"
```

Expected: commit succeeds. If commits were not explicitly requested, skip this step.

---

## Notes For Implementation Agents

- Before editing any function/class/method, run GitNexus impact analysis for that symbol as required by `AGENTS.md`.
- Do not remove `internal_requests.assigned_to` in this implementation.
- Do not add per-assignee status fields.
- Do not notify removed assignees.
- Do not create frontend Supabase database queries.
- Do not commit unless the user explicitly requests commits.
