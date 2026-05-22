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


if __name__ == "__main__":
    unittest.main()
