import os
import unittest
from unittest.mock import patch, MagicMock

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _auth_headers():
    from jose import jwt as jose_jwt

    token = jose_jwt.encode(
        {
            "sub": "user-1",
            "email": "user@example.com",
            "aud": "authenticated",
            "role": "authenticated",
            "iss": "supabase",
        },
        "secret",
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def _mock_settings(**overrides):
    from app.core.config import Settings

    defaults = {
        "supabase_url": "http://localhost",
        "supabase_anon_key": "anon",
        "supabase_service_role_key": "service",
        "supabase_jwt_secret": "secret",
        "telegram_bot_token": "bot-token",
        "telegram_bot_username": "testbot",
        "telegram_webhook_secret": None,
    }
    defaults.update(overrides)
    return Settings(**defaults)


class TestTelegramProfileEndpoint(unittest.TestCase):
    @patch("app.routes.telegram.require_active_current_user")
    @patch("app.routes.telegram.get_current_user")
    @patch("app.core.auth.user_repository.get_user_profile_or_404")
    @patch("app.notification_module._store")
    def test_profile_returns_linked_false_when_no_chat_id(
        self, mock_repo, mock_user_repo, mock_get_user, mock_require_active
    ):
        from app.schemas.users import CurrentUser

        mock_get_user.return_value = CurrentUser(
            id="user-1", email="u@test.com", role="fe", is_active=True
        )
        mock_require_active.return_value = mock_get_user.return_value
        mock_user_repo.return_value = {
            "id": "user-1",
            "email": "u@test.com",
            "name": "User",
            "avatar_url": None,
            "role": "fe",
            "is_active": True,
        }
        mock_repo.get_user_telegram_profile.return_value = {
            "id": "user-1",
            "telegram_chat_id": None,
            "telegram_username": None,
            "telegram_linked_at": None,
        }

        response = client.get("/notifications/telegram/profile", headers=_auth_headers())

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["linked"])

    @patch("app.routes.telegram.require_active_current_user")
    @patch("app.routes.telegram.get_current_user")
    @patch("app.core.auth.user_repository.get_user_profile_or_404")
    @patch("app.notification_module._store")
    def test_profile_returns_linked_true_when_chat_id_present(
        self, mock_repo, mock_user_repo, mock_get_user, mock_require_active
    ):
        from app.schemas.users import CurrentUser

        mock_get_user.return_value = CurrentUser(
            id="user-1", email="u@test.com", role="fe", is_active=True
        )
        mock_require_active.return_value = mock_get_user.return_value
        mock_user_repo.return_value = {
            "id": "user-1",
            "email": "u@test.com",
            "name": "User",
            "avatar_url": None,
            "role": "fe",
            "is_active": True,
        }
        mock_repo.get_user_telegram_profile.return_value = {
            "id": "user-1",
            "telegram_chat_id": "123",
            "telegram_username": "thien",
            "telegram_linked_at": "2026-01-01T00:00:00Z",
        }

        response = client.get("/notifications/telegram/profile", headers=_auth_headers())

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["linked"])
        self.assertEqual(data["username"], "thien")


