import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.services import notifications


class NotificationAsyncTests(unittest.TestCase):
    def test_create_notification_does_not_dispatch_telegram(self):
        with patch(
            "app.services.notifications.notification_repository.create_notification",
            return_value={"id": "notif-1", "user_id": "u1", "type": "assigned"},
        ):
            with patch("app.services.notifications.dispatch_telegram_delivery") as dispatch:
                notifications.create_notification(
                    user_id="u1",
                    request_id="req-1",
                    notification_type="assigned",
                    message="test",
                )
                dispatch.assert_not_called()

    def test_notify_assigned_returns_notification_dict(self):
        with patch(
            "app.services.notifications.notification_repository.create_notification",
            return_value={"id": "notif-1", "user_id": "u1", "type": "assigned"},
        ):
            result = notifications.notify_assigned("u1", {"id": "r1", "title": "T"})
            self.assertEqual(result["id"], "notif-1")

    def test_dispatch_telegram_background_skips_when_no_bot_token(self):
        with patch(
            "app.services.notifications.get_settings",
            return_value=type(
                "Settings",
                (),
                {"telegram_bot_token": None, "app_base_url": "http://localhost"},
            )(),
        ):
            result = notifications.dispatch_telegram_background(
                "u1", {"id": "r1", "title": "T", "priority": "medium", "status": "pending"}, False
            )
            self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
