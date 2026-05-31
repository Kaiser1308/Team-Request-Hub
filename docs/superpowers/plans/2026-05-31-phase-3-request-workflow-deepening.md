# Phase 3 Request Workflow Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `request_service.py` responsibility by extracting request workflow rules and read-model enrichment into focused modules while preserving routes, response shapes, and behavior.

**Architecture:** Keep `request_service.py` as the orchestration module. Move pure or mostly pure rule logic into `request_transition_engine.py`, move assignment guard helpers into `request_assignment_engine.py`, and move request enrichment into `request_read_model_builder.py`. Do not change notification dispatch behavior in this phase; Phase 4 owns notification event publishing.

**Tech Stack:** FastAPI, Python unittest, Supabase repository modules, GitNexus.

---

## Required Context

- Read `docs/superpowers/specs/2026-05-31-architecture-optimization-roadmap-design.md`.
- Read `docs/superpowers/plans/2026-05-31-architecture-optimization-roadmap.md`.
- Phase 0-2 are complete and committed.
- Baseline before this phase: `uv --cache-dir .uv-cache run python -m unittest discover tests` passes with 213 tests.
- Before editing any existing symbol, run GitNexus impact analysis and record risk in task notes.
- Do not change API response shapes.
- Do not move notification logic into a new event interface in this phase.

## File Structure

- Create: `apps/api/app/services/request_transition_engine.py`
  - Owns closed/open checks, status transition validation, status update data, done precondition, reassign reason precondition, and assigned precondition.
- Create: `apps/api/tests/test_request_transition_engine.py`
  - Tests the extracted transition/rule functions directly.
- Create: `apps/api/app/services/request_assignment_engine.py`
  - Owns assignee-management guards currently embedded in `request_service.py`.
- Create: `apps/api/tests/test_request_assignment_engine.py`
  - Tests assignment guard behavior directly.
- Create: `apps/api/app/services/request_read_model_builder.py`
  - Owns `enrich_requests_with_users()` and `enrich_request_with_users()`.
- Create: `apps/api/tests/test_request_read_model_builder.py`
  - Tests enrichment with primary assignee, multi-assignees, creator, and fallback behavior.
- Modify: `apps/api/app/services/request_service.py`
  - Delegates to the new modules and keeps public orchestration functions.
- Modify: existing request service tests only when import paths need updating.

---

## Task 3.1: Extract Request Transition Engine

**Files:**
- Create: `apps/api/app/services/request_transition_engine.py`
- Create: `apps/api/tests/test_request_transition_engine.py`
- Modify: `apps/api/app/services/request_service.py`
- Modify: `apps/api/tests/test_request_service_rules.py`
- Modify: `apps/api/tests/test_request_service_create_assign_cancel.py`

- [ ] **Step 1: Run GitNexus impact analysis**

Run before editing symbols:

```text
gitnexus_impact target="ensure_open_request" direction="upstream" file_path="apps/api/app/services/request_service.py" kind="Function" repo="Team-Request-Hub"
gitnexus_impact target="ensure_status_transition_allowed" direction="upstream" file_path="apps/api/app/services/request_service.py" kind="Function" repo="Team-Request-Hub"
gitnexus_impact target="build_status_update_data" direction="upstream" file_path="apps/api/app/services/request_service.py" kind="Function" repo="Team-Request-Hub"
```

Expected: Record risk. Warn user before editing if any result is HIGH or CRITICAL.

- [ ] **Step 2: Write direct transition engine tests**

Create `apps/api/tests/test_request_transition_engine.py`:

