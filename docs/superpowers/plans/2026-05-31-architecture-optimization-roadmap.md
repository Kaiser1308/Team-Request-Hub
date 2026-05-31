# Architecture Optimization Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve architecture correctness and performance by stabilizing assignment semantics first, then optimizing request/dashboard read models before larger workflow refactors.

**Architecture:** This roadmap is intentionally phased. Phase 0 establishes a safe baseline, Phase 1 concentrates assignment interpretation behind one backend module, and Phase 2 moves request list/dashboard semantics toward deeper read models. Later phases are planned as follow-up implementation plans after Phase 1-2 are merged and verified.

**Tech Stack:** FastAPI, Python unittest, Supabase PostgreSQL, Next.js 15, React 19, TanStack Query, MinIO, GitNexus.

---

## Required Context

- Read `docs/superpowers/specs/2026-05-31-architecture-optimization-roadmap-design.md` before starting.
- Read `docs/architecture.md`, `docs/api-contract.md`, `docs/database-schema.md`, and `docs/permissions.md` before changing backend behavior.
- Run all backend commands from `apps/api` with `uv --cache-dir .uv-cache`.
- Run frontend commands from `apps/web` with `npm`.
- Before editing any symbol, run GitNexus impact analysis for that symbol and record risk in the task notes.
- Before committing, run `gitnexus_detect_changes()` and inspect affected processes.

## File Structure

### Phase 0 Files

- Modify: `docs/superpowers/reports/2026-05-31-architecture-optimization-baseline.md`
  - Records current verification commands, pass/fail status, and known test gaps.

### Phase 1 Files

- Create: `apps/api/app/services/request_assignment_read_model.py`
  - Owns assignment interpretation for request dictionaries and repository-backed assignee lookups.
- Create: `apps/api/tests/test_request_assignment_read_model.py`
  - Unit tests for assignment normalization and compatibility fallback.
- Modify: `apps/api/app/core/permissions.py`
  - Delegates `is_request_assignee()` to the read model.
- Modify: `apps/api/app/services/dashboard.py`
  - Delegates assignment checks to the read model.
- Modify: `apps/api/tests/test_permissions.py`
  - Adds explicit dict-shape tests for `assignees`, `assignee_ids`, and legacy `assigned_to`.
- Modify: `apps/api/tests/test_dashboard_service.py`
  - Adds multi-assignee dashboard cases.

### Phase 2 Files

- Create: `apps/api/app/services/request_list_read_model.py`
  - Centralizes request list view selection and source-of-truth assignment filtering.
- Create: `apps/api/tests/test_request_list_read_model.py`
  - Unit tests for assigned, pool, done, created, and all view semantics using mocked repositories.
- Modify: `apps/api/app/services/request_service.py`
  - Delegates list view selection to `request_list_read_model` while preserving response shape.
- Modify: `apps/api/app/services/dashboard.py`
  - Uses assignment read model consistently for counts and recent sections.
- Modify: `apps/api/app/repositories/request_repository.py`
  - Adds narrow repository functions needed by `request_list_read_model`; avoids broad refactor.
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
  - Adds missing indexes only after checking they do not already exist.
- Modify: `docs/database-schema.md`
  - Documents request/dashboard read model indexes.

### Follow-Up Plan Files

- Create later: `docs/superpowers/plans/2026-05-31-phase-3-request-workflow-deepening.md`
- Create later: `docs/superpowers/plans/2026-05-31-phase-4-notification-event-seam.md`
- Create later: `docs/superpowers/plans/2026-05-31-phase-5-filetree-correctness.md`
- Create later: `docs/superpowers/plans/2026-05-31-phase-6-frontend-request-view-adapters.md`
- Create later: `docs/superpowers/plans/2026-05-31-phase-7-cleanup-docs-compatibility.md`

---

## Phase 0: Baseline

### Task 0.1: Record Verification Baseline

**Files:**
- Create: `docs/superpowers/reports/2026-05-31-architecture-optimization-baseline.md`

- [ ] **Step 1: Run backend tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: command completes. If it fails, record the failing test names and error summaries in the report. Do not fix unrelated failures in this task.

- [ ] **Step 2: Run frontend lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command completes. If it fails, record the failing files and error summaries in the report. Do not fix unrelated failures in this task.

- [ ] **Step 3: Run frontend build**

