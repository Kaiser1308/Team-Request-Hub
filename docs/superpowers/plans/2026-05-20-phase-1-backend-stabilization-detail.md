# Phase 1 Backend Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the FastAPI backend after the service/repository refactor by adding route-level and workflow side-effect tests, then verifying imports and compilation through the `uv` environment.

**Architecture:** Backend remains `routes -> services -> repositories -> Supabase`. This phase should not add new product features; it proves that the current role endpoint and request workflow side effects behave as expected. Tests should mock repository boundaries and avoid real Supabase calls.

**Tech Stack:** FastAPI, FastAPI TestClient, Python unittest, unittest.mock, Pydantic, uv, Supabase Python client.

---

## Phase Scope

In scope:

```txt
- Add backend route-level test for PATCH /users/{user_id}/role.
- Add backend service tests for request workflow side effects.
- Verify backend imports and compilation using uv.
- Fix only bugs exposed by these tests.
```

Out of scope:

```txt
- Frontend code.
- Real Supabase integration testing.
- DB schema changes.
- New request workflow features.
- New API endpoints.
- Refactoring beyond what is needed for tests to pass.
```

Known current state:

```txt
- apps/api/tests/test_request_service_rules.py exists.
- apps/api/tests/test_user_service_roles.py exists.
- apps/api/app/services/request_service.py exists.
- apps/api/app/repositories/* exists.
- PATCH /users/{user_id}/role exists.
- Backend tests currently run with uv.
```

Risk:

```txt
- The repo has uncommitted backend refactor/docs changes. Do not revert unrelated changes.
- Tests must avoid real Supabase calls by overriding auth dependencies or patching repositories.
- Route import tests need dummy env variables because settings require Supabase env keys.
```

---

## Files

Create:

```txt
apps/api/tests/test_users_routes.py
apps/api/tests/test_request_service_workflow.py
```

Modify only if tests expose bugs:

```txt
apps/api/app/routes/users.py
apps/api/app/services/users.py
apps/api/app/services/request_service.py
apps/api/app/services/notifications.py
apps/api/app/services/assignments.py
apps/api/app/services/status_logs.py
```

Do not modify:

```txt
apps/web/*
DB_SCHEMA_TEAM_REQUEST_HUB.sql
apps/api/app/repositories/* unless a test exposes a repository contract bug
```

---

## Task 1: Add Route-Level Test For Lead Role Update

**Files:**

- Create: `apps/api/tests/test_users_routes.py`
- Modify if required: `apps/api/app/routes/users.py`

- [ ] **Step 1: Write the route test**

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

    def test_non_lead_role_update_returns_403(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="fe@example.com",
            name="FE User",
            role="fe",
        )

        response = TestClient(app).patch(
            "/users/user-2/role",
            json={"role": "be"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Only leads can update user roles")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the new route test**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_users_routes
```

Expected:

```txt
Ran 2 tests
OK
```

If it fails with `pydantic_settings` missing env values, rerun with dummy env:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "import os; os.environ['SUPABASE_URL']='http://localhost'; os.environ['SUPABASE_ANON_KEY']='anon'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='service'; os.environ['SUPABASE_JWT_SECRET']='secret'; import unittest; unittest.main(module='tests.test_users_routes')"
```

- [ ] **Step 3: Fix route shape only if needed**

If route path or response model is wrong, make `apps/api/app/routes/users.py` contain this endpoint:

```python
@router.patch("/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
):
    return users.update_user_role(user_id, payload, current_user)
```

- [ ] **Step 4: Rerun route test**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_users_routes
```

Expected:

```txt
OK
```

---

## Task 2: Add Request Workflow Side-Effect Tests

**Files:**

- Create: `apps/api/tests/test_request_service_workflow.py`
- Modify if required: `apps/api/app/services/request_service.py`

- [ ] **Step 1: Write workflow tests with mocked repositories/services**

Create `apps/api/tests/test_request_service_workflow.py`:

```python
import unittest
from unittest.mock import patch

from app.schemas.requests import DoneRequest, ReassignRequest, StatusUpdateRequest
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
        record_assignment.assert_called_once_with(
            request_id="request-1",
            from_user_id="old-user",
            to_user_id="new-user",
            assigned_by="lead-1",
            reason="Wrong owner",
        )
        record_status_change.assert_called_once_with(
            request_id="request-1",
            from_status="in_progress",
            to_status="pending",
            changed_by="lead-1",
            reason="Wrong owner",
        )
        self.assertEqual(notify_reassigned.call_count, 2)

    def test_update_status_records_log_and_notifies_creator(self):
        current_user = CurrentUser(
            id="assignee-1",
            email="assignee@example.com",
            name="Assignee",
            role="be",
        )
        original_request = {
            "id": "request-1",
            "title": "Fix API",
            "status": "pending",
            "created_by": "creator-1",
            "assigned_to": "assignee-1",
        }
        updated_request = {
            **original_request,
            "status": "acknowledged",
        }

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=original_request),
            patch("app.services.request_service.request_repository.update_request", return_value=updated_request),
            patch("app.services.request_service.status_logs.record_status_change") as record_status_change,
            patch("app.services.request_service.notifications.notify_status_changed") as notify_status_changed,
        ):
            result = request_service.update_status(
                "request-1",
                StatusUpdateRequest(status="acknowledged"),
                current_user,
            )

        self.assertEqual(result["status"], "acknowledged")
        record_status_change.assert_called_once_with(
            request_id="request-1",
            from_status="pending",
            to_status="acknowledged",
            changed_by="assignee-1",
            reason=None,
        )
        notify_status_changed.assert_called_once_with("creator-1", updated_request)

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
        record_status_change.assert_called_once_with(
            request_id="request-1",
            from_status="in_progress",
            to_status="done",
            changed_by="assignee-1",
            reason=None,
        )
        notify_done.assert_called_once_with("creator-1", updated_request)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run workflow tests**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow
