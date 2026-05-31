import unittest
from unittest.mock import patch

from fastapi import HTTPException

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
            patch("app.services.request_service.assignment_repository.create_assignment_history") as record_assignment,
            patch("app.services.request_service.status_log_repository.create_status_log") as record_status_change,
            patch("app.services.request_service.notification_module.notify_reassigned") as notify_reassigned,
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value={}),
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
            patch("app.services.request_service.status_log_repository.create_status_log") as record_status_change,
            patch("app.services.request_service.notification_module.notify_status_changed") as notify_status_changed,
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value={}),
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
            patch("app.services.request_service.status_log_repository.create_status_log") as record_status_change,
            patch("app.services.request_service.notification_module.notify_done") as notify_done,
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value={}),
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

    def test_list_requests_enriches_creator_and_assignee(self):
        current_user = CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead",
            role="lead",
            is_active=True,
        )
        requests = [
            {
                "id": "request-1",
                "created_by": "creator-1",
                "assigned_to": "assignee-1",
                "status": "pending",
            }
        ]
        users_by_id = {
            "creator-1": {"id": "creator-1", "email": "creator@example.com", "name": "Creator", "avatar_url": None},
            "assignee-1": {"id": "assignee-1", "email": "assignee@example.com", "name": "Assignee", "avatar_url": None},
        }

        with (
            patch("app.services.request_service.request_repository.list_all_requests", return_value=requests),
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value=users_by_id),
        ):
            result = request_service.list_requests("all", current_user)

        self.assertEqual(result[0]["creator"]["email"], "creator@example.com")
        self.assertEqual(result[0]["assignee"]["email"], "assignee@example.com")

    def test_list_assignment_history_normalizes_limit_and_forwards(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )
        request = {"id": "request-1", "created_by": "user-1", "assigned_to": "user-1", "status": "pending"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=request),
            patch("app.services.request_service.assignment_repository.list_assignment_history", return_value=[]) as list_history,
        ):
            request_service.list_assignment_history("request-1", current_user)
            request_service.list_assignment_history("request-1", current_user, limit=0)
            request_service.list_assignment_history("request-1", current_user, limit=999)

        self.assertEqual(list_history.call_args_list[0].kwargs["limit"], 50)
        self.assertEqual(list_history.call_args_list[1].kwargs["limit"], 1)
        self.assertEqual(list_history.call_args_list[2].kwargs["limit"], 100)

    def test_list_status_logs_normalizes_limit_and_forwards(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )
        request = {"id": "request-1", "created_by": "user-1", "assigned_to": "user-1", "status": "pending"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=request),
            patch("app.services.request_service.status_log_repository.list_status_logs", return_value=[]) as list_logs,
        ):
            request_service.list_status_logs("request-1", current_user)
            request_service.list_status_logs("request-1", current_user, limit=-3)
            request_service.list_status_logs("request-1", current_user, limit=1000)

        self.assertEqual(list_logs.call_args_list[0].kwargs["limit"], 50)
        self.assertEqual(list_logs.call_args_list[1].kwargs["limit"], 1)
        self.assertEqual(list_logs.call_args_list[2].kwargs["limit"], 100)

    def test_list_assignment_history_rejects_user_without_access(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )
        request = {"id": "request-1", "created_by": "user-2", "assigned_to": "user-3", "status": "pending"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=request),
            patch("app.services.request_service.assignment_repository.list_assignment_history", return_value=[]) as list_history,
        ):
            with self.assertRaises(HTTPException) as ctx:
                request_service.list_assignment_history("request-1", current_user, limit=25)

        self.assertEqual(ctx.exception.status_code, 403)
        list_history.assert_not_called()

    def test_list_status_logs_rejects_user_without_access(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )
        request = {"id": "request-1", "created_by": "user-2", "assigned_to": "user-3", "status": "pending"}

        with (
            patch("app.services.request_service.request_repository.get_request_or_404", return_value=request),
            patch("app.services.request_service.status_log_repository.list_status_logs", return_value=[]) as list_logs,
        ):
            with self.assertRaises(HTTPException) as ctx:
                request_service.list_status_logs("request-1", current_user, limit=25)

        self.assertEqual(ctx.exception.status_code, 403)
        list_logs.assert_not_called()


if __name__ == "__main__":
    unittest.main()