Run from `apps/web`:

```bash
npm run build
```

Expected: command completes. If env values are missing, record the missing variables and stop frontend verification there.

- [ ] **Step 4: Create baseline report**

Create `docs/superpowers/reports/2026-05-31-architecture-optimization-baseline.md` with this structure:

```markdown
# Architecture Optimization Baseline

Date: 2026-05-31

## Commands

| Area | Command | Result | Notes |
| --- | --- | --- | --- |
| Backend | `uv --cache-dir .uv-cache run python -m unittest discover tests` | PASS_OR_FAIL | SUMMARY |
| Frontend lint | `npm run lint` | PASS_OR_FAIL | SUMMARY |
| Frontend build | `npm run build` | PASS_OR_FAIL | SUMMARY |

## Protected Flows

- Request list: assigned, created, pool, done, all.
- Dashboard summary counts and recent lists.
- Request detail and request workflow actions.
- Notification record creation and external channel dispatch.
- File browse, upload, rename, move, delete, restore, purge.

## Test Gaps To Close

- Assignment source-of-truth cases across `assignee_ids`, `assignees`, and `assigned_to`.
- Multi-assignee dashboard counts.
- Pool view excludes any request with current assignees.
- Done view semantics for creator, assignee, and lead.
- FileTree descendant prefix edge case: `/foo` must not match `/foobar`.
```

Replace `PASS_OR_FAIL` and `SUMMARY` with actual command outcomes.

- [ ] **Step 5: Commit baseline report**

Only commit if the user explicitly requested commits for this session. Otherwise leave the file uncommitted and report the path.

---

## Phase 1: Assignment Source-Of-Truth

### Task 1.1: Add Assignment Read Model Tests

**Files:**
- Create: `apps/api/tests/test_request_assignment_read_model.py`
- Create later in Task 1.2: `apps/api/app/services/request_assignment_read_model.py`

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/test_request_assignment_read_model.py`:

```python
import unittest
from unittest.mock import patch

from app.services import request_assignment_read_model as read_model


