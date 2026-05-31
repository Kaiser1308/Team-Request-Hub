import os
import unittest
from unittest.mock import patch, MagicMock

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.schemas.users import CurrentUser
from app.services import request_list_read_model


def _user(id="user-1", role="be"):
    return CurrentUser(id=id, email=f"{id}@test.com", name=id, role=role, is_active=True)


class TestAssignedView(unittest.TestCase):
    @patch("app.services.request_list_read_model.request_repository")
    def test_assigned_view_uses_assigned_repository_function(self, mock_repo):
        mock_repo.list_assigned_requests.return_value = [{"id": "r1"}]
        user = _user()

        result = request_list_read_model.list_requests("assigned", user, 50)

        mock_repo.list_assigned_requests.assert_called_once_with(user.id, 50)
        self.assertEqual(result, [{"id": "r1"}])


class TestCreatedView(unittest.TestCase):
    @patch("app.services.request_list_read_model.request_repository")
    def test_created_view_uses_created_repository_function(self, mock_repo):
        mock_repo.list_created_requests.return_value = [{"id": "r2"}]
        user = _user()

        result = request_list_read_model.list_requests("created", user, 50)

        mock_repo.list_created_requests.assert_called_once_with(user.id, 50)
        self.assertEqual(result, [{"id": "r2"}])


class TestPoolView(unittest.TestCase):
    @patch("app.services.request_list_read_model.request_repository")
    def test_pool_view_uses_pool_repository_function(self, mock_repo):
        mock_repo.list_pool_requests.return_value = [{"id": "r3"}]
        user = _user()

        result = request_list_read_model.list_requests("pool", user, 50)

        mock_repo.list_pool_requests.assert_called_once_with(50)
        self.assertEqual(result, [{"id": "r3"}])


class TestDoneView(unittest.TestCase):
    @patch("app.services.request_list_read_model.is_lead")
    @patch("app.services.request_list_read_model.request_repository")
    def test_done_view_for_non_lead_passes_user_id(self, mock_repo, mock_is_lead):
        mock_is_lead.return_value = False
        mock_repo.list_done_requests.return_value = [{"id": "r4"}]
        user = _user()

        result = request_list_read_model.list_requests("done", user, 50)

        mock_repo.list_done_requests.assert_called_once_with(50, user.id)
        self.assertEqual(result, [{"id": "r4"}])

    @patch("app.services.request_list_read_model.is_lead")
    @patch("app.services.request_list_read_model.request_repository")
    def test_done_view_for_lead_passes_no_user_filter(self, mock_repo, mock_is_lead):
        mock_is_lead.return_value = True
        mock_repo.list_done_requests.return_value = [{"id": "r5"}]
        lead = _user(role="lead")

        result = request_list_read_model.list_requests("done", lead, 50)

        mock_repo.list_done_requests.assert_called_once_with(50, None)
        self.assertEqual(result, [{"id": "r5"}])


class TestAllView(unittest.TestCase):
    @patch("app.services.request_list_read_model.is_lead")
    def test_all_view_requires_lead(self, mock_is_lead):
        mock_is_lead.return_value = False
        user = _user()

        with self.assertRaises(Exception) as ctx:
            request_list_read_model.list_requests("all", user, 50)
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("app.services.request_list_read_model.is_lead")
    @patch("app.services.request_list_read_model.request_repository")
    def test_all_view_for_lead_uses_all_repository_function(self, mock_repo, mock_is_lead):
        mock_is_lead.return_value = True
        mock_repo.list_all_requests.return_value = [{"id": "r6"}]
        lead = _user(role="lead")

        result = request_list_read_model.list_requests("all", lead, 50)

        mock_repo.list_all_requests.assert_called_once_with(50)
        self.assertEqual(result, [{"id": "r6"}])


class TestInvalidView(unittest.TestCase):
    def test_invalid_view_raises_400(self):
        user = _user()
        with self.assertRaises(Exception) as ctx:
            request_list_read_model.list_requests("nonexistent", user, 50)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
