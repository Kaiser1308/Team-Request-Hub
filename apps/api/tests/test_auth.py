import os
import unittest
from base64 import urlsafe_b64encode
from types import SimpleNamespace
from unittest.mock import patch

from jose import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.core.auth import clear_current_user_cache, get_current_user
from app.schemas.users import CurrentUser

_JWT_SECRET = os.environ["SUPABASE_JWT_SECRET"]


def build_token(user_id="user-1", email="user@example.com", secret=None):
    return jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": "authenticated",
            "role": "authenticated",
            "iss": "supabase",
        },
        secret or _JWT_SECRET,
        algorithm="HS256",
    )


def _base64url_uint(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return urlsafe_b64encode(raw).rstrip(b"=").decode()


def build_rsa_token(user_id="user-1", email="user@example.com"):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    key_id = "test-key"
    token = jwt.encode(
        {
            "sub": user_id,
            "email": email,
            "aud": "authenticated",
            "role": "authenticated",
            "iss": "https://project.supabase.co/auth/v1",
        },
        private_pem,
        algorithm="RS256",
        headers={"kid": key_id},
    )
    numbers = private_key.public_key().public_numbers()
    jwks = {
        "keys": [
            {
                "kty": "RSA",
                "kid": key_id,
                "alg": "RS256",
                "use": "sig",
                "n": _base64url_uint(numbers.n),
                "e": _base64url_uint(numbers.e),
            }
        ]
    }
    return token, jwks


class FakeTableQuery:
    def __init__(self, supabase, is_active=True):
        self._supabase = supabase
        self._is_active = is_active

    def select(self, _columns):
        return self

    def eq(self, _column, _value):
        return self

    def single(self):
        return self

    def execute(self):
        self._supabase.table_execute_count += 1
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
        self.auth_get_user_count = 0
        self.table_execute_count = 0
        self.auth = SimpleNamespace(get_user=self._get_user)
        self._auth_result = auth_result
        self._is_active = is_active

    def _get_user(self, _token):
        self.auth_get_user_count += 1
        return self._auth_result

    def table(self, _name):
        return FakeTableQuery(self, is_active=self._is_active)


class AuthTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        clear_current_user_cache()

    async def test_current_user_uses_local_jwt_to_validate_access_token(self):
        token = build_token()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        with patch("app.core.auth.user_repository.get_user_profile_or_404", return_value={
            "id": "user-1",
            "email": "user@example.com",
            "name": "User",
            "avatar_url": None,
            "role": "fe",
            "is_active": True,
        }):
            current_user = await get_current_user(credentials)

        self.assertEqual(current_user.id, "user-1")
        self.assertEqual(current_user.email, "user@example.com")
        self.assertEqual(current_user.role, "fe")

    async def test_current_user_cache_reuses_profile_for_same_access_token(self):
        token = build_token()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        profile = {
            "id": "user-1",
            "email": "user@example.com",
            "name": "User",
            "avatar_url": None,
            "role": "fe",
            "is_active": True,
        }

        with patch("app.core.auth.user_repository.get_user_profile_or_404", return_value=profile) as mock_lookup:
            first_user = await get_current_user(credentials)
            second_user = await get_current_user(credentials)

        self.assertEqual(first_user.id, "user-1")
        self.assertEqual(second_user.id, "user-1")
        self.assertEqual(mock_lookup.call_count, 1)

    async def test_current_user_rejects_invalid_supabase_access_token(self):
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad-token")

        with self.assertRaises(HTTPException) as error:
            await get_current_user(credentials)

        self.assertEqual(error.exception.status_code, 401)

    async def test_current_user_returns_is_active_field(self):
        token = build_token()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        with patch("app.core.auth.user_repository.get_user_profile_or_404", return_value={
            "id": "user-1",
            "email": "user@example.com",
            "name": "User",
            "avatar_url": None,
            "role": "fe",
            "is_active": False,
        }):
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

    async def test_current_user_verifies_jwt_locally_without_supabase_auth_call(self):
        token = build_token()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        fake_supabase = FakeSupabase(SimpleNamespace(user=None))

        with (
            patch("app.core.auth.get_supabase_admin", return_value=fake_supabase),
            patch("app.core.auth.user_repository.get_user_profile_or_404", return_value={
                "id": "user-1",
                "email": "user@example.com",
                "name": "User",
                "avatar_url": None,
                "role": "fe",
                "is_active": True,
            }),
        ):
            current_user = await get_current_user(credentials)

        self.assertEqual(current_user.id, "user-1")
        self.assertEqual(fake_supabase.auth_get_user_count, 0)

    async def test_current_user_rejects_invalid_jwt_signature(self):
        token = build_token(secret="wrong-secret")
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        with patch("app.core.auth.get_settings") as settings:
            settings.return_value.supabase_jwt_secret = _JWT_SECRET
            with self.assertRaises(HTTPException) as context:
                await get_current_user(credentials)

        self.assertEqual(context.exception.status_code, 401)

    async def test_current_user_accepts_asymmetric_supabase_jwt_from_jwks(self):
        token, jwks = build_rsa_token()
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

        with (
            patch("app.core.auth.httpx.get") as http_get,
            patch("app.core.auth.user_repository.get_user_profile_or_404", return_value={
                "id": "user-1",
                "email": "user@example.com",
                "name": "User",
                "avatar_url": None,
                "role": "fe",
                "is_active": True,
            }),
        ):
            http_get.return_value.json.return_value = jwks
            http_get.return_value.raise_for_status.return_value = None
            current_user = await get_current_user(credentials)

        self.assertEqual(current_user.id, "user-1")
        http_get.assert_called_once_with(
            "http://localhost/auth/v1/.well-known/jwks.json",
            timeout=5,
        )


if __name__ == "__main__":
    unittest.main()