class RequestAssignmentReadModelTests(unittest.TestCase):
    def test_assignee_ids_prefer_explicit_assignee_ids(self):
        request = {"id": "r1", "assigned_to": "legacy", "assignee_ids": ["u1", "u2"]}

        self.assertEqual(read_model.assignee_ids_from_request(request), ["u1", "u2"])

    def test_assignee_ids_extract_from_assignees(self):
        request = {"id": "r1", "assignees": [{"id": "u1"}, {"id": "u2"}], "assigned_to": "legacy"}

        self.assertEqual(read_model.assignee_ids_from_request(request), ["u1", "u2"])

    def test_assignee_ids_fall_back_to_legacy_assigned_to(self):
        request = {"id": "r1", "assigned_to": "legacy"}

        self.assertEqual(read_model.assignee_ids_from_request(request), ["legacy"])

    def test_assignee_ids_return_empty_for_unassigned_request(self):
        request = {"id": "r1", "assigned_to": None}

        self.assertEqual(read_model.assignee_ids_from_request(request), [])

    def test_is_assigned_to_user_uses_normalized_ids(self):
        request = {"id": "r1", "assignees": [{"id": "u1"}, {"id": "u2"}], "assigned_to": "legacy"}

        self.assertTrue(read_model.is_assigned_to_user(request, "u2"))
        self.assertFalse(read_model.is_assigned_to_user(request, "missing"))

    def test_has_current_assignees_uses_normalized_ids(self):
        self.assertTrue(read_model.has_current_assignees({"assignee_ids": ["u1"]}))
        self.assertFalse(read_model.has_current_assignees({"assigned_to": None}))

    def test_get_assignee_ids_by_request_ids_merges_repository_and_legacy_fallback(self):
        requests = [
            {"id": "r1", "assigned_to": "legacy-1"},
            {"id": "r2", "assigned_to": "legacy-2"},
            {"id": "r3", "assigned_to": None},
        ]

        with patch(
            "app.services.request_assignment_read_model.request_assignee_repository.list_assignee_ids_by_request_ids",
            return_value={"r1": ["u1", "u2"], "r2": [], "r3": []},
        ):
            result = read_model.get_assignee_ids_by_request_ids(requests)

        self.assertEqual(result["r1"], ["u1", "u2"])
        self.assertEqual(result["r2"], ["legacy-2"])
        self.assertEqual(result["r3"], [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_assignment_read_model
```

Expected: FAIL because `app.services.request_assignment_read_model` does not exist yet.

### Task 1.2: Implement Assignment Read Model

**Files:**
- Create: `apps/api/app/services/request_assignment_read_model.py`
- Test: `apps/api/tests/test_request_assignment_read_model.py`

- [ ] **Step 1: Run GitNexus impact analysis**

Run impact analysis before editing symbols that currently contain assignment logic:

```text
gitnexus_impact target="is_request_assignee" direction="upstream" repo="Team-Request-Hub"
gitnexus_impact target="is_assigned_to_user" direction="upstream" repo="Team-Request-Hub"
gitnexus_impact target="has_assignees" direction="upstream" repo="Team-Request-Hub"
```

Expected: record direct callers, affected processes, and risk level in task notes. If risk is HIGH or CRITICAL, warn the user before editing.

- [ ] **Step 2: Write minimal implementation**

Create `apps/api/app/services/request_assignment_read_model.py`:

```python
from app.repositories import request_assignee_repository


def _unique_ordered(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def assignee_ids_from_request(request: dict) -> list[str]:
    assignee_ids = request.get("assignee_ids") or []
    if assignee_ids:
        return _unique_ordered(assignee_ids)

    assignees = request.get("assignees") or []
    assignee_ids = [
        assignee.get("id")
        for assignee in assignees
        if isinstance(assignee, dict) and assignee.get("id")
    ]
    if assignee_ids:
        return _unique_ordered(assignee_ids)

    assigned_to = request.get("assigned_to")
    if assigned_to:
        return [assigned_to]

    return []


def normalize_request_assignments(request: dict) -> dict:
    normalized = dict(request)
    normalized["assignee_ids"] = assignee_ids_from_request(request)
    return normalized


def is_assigned_to_user(request: dict, user_id: str) -> bool:
    return user_id in assignee_ids_from_request(request)


def has_current_assignees(request: dict) -> bool:
    return bool(assignee_ids_from_request(request))


def get_assignee_ids(request_id: str) -> list[str]:
    return request_assignee_repository.list_assignee_ids(request_id)


def get_assignee_ids_by_request_ids(requests: list[dict]) -> dict[str, list[str]]:
    request_ids = [request["id"] for request in requests if request.get("id")]
    repository_data = request_assignee_repository.list_assignee_ids_by_request_ids(request_ids)

    result: dict[str, list[str]] = {}
    for request in requests:
        request_id = request.get("id")
        if not request_id:
            continue
        assignee_ids = repository_data.get(request_id) or []
        if not assignee_ids:
            assignee_ids = assignee_ids_from_request(request)
        result[request_id] = _unique_ordered(assignee_ids)
    return result
```

- [ ] **Step 3: Run tests to verify they pass**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_assignment_read_model
```

Expected: PASS.

### Task 1.3: Route Permissions Through Assignment Read Model

**Files:**
- Modify: `apps/api/app/core/permissions.py`
- Modify: `apps/api/tests/test_permissions.py`

- [ ] **Step 1: Add explicit permission tests**

Append these tests to `TestEnsureIsAssigneeOrLead` in `apps/api/tests/test_permissions.py`:

```python
    def test_assignee_in_assignees_can_act(self):
        request = {"id": "r1", "assignees": [{"id": "user-1"}, {"id": "user-2"}], "assigned_to": "other"}
        ensure_is_assignee_or_lead(_user(), request)

    def test_legacy_assigned_to_still_allows_action(self):
        request = {"id": "r1", "assigned_to": "user-1"}
        ensure_is_assignee_or_lead(_user(), request)
```

- [ ] **Step 2: Run permission tests before implementation**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_permissions
```

Expected: PASS before refactor. These tests lock current behavior.

- [ ] **Step 3: Modify permissions implementation**

Update `apps/api/app/core/permissions.py` imports and `is_request_assignee()`:

```python
from fastapi import HTTPException, status

from app.schemas.users import CurrentUser
from app.services import request_assignment_read_model


def is_lead(user: CurrentUser) -> bool:
    return user.role == "lead"


def is_request_assignee(user: CurrentUser, request: dict) -> bool:
    return request_assignment_read_model.is_assigned_to_user(request, user.id)
```

Keep the existing `ensure_*` functions unchanged except for using the new `is_request_assignee()` implementation.

- [ ] **Step 4: Run permission and read model tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_permissions tests.test_request_assignment_read_model
```

Expected: PASS.

### Task 1.4: Route Dashboard Assignment Checks Through Read Model

**Files:**
- Modify: `apps/api/app/services/dashboard.py`
- Modify: `apps/api/tests/test_dashboard_service.py`

- [ ] **Step 1: Add dashboard multi-assignee test**

Add this test to `DashboardServiceTests` in `apps/api/tests/test_dashboard_service.py`:

```python
    def test_dashboard_summary_counts_multi_assignee_request(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )
        request = {
            "id": "r1",
            "title": "A",
            "description": "",
            "tags": [],
            "priority": "medium",
            "status": "pending",
            "created_by": "user-2",
            "assigned_to": None,
            "assignees": [{"id": "user-1"}, {"id": "user-3"}],
            "reference_links": [],
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }

        with (
            patch("app.services.dashboard.request_repository.get_dashboard_data", return_value=[request]),
            patch("app.services.dashboard.request_service.enrich_requests_with_users", return_value=[request]),
            patch("app.services.dashboard.notification_module.list_notifications", return_value=[]),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        self.assertEqual(result["counts"]["assigned"], 1)
        self.assertEqual(result["counts"]["pool"], 0)
```

- [ ] **Step 2: Run dashboard tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service
```

Expected: PASS before refactor. The test locks intended multi-assignee behavior.

- [ ] **Step 3: Modify dashboard implementation**

Update `apps/api/app/services/dashboard.py`:

```python
from app.core.permissions import is_lead
from app.repositories import request_repository
from app.schemas.users import CurrentUser
from app import notification_module
from app.services import request_assignment_read_model, request_service


def get_dashboard_summary(current_user: CurrentUser) -> dict:
    raw_requests = request_repository.get_dashboard_data(current_user.id)
    enriched = request_service.enrich_requests_with_users(raw_requests)

    assigned_recent = []
    created_recent = []
    pool_recent = []
    done_recent = []

    for request in enriched:
        status = request.get("status")
        created_by = request.get("created_by")
        is_assigned = request_assignment_read_model.is_assigned_to_user(request, current_user.id)

        if is_assigned and status != "done":
            assigned_recent.append(request)
        if created_by == current_user.id:
            created_recent.append(request)
        if not request_assignment_read_model.has_current_assignees(request) and status == "pending":
            pool_recent.append(request)
        if status == "done":
            if is_lead(current_user):
                done_recent.append(request)
            elif created_by == current_user.id or is_assigned:
                done_recent.append(request)

    urgent_ids = set()
    for request in assigned_recent + created_recent + pool_recent:
        if request.get("priority") == "urgent":
            urgent_ids.add(request.get("id"))

    unread_notifications = notification_module.list_notifications(
        current_user.id,
        unread_only=True,
    )

    return {
        "counts": {
            "assigned": len(assigned_recent),
            "created": len(created_recent),
            "pool": len(pool_recent),
            "done": len(done_recent),
            "urgent": len(urgent_ids),
        },
        "assigned_recent": assigned_recent[:10],
        "created_recent": created_recent[:10],
        "pool_recent": pool_recent[:10],
        "notifications_unread": len(unread_notifications),
    }
```

Remove the old local `is_assigned_to_user()` and `has_assignees()` functions from `dashboard.py`.

- [ ] **Step 4: Run focused tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_dashboard_service tests.test_permissions tests.test_request_assignment_read_model
```

Expected: PASS.

### Task 1.5: Full Phase 1 Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend test suite**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS or only pre-existing failures documented in Phase 0.

- [ ] **Step 2: Run GitNexus change detection**

Run:

```text
gitnexus_detect_changes scope="all" repo="Team-Request-Hub"
```

Expected: changed symbols are limited to assignment read model, permissions, dashboard, and related tests.

- [ ] **Step 3: Commit Phase 1**

Only commit if the user explicitly requested commits for this session. Suggested commit message:

```bash
git add apps/api/app/services/request_assignment_read_model.py apps/api/app/core/permissions.py apps/api/app/services/dashboard.py apps/api/tests/test_request_assignment_read_model.py apps/api/tests/test_permissions.py apps/api/tests/test_dashboard_service.py
git commit -m "refactor: centralize request assignment semantics"
```

---

## Phase 2: Request List And Dashboard Read Models

### Task 2.1: Add Request List Read Model Tests

**Files:**
- Create: `apps/api/tests/test_request_list_read_model.py`
- Create later: `apps/api/app/services/request_list_read_model.py`

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/test_request_list_read_model.py`:

```python
import unittest
from unittest.mock import patch

from app.schemas.users import CurrentUser
from app.services import request_list_read_model


def _user(id="user-1", role="be"):
    return CurrentUser(id=id, email=f"{id}@test.com", name=id, role=role, is_active=True)


class RequestListReadModelTests(unittest.TestCase):
    def test_assigned_view_uses_assigned_repository_function(self):
        with patch("app.services.request_list_read_model.request_repository.list_assigned_requests", return_value=[{"id": "r1"}]) as list_assigned:
            result = request_list_read_model.list_requests("assigned", _user(), limit=25)

        list_assigned.assert_called_once_with("user-1", 25)
        self.assertEqual(result, [{"id": "r1"}])

    def test_created_view_uses_created_repository_function(self):
        with patch("app.services.request_list_read_model.request_repository.list_created_requests", return_value=[{"id": "r1"}]) as list_created:
            result = request_list_read_model.list_requests("created", _user(), limit=25)

        list_created.assert_called_once_with("user-1", 25)
        self.assertEqual(result, [{"id": "r1"}])

    def test_pool_view_uses_pool_repository_function(self):
        with patch("app.services.request_list_read_model.request_repository.list_pool_requests", return_value=[{"id": "r1"}]) as list_pool:
            result = request_list_read_model.list_requests("pool", _user(), limit=25)

        list_pool.assert_called_once_with(25)
        self.assertEqual(result, [{"id": "r1"}])

    def test_done_view_for_non_lead_passes_user_id(self):
        with patch("app.services.request_list_read_model.request_repository.list_done_requests", return_value=[{"id": "r1"}]) as list_done:
            result = request_list_read_model.list_requests("done", _user(role="be"), limit=25)

        list_done.assert_called_once_with(25, "user-1")
        self.assertEqual(result, [{"id": "r1"}])

    def test_done_view_for_lead_passes_no_user_filter(self):
        with patch("app.services.request_list_read_model.request_repository.list_done_requests", return_value=[{"id": "r1"}]) as list_done:
            result = request_list_read_model.list_requests("done", _user(role="lead"), limit=25)

        list_done.assert_called_once_with(25, None)
        self.assertEqual(result, [{"id": "r1"}])

    def test_all_view_requires_lead(self):
        with self.assertRaises(Exception) as ctx:
            request_list_read_model.list_requests("all", _user(role="be"), limit=25)

        self.assertEqual(getattr(ctx.exception, "status_code", None), 403)

    def test_all_view_for_lead_uses_all_repository_function(self):
        with patch("app.services.request_list_read_model.request_repository.list_all_requests", return_value=[{"id": "r1"}]) as list_all:
            result = request_list_read_model.list_requests("all", _user(role="lead"), limit=25)

        list_all.assert_called_once_with(25)
        self.assertEqual(result, [{"id": "r1"}])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_list_read_model
```

Expected: FAIL because `request_list_read_model` does not exist.

### Task 2.2: Implement Request List Read Model

**Files:**
- Create: `apps/api/app/services/request_list_read_model.py`
- Modify later: `apps/api/app/services/request_service.py`

- [ ] **Step 1: Run GitNexus impact analysis**

Run before editing list-related symbols:

```text
gitnexus_impact target="list_requests" direction="upstream" repo="Team-Request-Hub"
gitnexus_impact target="list_assigned_requests" direction="upstream" repo="Team-Request-Hub"
gitnexus_impact target="get_dashboard_data" direction="upstream" repo="Team-Request-Hub"
```

Expected: record direct callers, affected processes, and risk level. Warn the user before edits if risk is HIGH or CRITICAL.

- [ ] **Step 2: Write implementation**

Create `apps/api/app/services/request_list_read_model.py`:

```python
from fastapi import HTTPException, status

from app.core.permissions import is_lead
from app.repositories import request_repository
from app.schemas.users import CurrentUser


def list_requests(view: str, current_user: CurrentUser, limit: int) -> list[dict]:
    if view == "assigned":
        return request_repository.list_assigned_requests(current_user.id, limit)
    if view == "created":
        return request_repository.list_created_requests(current_user.id, limit)
    if view == "pool":
        return request_repository.list_pool_requests(limit)
    if view == "done":
        user_id = None if is_lead(current_user) else current_user.id
        return request_repository.list_done_requests(limit, user_id)
    if view == "all":
        if not is_lead(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only leads can view all requests",
            )
        return request_repository.list_all_requests(limit)

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid request view",
    )
```

- [ ] **Step 3: Run read model tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_list_read_model
```

Expected: PASS.

### Task 2.3: Delegate Request Service List Selection

**Files:**
- Modify: `apps/api/app/services/request_service.py`
- Test: existing request service/route tests.

- [ ] **Step 1: Inspect existing `list_requests` implementation**

Read `apps/api/app/services/request_service.py` and locate the existing `list_requests()` function. Preserve its validation, enrichment, and response shape.

- [ ] **Step 2: Modify import**

Add `request_list_read_model` to service imports. The exact import should follow existing style. If the file already has `from app.services import ...`, include `request_list_read_model` there.

- [ ] **Step 3: Replace repository selection only**

Inside `request_service.list_requests()`, replace the conditional repository selection with:

```python
requests = request_list_read_model.list_requests(view, current_user, limit)
```

Keep the subsequent enrichment call exactly as-is, for example:

```python
return enrich_requests_with_users(requests)
```

If the current function does more than enrichment, preserve those lines and only replace view selection.

- [ ] **Step 4: Run focused request tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_routes tests.test_request_service tests.test_request_list_read_model
```

Expected: PASS. If `tests.test_request_service` does not exist, run the existing request-related tests discovered by `python -m unittest discover tests` and record the exact command used.

### Task 2.4: Add Database Index Migration To Schema File

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `docs/database-schema.md`

- [ ] **Step 1: Search for existing indexes**

Use Grep for these patterns:

```text
idx_request_assignees_user
idx_request_assignees_request
idx_internal_requests_status_created
idx_internal_requests_created_by_created
idx_notifications_user_read_created
```

Expected: identify which indexes already exist. Do not duplicate existing indexes.

- [ ] **Step 2: Add missing indexes**

If missing, add these statements near the schema's existing index section:

```sql
create index if not exists idx_request_assignees_user_assigned_at
  on public.request_assignees (user_id, assigned_at desc);

create index if not exists idx_request_assignees_request_assigned_at
  on public.request_assignees (request_id, assigned_at);

create index if not exists idx_internal_requests_status_created_at
  on public.internal_requests (status, created_at desc);

create index if not exists idx_internal_requests_created_by_created_at
  on public.internal_requests (created_by, created_at desc);

create index if not exists idx_notifications_user_read_created_at
  on public.notifications (user_id, is_read, created_at desc);
```

If an equivalent index exists with a different name, do not add a duplicate; note it in the task result.

- [ ] **Step 3: Update database docs**

In `docs/database-schema.md`, update the `Performance Indexes` section to mention:

```markdown
Request assignment and dashboard views use indexes on `request_assignees(user_id, assigned_at desc)` and `request_assignees(request_id, assigned_at)` so multi-assignee request lists can use `request_assignees` as the source of truth. Dashboard and notification reads use composite indexes for status/creator/recent notification access patterns.
```

- [ ] **Step 4: Verify schema text**

Run a content search to verify the expected index names appear once:

```text
grep pattern="idx_request_assignees_user_assigned_at" path="/mnt/c/Users/THIEN/Desktop/PersonalProject/team-request-hub" include="DB_SCHEMA_TEAM_REQUEST_HUB.sql"
```

Expected: exactly one matching index definition unless an equivalent existing index was intentionally reused.

### Task 2.5: Full Phase 2 Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend test suite**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS or only pre-existing failures documented in Phase 0.

- [ ] **Step 2: Run GitNexus change detection**

Run:

```text
gitnexus_detect_changes scope="all" repo="Team-Request-Hub"
```

Expected: changed symbols are limited to request list read model, request service delegation, database schema/docs, and tests.

- [ ] **Step 3: Commit Phase 2**

Only commit if the user explicitly requested commits for this session. Suggested commit message:

```bash
git add apps/api/app/services/request_list_read_model.py apps/api/app/services/request_service.py apps/api/tests/test_request_list_read_model.py DB_SCHEMA_TEAM_REQUEST_HUB.sql docs/database-schema.md
git commit -m "refactor: centralize request list read model"
```

---

## Follow-Up Phase Plan Creation

### Task 3.0: Create Phase 3 Request Workflow Deepening Plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-31-phase-3-request-workflow-deepening.md`

- [ ] **Step 1: Create a dedicated Phase 3 plan after Phase 1 and Phase 2 pass**

The plan must include tasks for:

```markdown
- Extract `RequestTransitionEngine` with status transition tests.
- Extract `RequestAssignmentEngine` with self-assign, reassign, add, and remove tests.
- Extract `RequestReadModelBuilder` by moving enrichment out of `request_service.py`.
- Add `RequestSideEffectPlanner` for assignment history, status logs, and notification intent.
- Keep route response shapes unchanged.
```

Expected: Do not implement Phase 3 in this roadmap task. Write the phase-specific plan using the same required plan header.

### Task 4.0: Create Phase 4 Notification Event Seam Plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-31-phase-4-notification-event-seam.md`

- [ ] **Step 1: Create a dedicated Phase 4 plan after Phase 3 side-effect planning exists**

The plan must include tasks for:

```markdown
- Add `publish_request_event()` to `notification_module`.
- Keep `_store`, `_telegram`, `_email`, and `_web_push` as internal adapters.
- Move route-level recipient/delivery knowledge behind the notification interface.
- Test assignment and reassignment notification records and channel preference behavior.
```

Expected: Do not implement Phase 4 until the Phase 4 plan is reviewed.

### Task 5.0: Create Phase 5 FileTree Correctness Plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-31-phase-5-filetree-correctness.md`

- [ ] **Step 1: Create a dedicated Phase 5 plan**

The plan must include tasks for:

```markdown
- Add `FileTree` path normalization and descendant-prefix tests.
- Move path calculations out of `file_service.py` incrementally.
- Add repository operations for `rename_subtree()` and `move_subtree()`.
- Verify or add non-purged path uniqueness in the schema.
- Test `/foo` does not match `/foobar`.
```

Expected: Do not implement Phase 5 until the Phase 5 plan is reviewed.

### Task 6.0: Create Phase 6 Frontend Request View Adapter Plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-31-phase-6-frontend-request-view-adapters.md`

- [ ] **Step 1: Create a dedicated Phase 6 plan**

The plan must include tasks for:

```markdown
- Add `useRequestListView(view)` around existing request hooks.
- Add `useRequestActions(request)` for mutation invalidation and UI-ready action state.
- Keep `apiFetch` as the HTTP adapter.
- Refactor `RequestList` to render view state instead of deriving contract behavior.
- Run `npm run lint` and `npm run build` from `apps/web`.
```

Expected: Do not implement Phase 6 until the Phase 6 plan is reviewed.

### Task 7.0: Create Phase 7 Cleanup And Compatibility Exit Plan

**Files:**
- Create: `docs/superpowers/plans/2026-05-31-phase-7-cleanup-docs-compatibility.md`

- [ ] **Step 1: Create a dedicated Phase 7 plan after implementation phases land**

The plan must include tasks for:

```markdown
- Update architecture, API contract, database schema, and permissions docs.
- Remove `assigned_to` fallback outside the assignment adapter.
- Decide whether `assigned_to` remains denormalized or gets deprecated in a separate schema migration.
- Run backend tests, frontend lint/build, and smoke checks.
```

Expected: Do not implement Phase 7 until Phases 1-6 are complete or explicitly scoped down.

---

## Self-Review Checklist

- Spec coverage: Phase 0 through Phase 7 from the design spec are represented.
- Immediate implementation detail: Phase 0 through Phase 2 include exact files, tests, code, commands, and expected outcomes.
- Scoped deferral: Phase 3 through Phase 7 are intentionally plan-creation tasks because they depend on Phase 1-2 outcomes.
- Placeholder scan: no task uses `TBD`, `TODO`, or unspecified implementation instructions.
- Type consistency: Python module names use `request_assignment_read_model` and `request_list_read_model` consistently.
