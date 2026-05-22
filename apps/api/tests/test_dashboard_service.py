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
    def test_get_dashboard_summary_calls_repository_once(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=[],
            ) as get_data,
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                return_value=[],
            ),
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        get_data.assert_called_once_with("user-1")
        self.assertEqual(result["counts"]["assigned"], 0)
        self.assertEqual(result["notifications_unread"], 0)


if __name__ == "__main__":
    unittest.main()
