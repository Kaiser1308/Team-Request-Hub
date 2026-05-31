import os
import unittest
from unittest.mock import patch, MagicMock

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.services import request_assignment_read_model


class TestAssigneeIdsFromRequest(unittest.TestCase):
    def test_assignee_ids_prefer_explicit_assignee_ids(self):
        request = {
            "assignee_ids": ["user-1", "user-2"],
            "assigned_to": "user-3",
        }
        result = request_assignment_read_model.assignee_ids_from_request(request)
        self.assertEqual(result, ["user-1", "user-2"])

    def test_assignee_ids_extract_from_assignees(self):
        request = {
            "assignees": [
                {"id": "user-1", "name": "A"},
                {"id": "user-2", "name": "B"},
            ],
        }
        result = request_assignment_read_model.assignee_ids_from_request(request)
        self.assertEqual(result, ["user-1", "user-2"])

    def test_assignee_ids_fall_back_to_legacy_assigned_to(self):
        request = {"assigned_to": "user-1"}
        result = request_assignment_read_model.assignee_ids_from_request(request)
        self.assertEqual(result, ["user-1"])

    def test_assignee_ids_return_empty_for_unassigned_request(self):
        request = {"assigned_to": None}
        result = request_assignment_read_model.assignee_ids_from_request(request)
        self.assertEqual(result, [])


class TestIsAssignedToUser(unittest.TestCase):
    def test_is_assigned_to_user_uses_normalized_ids(self):
        request = {
            "assignees": [{"id": "user-1"}, {"id": "user-2"}],
            "assigned_to": "user-3",
        }
        self.assertTrue(request_assignment_read_model.is_assigned_to_user(request, "user-1"))
        self.assertTrue(request_assignment_read_model.is_assigned_to_user(request, "user-2"))
        self.assertFalse(request_assignment_read_model.is_assigned_to_user(request, "user-3"))


class TestHasCurrentAssignees(unittest.TestCase):
    def test_has_current_assignees_uses_normalized_ids(self):
        request = {
            "assignees": [{"id": "user-1"}],
        }
        self.assertTrue(request_assignment_read_model.has_current_assignees(request))

    def test_has_current_assignees_false_when_empty(self):
        request = {"assigned_to": None}
        self.assertFalse(request_assignment_read_model.has_current_assignees(request))


class TestGetAssigneeIdsByRequestIds(unittest.TestCase):
    def test_get_assignee_ids_by_request_ids_merges_repository_and_legacy_fallback(self):
        requests = [
            {"id": "r1", "assignee_ids": [], "assigned_to": "user-1"},
            {"id": "r2", "assignee_ids": ["user-3"], "assigned_to": None},
            {"id": "r3", "assignee_ids": [], "assigned_to": None},
        ]

        repo_result = {
            "r1": ["user-2"],
            "r2": [],
            "r3": [],
        }

        with patch(
            "app.services.request_assignment_read_model.request_assignee_repository"
        ) as mock_repo:
            mock_repo.list_assignee_ids_by_request_ids.return_value = repo_result
            result = request_assignment_read_model.get_assignee_ids_by_request_ids(requests)

        self.assertEqual(result["r1"], ["user-2"])
        self.assertEqual(result["r2"], ["user-3"])
        self.assertEqual(result["r3"], [])


if __name__ == "__main__":
    unittest.main()
