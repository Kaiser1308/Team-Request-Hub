import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.schemas.requests import CancelRequest, DoneRequest, InternalRequestCreate, InternalRequestUpdate
from app.schemas.users import CurrentUser
from app.services import request_service
from app.services.request_service import ensure_open_request, ensure_request_assigned


def _user(id="user-1", role="fe"):
    return CurrentUser(id=id, email=f"{id}@test.com", name=id, role=role, is_active=True)


def _request(**overrides):
    base = {
        "id": "req-1",
        "title": "Test",
        "description": "Desc",
        "tags": [],
        "priority": "medium",
        "status": "pending",
        "created_by": "creator-1",
        "assigned_to": None,
        "reference_links": [],
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    base.update(overrides)
    return base


class TestEnsureOpenRequest(unittest.TestCase):
    def test_open_request_passes(self):
        for status in ("pending", "acknowledged", "in_progress"):
            ensure_open_request({"status": status})

    def test_done_request_is_closed(self):
        with self.assertRaises(HTTPException) as ctx:
            ensure_open_request({"status": "done"})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already closed", ctx.exception.detail)

    def test_cancelled_request_is_closed(self):
        with self.assertRaises(HTTPException) as ctx:
            ensure_open_request({"status": "cancelled"})
        self.assertEqual(ctx.exception.status_code, 400)


class TestEnsureRequestAssigned(unittest.TestCase):
    def test_assigned_request_passes(self):
        ensure_request_assigned({"assigned_to": "user-1"})

    def test_unassigned_request_fails(self):
        with self.assertRaises(HTTPException) as ctx:
            ensure_request_assigned({"assigned_to": None})
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("must be assigned", ctx.exception.detail)


class TestCreateRequest(unittest.TestCase):
    def test_create_request_sets_pending_and_created_by(self):
        payload = InternalRequestCreate(
            title="New Request",
            description="Please help",
        )
        created = _request(id="new-1", status="pending", created_by="user-1")

        with (
            patch("app.services.request_service.request_repository.create_request", return_value=created),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.create_request(payload, _user())

        self.assertEqual(result["status"], "pending")
        self.assertEqual(result["created_by"], "user-1")

    def test_create_request_with_assignee_records_assignment(self):
        payload = InternalRequestCreate(
            title="New Request",
            description="Please help",
            assigned_to="assignee-1",
        )
        created = _request(id="new-1", assigned_to="assignee-1")

        with (
            patch("app.services.request_service.users.ensure_active_user") as ensure_active,
            patch("app.services.request_service.request_repository.create_request", return_value=created),
            patch("app.services.request_service.assignment_repository.create_assignment_history") as record,
            patch("app.services.request_service.notification_module.notify_assigned") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.create_request(payload, _user())

        ensure_active.assert_called_once_with("assignee-1")
        record.assert_called_once()
        notify.assert_called_once_with("assignee-1", created)
        self.assertEqual(result["assigned_to"], "assignee-1")

    def test_create_request_without_assignee_skips_assignment(self):
        payload = InternalRequestCreate(
            title="New Request",
            description="Please help",
        )
        created = _request(id="new-1", assigned_to=None)

        with (
            patch("app.services.request_service.request_repository.create_request", return_value=created),
            patch("app.services.request_service.assignment_repository.create_assignment_history") as record,
            patch("app.services.request_service.notification_module.notify_assigned") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            request_service.create_request(payload, _user())

        record.assert_not_called()
        notify.assert_not_called()


class TestSelfAssignRequest(unittest.TestCase):
    def test_self_assign_sets_current_user_as_assignee(self):
        req = _request(assigned_to=None)
        updated = {**req, "assigned_to": "user-1"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.assign_if_unassigned", return_value=updated),
            patch("app.services.request_service.assignment_repository.create_assignment_history") as record,
            patch("app.services.request_service.notification_module.notify_request_picked_up") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.self_assign_request("req-1", _user())

        self.assertEqual(result["assigned_to"], "user-1")
        record.assert_called_once()

    def test_self_assign_already_assigned_raises_conflict(self):
        req = _request(created_by="user-1", assigned_to="other-user")

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
        ):
            with self.assertRaises(HTTPException) as ctx:
                request_service.self_assign_request("req-1", _user())
            self.assertEqual(ctx.exception.status_code, 409)
            self.assertIn("already assigned", ctx.exception.detail)

    def test_self_assign_closed_request_raises_bad_request(self):
        req = _request(status="done", assigned_to=None)

        with patch("app.services.request_service.request_repository.get_request_or_404", return_value=req):
            with self.assertRaises(HTTPException) as ctx:
                request_service.self_assign_request("req-1", _user())
            self.assertEqual(ctx.exception.status_code, 400)

    def test_self_assign_notifies_creator_when_different_user(self):
        req = _request(created_by="creator-1", assigned_to=None)
        updated = {**req, "assigned_to": "user-1"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.assign_if_unassigned", return_value=updated),
            patch("app.services.request_service.assignment_repository.create_assignment_history"),
            patch("app.services.request_service.notification_module.notify_request_picked_up") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            request_service.self_assign_request("req-1", _user())

        notify.assert_called_once_with("creator-1", updated)

    def test_self_assign_by_creator_skips_notification(self):
        req = _request(created_by="user-1", assigned_to=None)
        updated = {**req, "assigned_to": "user-1"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.assign_if_unassigned", return_value=updated),
            patch("app.services.request_service.assignment_repository.create_assignment_history"),
            patch("app.services.request_service.notification_module.notify_request_picked_up") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            request_service.self_assign_request("req-1", _user())

        notify.assert_not_called()


class TestCancelRequest(unittest.TestCase):
    def test_lead_can_cancel_request(self):
        req = _request(status="pending", created_by="other", assigned_to="other2")
        updated = {**req, "status": "cancelled"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.update_request", return_value=updated),
            patch("app.services.request_service.status_log_repository.create_status_log") as log,
            patch("app.services.request_service.notification_module.notify_cancelled") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.cancel_request("req-1", CancelRequest(), _user(role="lead"))

        self.assertEqual(result["status"], "cancelled")
        log.assert_called_once()

    def test_creator_can_cancel_own_request(self):
        req = _request(status="pending", created_by="user-1", assigned_to=None)
        updated = {**req, "status": "cancelled"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.update_request", return_value=updated),
            patch("app.services.request_service.status_log_repository.create_status_log"),
            patch("app.services.request_service.notification_module.notify_cancelled") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.cancel_request("req-1", CancelRequest(), _user())

        self.assertEqual(result["status"], "cancelled")

    def test_cancel_notifies_assignee_when_different_from_canceller(self):
        req = _request(status="in_progress", created_by="user-1", assigned_to="assignee-1")
        updated = {**req, "status": "cancelled"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.update_request", return_value=updated),
            patch("app.services.request_service.status_log_repository.create_status_log"),
            patch("app.services.request_service.notification_module.notify_cancelled") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            request_service.cancel_request("req-1", CancelRequest(reason="No longer needed"), _user())

        notify.assert_called_once_with("assignee-1", updated)

    def test_cancel_skips_notification_when_no_assignee(self):
        req = _request(status="pending", created_by="user-1", assigned_to=None)
        updated = {**req, "status": "cancelled"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.update_request", return_value=updated),
            patch("app.services.request_service.status_log_repository.create_status_log"),
            patch("app.services.request_service.notification_module.notify_cancelled") as notify,
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            request_service.cancel_request("req-1", CancelRequest(), _user())

        notify.assert_not_called()

    def test_cancel_closed_request_raises_bad_request(self):
        req = _request(status="done", created_by="user-1")

        with patch("app.services.request_service.request_repository.get_request_or_404", return_value=req):
            with self.assertRaises(HTTPException) as ctx:
                request_service.cancel_request("req-1", CancelRequest(), _user())
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("already closed", ctx.exception.detail)

    def test_non_creator_non_lead_cannot_cancel(self):
        req = _request(status="pending", created_by="other")

        with patch("app.services.request_service.request_repository.get_request_or_404", return_value=req):
            with self.assertRaises(HTTPException) as ctx:
                request_service.cancel_request("req-1", CancelRequest(), _user())
            self.assertEqual(ctx.exception.status_code, 403)


class TestGetRequestDetail(unittest.TestCase):
    def test_lead_can_view_any_request(self):
        req = _request(created_by="other", assigned_to="other2")

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.get_request_detail("req-1", _user(role="lead"))

        self.assertEqual(result["id"], "req-1")

    def test_creator_can_view_own_request(self):
        req = _request(created_by="user-1", assigned_to="other")

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.get_request_detail("req-1", _user())

        self.assertEqual(result["id"], "req-1")

    def test_non_involved_user_cannot_view(self):
        req = _request(created_by="other", assigned_to="other2")

        with patch("app.services.request_service.request_repository.get_request_or_404", return_value=req):
            with self.assertRaises(HTTPException) as ctx:
                request_service.get_request_detail("req-1", _user())
            self.assertEqual(ctx.exception.status_code, 403)


class TestUpdateRequest(unittest.TestCase):
    def test_creator_can_update_own_open_request(self):
        req = _request(created_by="user-1", status="pending")
        updated = {**req, "title": "Updated"}
        payload = InternalRequestUpdate(title="Updated")

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.request_repository.update_request", return_value=updated),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.update_request("req-1", payload, _user())

        self.assertEqual(result["title"], "Updated")

    def test_update_closed_request_raises_bad_request(self):
        req = _request(created_by="user-1", status="done")
        payload = InternalRequestUpdate(title="Updated")

        with patch("app.services.request_service.request_repository.get_request_or_404", return_value=req):
            with self.assertRaises(HTTPException) as ctx:
                request_service.update_request("req-1", payload, _user())
            self.assertEqual(ctx.exception.status_code, 400)

    def test_non_creator_non_lead_cannot_update(self):
        req = _request(created_by="other", status="pending")
        payload = InternalRequestUpdate(title="Updated")

        with patch("app.services.request_service.request_repository.get_request_or_404", return_value=req):
            with self.assertRaises(HTTPException) as ctx:
                request_service.update_request("req-1", payload, _user())
            self.assertEqual(ctx.exception.status_code, 403)

    def test_update_with_empty_payload_returns_unchanged(self):
        req = _request(created_by="user-1", status="pending")
        payload = InternalRequestUpdate()

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=req),
            patch("app.services.request_service.user_repository.list_user_summaries", return_value={}),
        ):
            result = request_service.update_request("req-1", payload, _user())

        self.assertEqual(result["title"], req["title"])


if __name__ == "__main__":
    unittest.main()
