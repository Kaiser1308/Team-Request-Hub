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