```python
import unittest

from fastapi import HTTPException

from app.services import request_transition_engine as engine


class RequestTransitionEngineTests(unittest.TestCase):
    def test_open_request_passes(self):
        for status in ("pending", "acknowledged", "in_progress"):
            engine.ensure_open_request({"status": status})

    def test_done_request_is_closed(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_open_request({"status": "done"})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Request is already closed")

    def test_pending_can_transition_to_acknowledged(self):
        engine.ensure_status_transition_allowed("pending", "acknowledged")

    def test_pending_cannot_transition_directly_to_done(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_status_transition_allowed("pending", "done")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Use /done endpoint")

    def test_invalid_transition_raises_bad_request(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_status_transition_allowed("pending", "in_progress")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Invalid status transition")

    def test_done_requires_in_progress_status(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_done_allowed({"status": "acknowledged"})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Request must be in_progress before done")

    def test_reassign_active_request_requires_reason(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_reassign_reason({"status": "in_progress"}, None)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Reason is required to reassign an active request")

    def test_request_must_be_assigned_before_status_change(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_request_assigned({"assigned_to": None, "assignee_ids": []})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Request must be assigned before status can change")

    def test_acknowledged_status_sets_acknowledged_timestamp(self):
        data = engine.build_status_update_data("acknowledged", now="2026-05-20T01:02:03+00:00")
        self.assertEqual(data, {"status": "acknowledged", "acknowledged_at": "2026-05-20T01:02:03+00:00"})

    def test_in_progress_status_sets_started_timestamp(self):
        data = engine.build_status_update_data("in_progress", now="2026-05-20T01:02:03+00:00")
        self.assertEqual(data, {"status": "in_progress", "started_at": "2026-05-20T01:02:03+00:00"})

    def test_cancelled_status_sets_cancelled_timestamp(self):
        data = engine.build_status_update_data("cancelled", now="2026-05-20T01:02:03+00:00")
        self.assertEqual(data, {"status": "cancelled", "cancelled_at": "2026-05-20T01:02:03+00:00"})

    def test_pending_status_has_no_timestamp(self):
        self.assertEqual(engine.build_status_update_data("pending", now="unused"), {"status": "pending"})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run test to verify it fails**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_transition_engine
```

Expected: FAIL because `request_transition_engine` does not exist.

- [ ] **Step 4: Create transition engine implementation**

Create `apps/api/app/services/request_transition_engine.py`:

```python
from fastapi import HTTPException, status

from app.utils.time import utc_now_iso

CLOSED_STATUSES = {"done", "cancelled"}
ACTIVE_STATUSES = {"acknowledged", "in_progress"}
ALLOWED_STATUS_TRANSITIONS = {
    "pending": {"acknowledged", "cancelled"},
    "acknowledged": {"in_progress", "cancelled"},
    "in_progress": {"acknowledged", "cancelled"},
}


def ensure_open_request(request: dict) -> None:
    if request.get("status") in CLOSED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request is already closed",
        )


def ensure_status_transition_allowed(from_status: str, to_status: str) -> None:
    if to_status == "done":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Use /done endpoint",
        )

    allowed_statuses = ALLOWED_STATUS_TRANSITIONS.get(from_status, set())
    if to_status not in allowed_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status transition",
        )


def ensure_reassign_reason(request: dict, reason: str | None) -> None:
    if request.get("status") in ACTIVE_STATUSES and not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason is required to reassign an active request",
        )


def ensure_done_allowed(request: dict) -> None:
    if request.get("status") != "in_progress":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request must be in_progress before done",
        )


def ensure_request_assigned(request: dict) -> None:
    assignee_ids = request.get("assignee_ids") or []
    if not assignee_ids and request.get("assigned_to") is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request must be assigned before status can change",
        )


def build_status_update_data(next_status: str, now: str | None = None) -> dict:
    timestamp = now or utc_now_iso()
    data = {"status": next_status}

    if next_status == "acknowledged":
        data["acknowledged_at"] = timestamp
    elif next_status == "in_progress":
        data["started_at"] = timestamp
    elif next_status == "cancelled":
        data["cancelled_at"] = timestamp

    return data
```

- [ ] **Step 5: Delegate request_service transition functions**

Modify `apps/api/app/services/request_service.py`:

```python
from app.services import request_list_read_model, request_transition_engine, users
```

Then replace local function bodies with delegations so existing imports keep working:

```python
CLOSED_STATUSES = request_transition_engine.CLOSED_STATUSES
ACTIVE_STATUSES = request_transition_engine.ACTIVE_STATUSES
ALLOWED_STATUS_TRANSITIONS = request_transition_engine.ALLOWED_STATUS_TRANSITIONS


def ensure_open_request(request: dict) -> None:
    request_transition_engine.ensure_open_request(request)


def ensure_status_transition_allowed(from_status: str, to_status: str) -> None:
    request_transition_engine.ensure_status_transition_allowed(from_status, to_status)


def ensure_reassign_reason(request: dict, reason: str | None) -> None:
    request_transition_engine.ensure_reassign_reason(request, reason)


def ensure_done_allowed(request: dict) -> None:
    request_transition_engine.ensure_done_allowed(request)


def ensure_request_assigned(request: dict) -> None:
    request_transition_engine.ensure_request_assigned(request)


def build_status_update_data(next_status: str, now: str | None = None) -> dict:
    return request_transition_engine.build_status_update_data(next_status, now)
```

