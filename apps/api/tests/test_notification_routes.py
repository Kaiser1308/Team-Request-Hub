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


class NotificationRoutesTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_list_notifications_forwards_unread_only_with_default_limit(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
        )

        with patch("app.routes.notifications.notification_module.list_notifications") as list_notifications:
            list_notifications.return_value = []

            response = TestClient(app).get("/notifications?unread_only=true")

        self.assertEqual(response.status_code, 200)
        list_notifications.assert_called_once_with("user-1", True, 50)

    def test_list_notifications_forwards_limit(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
        )

        with patch("app.routes.notifications.notification_module.list_notifications") as list_notifications:
            list_notifications.return_value = []

            response = TestClient(app).get("/notifications?limit=25")

        self.assertEqual(response.status_code, 200)
        list_notifications.assert_called_once_with("user-1", False, 25)


    def test_read_by_type_forwards_types(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
        )

        with patch("app.routes.notifications.notification_module.mark_notifications_read_by_type") as mock_fn:
            mock_fn.return_value = {"updated": 2}

            response = TestClient(app).post(
                "/notifications/read-by-type",
                json={"types": ["assigned", "reassigned"]},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"updated": 2})
        mock_fn.assert_called_once_with("user-1", ["assigned", "reassigned"])


if __name__ == "__main__":
    unittest.main()