class TestTelegramWebhookEndpoint(unittest.TestCase):
    @patch("app.notification_module._webhook.get_settings")
    @patch("app.notification_module._webhook._telegram")
    @patch("app.notification_module._webhook._store")
    def test_start_with_bot_username_links_user(
        self, mock_repo, mock_telegram_svc, mock_get_settings
    ):
        mock_get_settings.return_value = _mock_settings()
        mock_repo.get_valid_link_token.return_value = {
            "id": "token-1",
            "user_id": "user-1",
        }
        mock_repo.link_telegram_user.return_value = {"id": "user-1"}
        mock_telegram_svc.send_telegram_message.return_value = "999"

        response = client.post(
            "/notifications/telegram/webhook",
            json={
                "message": {
                    "chat": {"id": 123456, "username": "thien"},
                    "text": "/start@testbot abc123",
                }
            },
        )

        self.assertEqual(response.status_code, 200)
        mock_repo.link_telegram_user.assert_called_once()
        mock_repo.mark_link_token_used.assert_called_once()

    @patch("app.notification_module._webhook.get_settings")
    @patch("app.notification_module._webhook._telegram")
    @patch("app.notification_module._webhook._store")
    def test_plain_start_without_link_code_sends_guidance(
        self, mock_repo, mock_telegram_svc, mock_get_settings
    ):
        mock_get_settings.return_value = _mock_settings()
        mock_telegram_svc.send_telegram_message.return_value = "999"

        response = client.post(
            "/notifications/telegram/webhook",
            json={
                "message": {
                    "chat": {"id": 123456, "username": "thien"},
                    "text": "/start",
                }
            },
        )

        self.assertEqual(response.status_code, 200)
        mock_repo.get_valid_link_token.assert_not_called()
        mock_telegram_svc.send_telegram_message.assert_called_once()
        call_args = mock_telegram_svc.send_telegram_message.call_args
        self.assertIn("ch\u01b0a c\u00f3 m\u00e3 li\u00ean k\u1ebft", call_args.kwargs["text"])

    @patch("app.notification_module._webhook.get_settings")
    @patch("app.notification_module._webhook._telegram")
    @patch("app.notification_module._webhook._store")
    def test_valid_start_links_user(self, mock_repo, mock_telegram_svc, mock_get_settings):
        mock_get_settings.return_value = _mock_settings()
        mock_repo.get_valid_link_token.return_value = {
            "id": "token-1",
            "user_id": "user-1",
        }
        mock_repo.link_telegram_user.return_value = {"id": "user-1"}
        mock_telegram_svc.send_telegram_message.return_value = "999"

        response = client.post(
            "/notifications/telegram/webhook",
            json={
                "message": {
                    "chat": {"id": 123456, "username": "thien"},
                    "text": "/start abc123",
                }
            },
        )

        self.assertEqual(response.status_code, 200)
        mock_repo.link_telegram_user.assert_called_once()
        mock_repo.mark_link_token_used.assert_called_once()
        mock_telegram_svc.send_telegram_message.assert_called()

    @patch("app.notification_module._webhook.get_settings")
    @patch("app.notification_module._webhook._telegram")
    @patch("app.notification_module._webhook._store")
    def test_invalid_code_sends_failure_message(self, mock_repo, mock_telegram_svc, mock_get_settings):
        mock_get_settings.return_value = _mock_settings()
        mock_repo.get_valid_link_token.return_value = None
        mock_telegram_svc.send_telegram_message.return_value = "999"

        response = client.post(
            "/notifications/telegram/webhook",
            json={
                "message": {
                    "chat": {"id": 123456, "username": "thien"},
                    "text": "/start invalid_code",
                }
            },
        )

        self.assertEqual(response.status_code, 200)
        mock_repo.link_telegram_user.assert_not_called()
        mock_telegram_svc.send_telegram_message.assert_called_once()
        call_args = mock_telegram_svc.send_telegram_message.call_args
        self.assertIn("không hợp lệ", call_args.kwargs["text"])

    @patch("app.notification_module._webhook.get_settings")
    @patch("app.notification_module._webhook._store")
    def test_non_start_message_returns_ok(self, mock_repo, mock_get_settings):
        mock_get_settings.return_value = _mock_settings()

        response = client.post(
            "/notifications/telegram/webhook",
            json={
                "message": {
                    "chat": {"id": 123456, "username": "thien"},
                    "text": "Hello bot",
                }
            },
        )

        self.assertEqual(response.status_code, 200)
        mock_repo.get_valid_link_token.assert_not_called()

    @patch("app.notification_module._webhook.get_settings")
    @patch("app.notification_module._webhook._telegram")
    @patch("app.notification_module._webhook._store")
    def test_webhook_rejects_bad_secret(self, mock_repo, mock_telegram_svc, mock_get_settings):
        mock_get_settings.return_value = _mock_settings(telegram_webhook_secret="my-secret")

        response = client.post(
            "/notifications/telegram/webhook",
            headers={"x-telegram-bot-api-secret-token": "wrong"},
            json={
                "message": {
                    "chat": {"id": 123456},
                    "text": "/start abc",
                }
            },
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data["ok"])


if __name__ == "__main__":
    unittest.main()