```

Expected:

```txt
Ran 3 tests
OK
```

- [ ] **Step 3: Fix only missing side effects if tests fail**

If `reassign_request` misses assignment/status/notification calls, update `apps/api/app/services/request_service.py` with the existing helper calls:

```python
assignments.record_assignment(...)
status_logs.record_status_change(...)
notifications.notify_reassigned(...)
```

If `update_status` misses log or notification calls, ensure it calls:

```python
status_logs.record_status_change(
    request_id=request_id,
    from_status=request.get("status"),
    to_status=payload.status,
    changed_by=current_user.id,
    reason=payload.reason,
)
notifications.notify_status_changed(updated_request["created_by"], updated_request)
```

If `mark_done` misses log or notification calls, ensure it calls:

```python
status_logs.record_status_change(
    request_id=request_id,
    from_status=request.get("status"),
    to_status="done",
    changed_by=current_user.id,
    reason=None,
)
notifications.notify_done(updated_request["created_by"], updated_request)
```

- [ ] **Step 4: Rerun workflow tests**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_request_service_workflow
```

Expected:

```txt
OK
```

---

## Task 3: Run Full Backend Verification

**Files:**

- Modify only if verification exposes import or syntax bugs.

- [ ] **Step 1: Run all backend tests**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected:

```txt
OK
```

- [ ] **Step 2: Run compile check**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m compileall app tests
```

Expected: command exits with code 0.

- [ ] **Step 3: Run import check with dummy env**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "import os; os.environ['SUPABASE_URL']='http://localhost'; os.environ['SUPABASE_ANON_KEY']='anon'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='service'; os.environ['SUPABASE_JWT_SECRET']='secret'; import app.main; print('import ok')"
```

Expected:

```txt
import ok
```

- [ ] **Step 4: List routes to verify endpoint registration**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "import os; os.environ['SUPABASE_URL']='http://localhost'; os.environ['SUPABASE_ANON_KEY']='anon'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='service'; os.environ['SUPABASE_JWT_SECRET']='secret'; from app.main import app; print('\n'.join(sorted(route.path for route in app.routes if hasattr(route, 'path'))))"
```

Expected output includes:

```txt
/health
/notifications
/notifications/read-all
/notifications/{notification_id}/read
/requests
/requests/{request_id}
/requests/{request_id}/assignment-history
/requests/{request_id}/cancel
/requests/{request_id}/done
/requests/{request_id}/reassign
/requests/{request_id}/self-assign
/requests/{request_id}/status
/requests/{request_id}/status-logs
/users
/users/me
/users/{user_id}/role
```

---

## Task 4: Update Phase Status

**Files:**

- Modify: `docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md`

- [ ] **Step 1: Add Phase 1 completion note**

Append this under `### Phase 1: Backend Stabilization` after the "Done when" section:

```md
**Completion note:**

```txt
Completed when route-level user role tests, request workflow side-effect tests,
backend unittest discovery, compileall, and import checks pass.
```
```

- [ ] **Step 2: Run backend tests again**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected:

```txt
OK
```

---

## Done Criteria

Phase 1 is complete when:

```txt
- apps/api/tests/test_users_routes.py exists and passes.
- apps/api/tests/test_request_service_workflow.py exists and passes.
- uv --cache-dir .uv-cache run python -m unittest discover tests passes.
- uv --cache-dir .uv-cache run python -m compileall app tests passes.
- import app.main with dummy env prints import ok.
- route listing includes /users/{user_id}/role and request history/log endpoints.
- No frontend files were changed for this phase.
```

## Verification Commands

Run all commands from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
uv --cache-dir .uv-cache run python -c "import os; os.environ['SUPABASE_URL']='http://localhost'; os.environ['SUPABASE_ANON_KEY']='anon'; os.environ['SUPABASE_SERVICE_ROLE_KEY']='service'; os.environ['SUPABASE_JWT_SECRET']='secret'; import app.main; print('import ok')"
```

## Commit Plan

Use one commit after all Phase 1 checks pass:

```bash
git add apps/api/tests/test_users_routes.py apps/api/tests/test_request_service_workflow.py apps/api/app docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md
git commit -m "test: stabilize backend workflow phase"
```

If production code does not change, omit `apps/api/app` from `git add`.

## Self-Review

Spec coverage:

```txt
- Route-level role update coverage maps to Phase 1 roadmap task.
- Workflow side-effect coverage maps to assignment history, status logs, and notification verification.
- Import/compile checks map to backend stabilization done criteria.
```

Placeholder scan:

```txt
- No unfinished placeholder markers.
- All tasks include exact files, commands, expected outputs, and code blocks.
```

Type consistency:

```txt
- Uses existing CurrentUser, ReassignRequest, StatusUpdateRequest, DoneRequest.
- Uses existing service function names: reassign_request, update_status, mark_done.
```
