import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app
from app.schemas.users import CurrentUser


class RequestRoutesTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_assignment_history_forwards_limit(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
        )

        with patch("app.routes.requests.request_service.list_assignment_history") as list_history:
            list_history.return_value = []
            response = TestClient(app).get("/requests/request-1/assignment-history?limit=25")

        self.assertEqual(response.status_code, 200)
        list_history.assert_called_once_with("request-1", unittest.mock.ANY, limit=25)

    def test_status_logs_forwards_limit(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
        )

        with patch("app.routes.requests.request_service.list_status_logs") as list_logs:
            list_logs.return_value = []
            response = TestClient(app).get("/requests/request-1/status-logs?limit=25")

        self.assertEqual(response.status_code, 200)
        list_logs.assert_called_once_with("request-1", unittest.mock.ANY, limit=25)

    def test_add_assignee_route_calls_service(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )
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

        with (
            patch(
                "app.routes.requests.request_service.add_request_assignee",
                return_value=response_body,
            ) as add_assignee,
            patch("app.routes.requests.notification_module.dispatch_telegram_background"),
        ):
            response = TestClient(app).post(
                "/requests/request-1/assignees",
                json={"user_id": "user-2", "reason": "Need help"},
            )

        self.assertEqual(response.status_code, 200)
        add_assignee.assert_called_once_with("request-1", "user-2", "Need help", unittest.mock.ANY)

    def test_remove_assignee_route_calls_service(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )
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

        with patch(
            "app.routes.requests.request_service.remove_request_assignee",
            return_value=response_body,
        ) as remove_assignee:
            response = TestClient(app).request(
                "DELETE",
                "/requests/request-1/assignees/user-2",
                json={"reason": "handoff"},
            )

        self.assertEqual(response.status_code, 200)
        remove_assignee.assert_called_once_with("request-1", "user-2", "handoff", unittest.mock.ANY)


if __name__ == "__main__":
    unittest.main()
