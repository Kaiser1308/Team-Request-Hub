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


class UserRoutesTests(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()

    def tearDown(self):
        app.dependency_overrides.clear()

    def test_lead_updates_user_role(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead User",
            role="lead",
        )

        with patch("app.services.users.user_repository.update_user_role") as update_role:
            update_role.return_value = {
                "id": "user-1",
                "email": "user@example.com",
                "name": "User",
                "avatar_url": None,
                "role": "be",
                "created_at": "2026-05-20T00:00:00Z",
            }

            response = TestClient(app).patch(
                "/users/user-1/role",
                json={"role": "be"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["role"], "be")
        update_role.assert_called_once_with("user-1", "be")

    def test_non_lead_role_update_returns_403(self):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            id="user-1",
            email="fe@example.com",
            name="FE User",
            role="fe",
        )

        response = TestClient(app).patch(
            "/users/user-2/role",
            json={"role": "be"},
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "Only leads can update user roles")


if __name__ == "__main__":
    unittest.main()