- [ ] **Step 6: Run focused tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_transition_engine tests.test_request_service_rules tests.test_request_service_create_assign_cancel tests.test_request_service_workflow
```

Expected: PASS.

---

## Task 3.2: Extract Request Assignment Engine Guards

**Files:**
- Create: `apps/api/app/services/request_assignment_engine.py`
- Create: `apps/api/tests/test_request_assignment_engine.py`
- Modify: `apps/api/app/services/request_service.py`

- [ ] **Step 1: Run GitNexus impact analysis**

```text
gitnexus_impact target="ensure_can_manage_assignees" direction="upstream" file_path="apps/api/app/services/request_service.py" kind="Function" repo="Team-Request-Hub"
```

Expected: Record risk. Warn user before editing if HIGH or CRITICAL.

- [ ] **Step 2: Write assignment engine tests**

Create `apps/api/tests/test_request_assignment_engine.py`:

```python
import unittest

from fastapi import HTTPException

from app.schemas.users import CurrentUser
from app.services import request_assignment_engine as engine


def _user(id="user-1", role="fe"):
    return CurrentUser(id=id, email=f"{id}@test.com", name=id, role=role, is_active=True)


class RequestAssignmentEngineTests(unittest.TestCase):
    def test_lead_can_manage_assignees(self):
        engine.ensure_can_manage_assignees(_user(role="lead"), {"created_by": "other", "assignee_ids": []})

    def test_creator_can_manage_assignees(self):
        engine.ensure_can_manage_assignees(_user(), {"created_by": "user-1", "assignee_ids": []})

    def test_current_assignee_can_manage_assignees(self):
        engine.ensure_can_manage_assignees(_user(), {"created_by": "other", "assignee_ids": ["user-1"]})

    def test_non_involved_user_cannot_manage_assignees(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_manage_assignees(_user(), {"created_by": "other", "assignee_ids": ["other-user"]})
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(ctx.exception.detail, "You cannot manage assignees for this request")

    def test_existing_assignee_cannot_be_added_again(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_add_assignee({"assignee_ids": ["user-1"]}, "user-1")
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.detail, "User is already assigned to this request")

    def test_missing_assignee_cannot_be_removed(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_remove_assignee({"status": "pending", "assignee_ids": ["user-1"]}, "missing", None)
        self.assertEqual(ctx.exception.status_code, 404)
        self.assertEqual(ctx.exception.detail, "Assignee not found on request")

    def test_active_remove_requires_reason(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_remove_assignee({"status": "in_progress", "assignee_ids": ["user-1", "user-2"]}, "user-1", None)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Reason is required to remove assignee from active request")

    def test_active_remove_rejects_last_assignee(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_remove_assignee({"status": "acknowledged", "assignee_ids": ["user-1"]}, "user-1", "Need change")
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "Cannot remove the last assignee from an active request")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run test to verify it fails**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_assignment_engine
```

Expected: FAIL because `request_assignment_engine` does not exist.

- [ ] **Step 4: Create assignment engine implementation**

Create `apps/api/app/services/request_assignment_engine.py`:

```python
from fastapi import HTTPException, status

from app.schemas.users import CurrentUser
from app.services import request_transition_engine


def is_lead(current_user: CurrentUser) -> bool:
    return current_user.role == "lead"


def ensure_can_manage_assignees(current_user: CurrentUser, request: dict) -> None:
    if is_lead(current_user) or request["created_by"] == current_user.id:
        return
    if current_user.id in (request.get("assignee_ids") or []):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You cannot manage assignees for this request",
    )


def ensure_can_add_assignee(request: dict, user_id: str) -> None:
    if user_id in request.get("assignee_ids", []):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already assigned to this request",
        )


def ensure_can_remove_assignee(request: dict, user_id: str, reason: str | None) -> None:
    assignee_ids = request.get("assignee_ids", [])
    if user_id not in assignee_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignee not found on request")
    if request.get("status") in request_transition_engine.ACTIVE_STATUSES and not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reason is required to remove assignee from active request",
        )
    if request.get("status") in request_transition_engine.ACTIVE_STATUSES and len(assignee_ids) == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the last assignee from an active request",
        )
