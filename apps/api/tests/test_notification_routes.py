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


def _user(id="user-1", role="fe", is_active=True):
    return CurrentUser(id=id, email=f"{id}@test.com", name=id, role=role, is_active=is_active)


class TestListNotificationsRoute(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_list_notifications_returns_200(self):
        app.dependency_overrides[get_current_user] = lambda: _user()

        with patch("app.notification_module.list_notifications", return_value=[]):
            response = TestClient(app).get("/notifications")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_list_notifications_passes_unread_only_param(self):
        app.dependency_overrides[get_current_user] = lambda: _user()

        with patch("app.notification_module.list_notifications", return_value=[]) as mock:
            TestClient(app).get("/notifications?unread_only=true")

        mock.assert_called_once_with("user-1", True)

    def test_inactive_user_rejected_from_notifications(self):
        app.dependency_overrides[get_current_user] = lambda: _user(is_active=False)

        response = TestClient(app).get("/notifications")
        self.assertEqual(response.status_code, 403)


class TestMarkAllReadRoute(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_mark_all_read_returns_updated_count(self):
        app.dependency_overrides[get_current_user] = lambda: _user()

        with patch("app.notification_module.mark_all_notifications_read", return_value={"updated": 5}):
            response = TestClient(app).post("/notifications/read-all")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["updated"], 5)


class TestMarkNotificationReadRoute(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_mark_notification_read_returns_notification(self):
        app.dependency_overrides[get_current_user] = lambda: _user()
        notification = {
            "id": "notif-1",
            "user_id": "user-1",
            "type": "assigned",
            "message": "test",
            "is_read": True,
            "created_at": "2026-01-01T00:00:00Z",
        }

        with patch("app.notification_module.mark_notification_read", return_value=notification):
            response = TestClient(app).post("/notifications/notif-1/read")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["is_read"])


if __name__ == "__main__":
    unittest.main()
