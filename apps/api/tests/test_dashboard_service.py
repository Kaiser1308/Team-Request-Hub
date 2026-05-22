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

    def test_get_dashboard_summary_makes_single_request_query(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        mock_request = {
            "id": "req-1",
            "title": "Test",
            "description": "Desc",
            "tags": [],
            "priority": "medium",
            "status": "pending",
            "created_by": "user-2",
            "assigned_to": "user-1",
            "reference_links": [],
            "created_at": "2026-05-22T00:00:00Z",
            "updated_at": "2026-05-22T00:00:00Z",
        }
        mock_enriched = dict(mock_request)
        mock_enriched["creator"] = {"id": "user-2", "email": "b@b.com", "name": "B"}
        mock_enriched["assignee"] = {"id": "user-1", "email": "a@a.com", "name": "A"}

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=[mock_request],
            ) as get_data,
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                return_value=[mock_enriched],
            ) as enrich,
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        get_data.assert_called_once_with("user-1")
        enrich.assert_called_once_with([mock_request])
        self.assertEqual(result["counts"]["assigned"], 1)
        self.assertEqual(result["counts"]["urgent"], 0)
        self.assertIn("assigned_recent", result)

    def test_dashboard_summary_computes_counts_correctly(self):
        current_user = CurrentUser(
            id="user-1",
            email="user@example.com",
            name="User",
            role="be",
            is_active=True,
        )

        assigned_req = {
            "id": "r1", "title": "A", "description": "", "tags": [],
            "priority": "high", "status": "pending",
            "created_by": "user-2", "assigned_to": "user-1",
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        created_req = {
            "id": "r2", "title": "C", "description": "", "tags": [],
            "priority": "urgent", "status": "pending",
            "created_by": "user-1", "assigned_to": None,
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        pool_req = {
            "id": "r3", "title": "P", "description": "", "tags": [],
            "priority": "low", "status": "pending",
            "created_by": "user-2", "assigned_to": None,
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }
        done_req = {
            "id": "r4", "title": "D", "description": "", "tags": [],
            "priority": "medium", "status": "done",
            "created_by": "user-1", "assigned_to": "user-2",
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }

        raw_data = [assigned_req, created_req, pool_req, done_req]

        def noop_enrich(requests):
            enriched = []
            user_map = {"user-1": {"id": "user-1", "name": "Me"}, "user-2": {"id": "user-2", "name": "Other"}}
            for r in requests:
                e = dict(r)
                e["creator"] = user_map.get(r.get("created_by"))
                e["assignee"] = user_map.get(r.get("assigned_to"))
                enriched.append(e)
            return enriched

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=raw_data,
            ),
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                side_effect=noop_enrich,
            ),
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(current_user)

        self.assertEqual(result["counts"]["assigned"], 1)
        self.assertEqual(result["counts"]["created"], 2)
        self.assertEqual(result["counts"]["pool"], 2)
        self.assertEqual(result["counts"]["done"], 1)
        self.assertEqual(result["counts"]["urgent"], 1)

    def test_lead_dashboard_sees_all_done(self):
        lead_user = CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead",
            role="lead",
            is_active=True,
        )

        done_by_other = {
            "id": "r1", "title": "D", "description": "", "tags": [],
            "priority": "low", "status": "done",
            "created_by": "user-3", "assigned_to": "user-4",
            "reference_links": [], "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        }

        def noop_enrich(requests):
            enriched = []
            for r in requests:
                e = dict(r)
                e["creator"] = None
                e["assignee"] = None
                enriched.append(e)
            return enriched

        with (
            patch(
                "app.services.dashboard.request_repository.get_dashboard_data",
                return_value=[done_by_other],
            ),
            patch(
                "app.services.dashboard.request_service.enrich_requests_with_users",
                side_effect=noop_enrich,
            ),
            patch(
                "app.services.dashboard.notifications.list_notifications",
                return_value=[],
            ),
        ):
            result = dashboard.get_dashboard_summary(lead_user)

        self.assertEqual(result["counts"]["done"], 1)


if __name__ == "__main__":
    unittest.main()
