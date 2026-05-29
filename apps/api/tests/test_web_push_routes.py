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


class WebPushRouteTests(unittest.TestCase):
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

    def test_get_public_key_returns_vapid_public_key(self):
        with patch("app.routes.notifications.get_settings") as settings:
            settings.return_value.vapid_public_key = "public-key"
            response = TestClient(app).get("/notifications/web-push/vapid-public-key")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"public_key": "public-key"})

    def test_create_subscription_uses_current_user(self):
        payload = {
            "endpoint": "https://push.example/sub",
            "keys": {"p256dh": "p256dh-key", "auth": "auth-key"},
        }
        with patch("app.routes.notifications.notification_module.upsert_web_push_subscription") as mock_fn:
            mock_fn.return_value = {"id": "sub-1", "endpoint": payload["endpoint"]}
            response = TestClient(app).post(
                "/notifications/web-push/subscriptions",
                json=payload,
                headers={"user-agent": "test-agent"},
            )

        self.assertEqual(response.status_code, 200)
        mock_fn.assert_called_once_with(
            user_id="user-1",
            endpoint="https://push.example/sub",
            p256dh="p256dh-key",
            auth="auth-key",
            user_agent="test-agent",
        )

    def test_revoke_subscription_uses_current_user(self):
        with patch("app.routes.notifications.notification_module.revoke_web_push_subscription") as mock_fn:
            mock_fn.return_value = {"revoked": True}
            response = TestClient(app).delete("/notifications/web-push/subscriptions/sub-1")

        self.assertEqual(response.status_code, 200)
        mock_fn.assert_called_once_with("user-1", "sub-1")


class WebPushStoreTests(unittest.TestCase):
    def test_upsert_web_push_subscription_uses_endpoint_conflict_key(self):
        fake_supabase = _make_supabase_chain([{"id": "sub-1", "endpoint": "https://push.example/sub"}])
        with patch("app.notification_module._store.get_supabase_admin", return_value=fake_supabase):
            from app.notification_module._store import upsert_web_push_subscription
            result = upsert_web_push_subscription(
                user_id="user-1",
                endpoint="https://push.example/sub",
                p256dh="p256dh-key",
                auth="auth-key",
                user_agent="test-agent",
            )

        upsert_call = fake_supabase.table.return_value.upsert
        upsert_call.assert_called_once()
        payload = upsert_call.call_args[0][0]
        self.assertEqual(payload["user_id"], "user-1")
        self.assertEqual(payload["endpoint"], "https://push.example/sub")
        self.assertEqual(payload["p256dh"], "p256dh-key")
        self.assertEqual(payload["auth"], "auth-key")
        self.assertEqual(payload["user_agent"], "test-agent")
        self.assertIsNone(payload["revoked_at"])
        self.assertEqual(upsert_call.call_args[1]["on_conflict"], "endpoint")
        self.assertEqual(result["id"], "sub-1")

    def test_revoke_web_push_subscription_filters_by_user_and_subscription(self):
        fake_supabase = _make_supabase_chain([])
        with patch("app.notification_module._store.get_supabase_admin", return_value=fake_supabase):
            from app.notification_module._store import revoke_web_push_subscription
            revoke_web_push_subscription("user-1", "sub-1")

        update_call = fake_supabase.table.return_value.update
        update_call.assert_called_once()
        # Verify both eq filters were applied
        eq_calls = fake_supabase.eq.call_args_list
        eq_args = [call[0] for call in eq_calls]
        self.assertIn(("id", "sub-1"), eq_args)
        self.assertIn(("user_id", "user-1"), eq_args)


if __name__ == "__main__":
    unittest.main()
