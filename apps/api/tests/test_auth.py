import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.core.auth import get_current_user
from app.schemas.users import CurrentUser


class FakeTableQuery:
    def __init__(self, is_active=True):
        self._is_active = is_active

    def select(self, _columns):
        return self

    def eq(self, _column, _value):
        return self

    def single(self):
        return self

    def execute(self):
        return SimpleNamespace(
            data={
                "id": "user-1",
                "email": "user@example.com",
                "name": "User",
                "avatar_url": None,
                "role": "fe",
                "is_active": self._is_active,
            }
        )


class FakeSupabase:
    def __init__(self, auth_result, is_active=True):
        self.auth = SimpleNamespace(get_user=lambda _token: auth_result)
        self._is_active = is_active

    def table(self, _name):
        return FakeTableQuery(is_active=self._is_active)


class AuthTests(unittest.IsolatedAsyncioTestCase):
    async def test_current_user_uses_supabase_auth_to_validate_access_token(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="access-token")
        auth_result = SimpleNamespace(
            user=SimpleNamespace(id="user-1", email="user@example.com")
        )

        with patch("app.core.auth.get_supabase_admin", return_value=FakeSupabase(auth_result)):
            current_user = await get_current_user(credentials)

        self.assertEqual(current_user.id, "user-1")
        self.assertEqual(current_user.email, "user@example.com")
        self.assertEqual(current_user.role, "fe")

    async def test_current_user_rejects_invalid_supabase_access_token(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad-token")
        fake_supabase = FakeSupabase(SimpleNamespace(user=None))

        with patch("app.core.auth.get_supabase_admin", return_value=fake_supabase):
            with self.assertRaises(HTTPException) as error:
                await get_current_user(credentials)

        self.assertEqual(error.exception.status_code, 401)

    async def test_current_user_returns_is_active_field(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="access-token")
        auth_result = SimpleNamespace(
            user=SimpleNamespace(id="user-1", email="user@example.com")
        )

        with patch("app.core.auth.get_supabase_admin", return_value=FakeSupabase(auth_result, is_active=False)):
            current_user = await get_current_user(credentials)

        self.assertFalse(current_user.is_active)

    def test_require_active_current_user_rejects_inactive_user(self):
        from app.core.auth import require_active_current_user

        inactive_user = CurrentUser(
            id="user-1",
            email="inactive@example.com",
            name="Inactive",
            role="fe",
            is_active=False,
        )

        with self.assertRaises(HTTPException) as context:
            require_active_current_user(inactive_user)

        self.assertEqual(context.exception.status_code, 403)
        self.assertEqual(context.exception.detail, "Your account is pending lead approval")

    def test_require_active_current_user_allows_active_user(self):
        from app.core.auth import require_active_current_user

        active_user = CurrentUser(
            id="user-1",
            email="active@example.com",
            name="Active",
            role="fe",
            is_active=True,
        )

        result = require_active_current_user(active_user)
        self.assertEqual(result.id, "user-1")


if __name__ == "__main__":
    unittest.main()
