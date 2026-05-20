import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.schemas.users import CurrentUser, UserRoleUpdate
from app.services.users import update_user_role


class UserRoleServiceTests(unittest.TestCase):
    def test_non_lead_cannot_update_user_role(self):
        current_user = CurrentUser(
            id="user-1",
            email="fe@example.com",
            name="FE User",
            role="fe",
        )
        payload = UserRoleUpdate(role="be")

        with self.assertRaises(HTTPException) as context:
            update_user_role("user-2", payload, current_user)

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(context.exception.detail, "Only leads can update user roles")

    @patch("app.services.users.user_repository.update_user_role")
    def test_lead_can_update_user_role(self, update_user_role_mock):
        update_user_role_mock.return_value = {
            "id": "user-2",
            "email": "be@example.com",
            "name": "BE User",
            "avatar_url": None,
            "role": "be",
            "created_at": "2026-05-20T00:00:00Z",
        }
        current_user = CurrentUser(
            id="lead-1",
            email="lead@example.com",
            name="Lead User",
            role="lead",
        )
        payload = UserRoleUpdate(role="be")

        result = update_user_role("user-2", payload, current_user)

        update_user_role_mock.assert_called_once_with("user-2", "be")
        self.assertEqual(result["role"], "be")


if __name__ == "__main__":
    unittest.main()