```

- [ ] **Step 5: Delegate request_service assignment guard**

Modify `apps/api/app/services/request_service.py`:

```python
from app.services import request_assignment_engine, request_list_read_model, request_transition_engine, users
```

Replace `ensure_can_manage_assignees()` body with:

```python
def ensure_can_manage_assignees(current_user: CurrentUser, request: dict) -> None:
    request_assignment_engine.ensure_can_manage_assignees(current_user, request)
```

In `add_request_assignee()`, replace the duplicate check with:

```python
request_assignment_engine.ensure_can_add_assignee(request, user_id)
```

In `remove_request_assignee()`, replace the inline validation block for missing assignee, active reason, and last assignee with:

```python
request_assignment_engine.ensure_can_remove_assignee(request, user_id, reason)
```

- [ ] **Step 6: Run focused tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_assignment_engine tests.test_request_service_create_assign_cancel tests.test_request_service_workflow tests.test_request_routes
```

Expected: PASS.

---

## Task 3.3: Extract Request Read Model Builder

**Files:**
- Create: `apps/api/app/services/request_read_model_builder.py`
- Create: `apps/api/tests/test_request_read_model_builder.py`
- Modify: `apps/api/app/services/request_service.py`
- Modify: `apps/api/tests/test_request_service_workflow.py`

- [ ] **Step 1: Run GitNexus impact analysis**

```text
gitnexus_impact target="enrich_requests_with_users" direction="upstream" file_path="apps/api/app/services/request_service.py" kind="Function" repo="Team-Request-Hub"
```

Expected: Record risk. Warn user before editing if HIGH or CRITICAL.

- [ ] **Step 2: Write read model builder tests**

Create `apps/api/tests/test_request_read_model_builder.py`:

```python
import unittest
from unittest.mock import patch

from app.services import request_read_model_builder as builder


class RequestReadModelBuilderTests(unittest.TestCase):
    def test_enriches_creator_and_assignees(self):
        requests = [{"id": "r1", "created_by": "creator-1", "assigned_to": "legacy-1"}]
        users_by_id = {
            "creator-1": {"id": "creator-1", "email": "creator@example.com", "name": "Creator"},
            "user-1": {"id": "user-1", "email": "u1@example.com", "name": "U1"},
            "user-2": {"id": "user-2", "email": "u2@example.com", "name": "U2"},
        }

        with (
            patch("app.services.request_read_model_builder.request_assignee_repository.list_assignee_ids_by_request_ids", return_value={"r1": ["user-1", "user-2"]}),
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value=users_by_id) as list_users,
        ):
            result = builder.enrich_requests_with_users(requests)

        self.assertEqual(result[0]["creator"]["id"], "creator-1")
        self.assertEqual([assignee["id"] for assignee in result[0]["assignees"]], ["user-1", "user-2"])
        self.assertEqual(result[0]["assignee"]["id"], "user-1")
        self.assertEqual(result[0]["assigned_to"], "user-1")
        self.assertEqual(result[0]["assignee_ids"], ["user-1", "user-2"])
        list_users.assert_called_once()

    def test_falls_back_to_legacy_assigned_to_when_assignee_query_fails(self):
        requests = [{"id": "r1", "created_by": "creator-1", "assigned_to": "legacy-1"}]
        users_by_id = {
            "creator-1": {"id": "creator-1", "email": "creator@example.com", "name": "Creator"},
            "legacy-1": {"id": "legacy-1", "email": "legacy@example.com", "name": "Legacy"},
        }

        with (
            patch("app.services.request_read_model_builder.request_assignee_repository.list_assignee_ids_by_request_ids", side_effect=Exception("db unavailable")),
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value=users_by_id),
        ):
            result = builder.enrich_requests_with_users(requests)

        self.assertEqual(result[0]["assignee"]["id"], "legacy-1")
        self.assertEqual(result[0]["assigned_to"], "legacy-1")
        self.assertEqual(result[0]["assignee_ids"], ["legacy-1"])

    def test_enrich_request_with_users_returns_single_item(self):
        request = {"id": "r1", "created_by": "creator-1", "assigned_to": None}
        users_by_id = {"creator-1": {"id": "creator-1", "email": "creator@example.com", "name": "Creator"}}

        with (
            patch("app.services.request_read_model_builder.request_assignee_repository.list_assignee_ids_by_request_ids", return_value={"r1": []}),
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value=users_by_id),
        ):
            result = builder.enrich_request_with_users(request)

        self.assertEqual(result["id"], "r1")
        self.assertEqual(result["creator"]["id"], "creator-1")
```

