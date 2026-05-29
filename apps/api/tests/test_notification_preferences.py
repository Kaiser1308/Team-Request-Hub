import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from fastapi.testclient import TestClient

from app.core.auth import get_current_user
from app.main import app
from app.schemas.users import CurrentUser


def _make_supabase_chain(data):
    """Build a mock Supabase client that returns *data* from .execute()."""
    execute = MagicMock()
    execute.execute.return_value = SimpleNamespace(data=data)
    chain = MagicMock()
    chain.table.return_value = chain
    chain.select.return_value = chain
    chain.insert.return_value = chain
    chain.upsert.return_value = chain
    chain.update.return_value = chain
    chain.eq.return_value = chain
    chain.is_.return_value = chain
    chain.limit.return_value = chain
    chain.execute = execute.execute
    return chain


class NotificationPreferenceRouteTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="fe",
            is_active=True,
        )

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_get_preferences_uses_current_user(self):
        with patch("app.routes.notifications.notification_module.list_notification_preferences") as mock_fn:
            mock_fn.return_value = [
                {"channel": "telegram", "enabled": True},
                {"channel": "email", "enabled": True},
                {"channel": "web_push", "enabled": False},
            ]
            response = TestClient(app).get("/notifications/preferences")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[1]["channel"], "email")
        mock_fn.assert_called_once_with("user-1")

    def test_update_preferences_uses_current_user(self):
        with patch("app.routes.notifications.notification_module.update_notification_preferences") as mock_fn:
            mock_fn.return_value = [
                {"channel": "telegram", "enabled": True},
                {"channel": "email", "enabled": False},
                {"channel": "web_push", "enabled": True},
            ]
            response = TestClient(app).patch(
                "/notifications/preferences",
                json={"email": False, "web_push": True},
            )

        self.assertEqual(response.status_code, 200)
        mock_fn.assert_called_once_with("user-1", {"email": False, "web_push": True})


class NotificationPreferenceStoreTests(unittest.TestCase):
    def test_default_preferences_include_all_channels_when_no_rows(self):
        fake_supabase = _make_supabase_chain([])
        with patch("app.notification_module._store.get_supabase_admin", return_value=fake_supabase):
            from app.notification_module._store import list_notification_preferences
            result = list_notification_preferences("user-1")

        channels = [r["channel"] for r in result]
        self.assertEqual(channels, ["telegram", "email", "web_push"])
        self.assertTrue(all(r["enabled"] for r in result))

    def test_update_preferences_upserts_only_requested_channels(self):
        fake_supabase = _make_supabase_chain([])
        with patch("app.notification_module._store.get_supabase_admin", return_value=fake_supabase):
            from app.notification_module._store import update_notification_preferences
            update_notification_preferences("user-1", {"email": False})

        upsert_call = fake_supabase.table.return_value.upsert
        upsert_call.assert_called_once()
        rows = upsert_call.call_args[0][0]
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["user_id"], "user-1")
        self.assertEqual(rows[0]["channel"], "email")
        self.assertFalse(rows[0]["enabled"])


if __name__ == "__main__":
    unittest.main()
