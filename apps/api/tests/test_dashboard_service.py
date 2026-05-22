import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.schemas.users import CurrentUser
from app.services import dashboard


class DashboardServiceTests(unittest.TestCase):
    def test_get_dashboard_summary_uses_small_recent_lists(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        with (
            patch("app.services.dashboard.request_service.list_requests", return_value=[]) as list_requests,
            patch("app.services.dashboard.notifications.list_notifications", return_value=[]),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        self.assertEqual(result["counts"]["assigned"], 0)
        self.assertEqual(result["notifications_unread"], 0)
        self.assertEqual(list_requests.call_count, 4)
        list_requests.assert_any_call("assigned", current_user, limit=10)
        list_requests.assert_any_call("created", current_user, limit=10)
        list_requests.assert_any_call("pool", current_user, limit=10)
        list_requests.assert_any_call("done", current_user, limit=10)


if __name__ == "__main__":
    unittest.main()