- [ ] **Step 3: Run test to verify it fails**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_read_model_builder
```

Expected: FAIL because `request_read_model_builder` does not exist.

- [ ] **Step 4: Create read model builder implementation**

Create `apps/api/app/services/request_read_model_builder.py` by moving the current `enrich_requests_with_users()` and `enrich_request_with_users()` implementation from `request_service.py` without changing behavior:

```python
from app.repositories import request_assignee_repository, user_repository


def enrich_requests_with_users(requests: list[dict]) -> list[dict]:
    request_ids = [request["id"] for request in requests if request.get("id")]
    try:
        assignee_ids_by_request = request_assignee_repository.list_assignee_ids_by_request_ids(
            request_ids
        )
    except Exception:
        assignee_ids_by_request = {
            request.get("id"): ([request.get("assigned_to")] if request.get("assigned_to") else [])
            for request in requests
            if request.get("id")
        }

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
        item["assignee_ids"] = assignee_ids
        enriched.append(item)
    return enriched


def enrich_request_with_users(request: dict) -> dict:
    return enrich_requests_with_users([request])[0]
```

- [ ] **Step 5: Delegate request_service enrichment functions**

Modify `apps/api/app/services/request_service.py`:

```python
from app.services import request_assignment_engine, request_list_read_model, request_read_model_builder, request_transition_engine, users
```

Replace local enrichment function bodies with:

```python
def enrich_requests_with_users(requests: list[dict]) -> list[dict]:
    return request_read_model_builder.enrich_requests_with_users(requests)


def enrich_request_with_users(request: dict) -> dict:
    return request_read_model_builder.enrich_request_with_users(request)
```

Remove direct `user_repository` import from `request_service.py` if no longer used.

- [ ] **Step 6: Update request service workflow test mocks if needed**

If tests patch `app.services.request_service.user_repository.list_user_summaries`, update those patches to:

```python
patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value={})
```

Only update tests that fail because enrichment moved.

- [ ] **Step 7: Run focused tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_request_read_model_builder tests.test_request_service_workflow tests.test_request_service_create_assign_cancel tests.test_request_routes
```

Expected: PASS.

---

## Task 3.4: Full Phase 3 Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend full suite**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

- [ ] **Step 2: Run GitNexus change detection**

```text
gitnexus_detect_changes scope="all" repo="Team-Request-Hub"
```

Expected: changed symbols are limited to request workflow extraction modules, request service delegations, and tests.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
rtk git diff --stat
```

Expected: diff shows the new modules, their tests, and focused request service/test updates.

- [ ] **Step 4: Commit Phase 3**

Only commit if explicitly requested. Suggested commit message:

```bash
git add apps/api/app/services/request_transition_engine.py apps/api/app/services/request_assignment_engine.py apps/api/app/services/request_read_model_builder.py apps/api/app/services/request_service.py apps/api/tests/test_request_transition_engine.py apps/api/tests/test_request_assignment_engine.py apps/api/tests/test_request_read_model_builder.py apps/api/tests/test_request_service_rules.py apps/api/tests/test_request_service_create_assign_cancel.py apps/api/tests/test_request_service_workflow.py apps/api/tests/test_request_routes.py docs/superpowers/plans/2026-05-31-phase-3-request-workflow-deepening.md
git commit -m "refactor: deepen request workflow modules"
```

---

## Self-Review Checklist

- Spec coverage: Phase 3 requirements map to transition engine, assignment engine, and read model builder extraction.
- Scope control: notification event publishing remains deferred to Phase 4.
- Compatibility: existing `request_service.py` public helper functions remain available as delegating wrappers.
- Tests: each new module has direct tests; existing workflow tests continue to pass.
- Placeholder scan: no unspecified implementation steps remain.
