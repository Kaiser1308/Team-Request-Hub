import os
import unittest
from unittest.mock import patch, MagicMock

import httpx

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app import notification_module
from app.core.config import Settings


def _make_settings(**overrides):
    defaults = {
        "supabase_url": "http://localhost",
        "supabase_anon_key": "anon",
        "supabase_service_role_key": "service",
        "supabase_jwt_secret": "secret",
        "telegram_bot_token": "bot-token",
    }
    defaults.update(overrides)
    return Settings(**defaults)


class TestTelegramDeliverySkipsNoProfile(unittest.TestCase):
    @patch("app.notification_module.get_settings")
    @patch("app.notification_module._store")
    def test_no_telegram_chat_id_skips_delivery(
        self, mock_store, mock_get_settings
    ):
        mock_get_settings.return_value = _make_settings()
        mock_store.get_user_telegram_profile.return_value = {
            "id": "user-1",
            "telegram_chat_id": None,
            "telegram_username": None,
            "telegram_linked_at": None,
        }

        notification_module.dispatch_telegram_delivery(
            notification={
                "id": "notif-1",
                "user_id": "user-1",
                "type": "assigned",
            },
            request={"id": "req-1", "title": "T", "priority": "high", "status": "pending"},
        )

        mock_store.create_delivery.assert_not_called()


class TestTelegramDeliveryFailureRecordsFailed(unittest.TestCase):
    @patch("app.notification_module.get_settings")
    @patch("app.notification_module._telegram")
    @patch("app.notification_module._store")
    def test_send_failure_marks_delivery_failed(
        self, mock_store, mock_telegram_svc, mock_get_settings
    ):
        mock_get_settings.return_value = _make_settings()
        mock_store.get_user_telegram_profile.return_value = {
            "id": "user-1",
            "telegram_chat_id": "123",
            "telegram_username": "test",
            "telegram_linked_at": "2026-01-01",
        }
        mock_store.create_delivery.return_value = {"id": "delivery-1"}
        mock_telegram_svc.send_telegram_message.side_effect = httpx.HTTPError("timeout")

        notification_module.dispatch_telegram_delivery(
            notification={
                "id": "notif-1",
                "user_id": "user-1",
                "type": "assigned",
            },
            request={"id": "req-1", "title": "T", "priority": "high", "status": "pending"},
        )

        mock_store.create_delivery.assert_called_once()
        mock_store.mark_delivery_failed.assert_called_once_with(
            "delivery-1", "timeout"
        )
        mock_store.mark_delivery_sent.assert_not_called()


class TestTelegramDeliverySuccessRecordsSent(unittest.TestCase):
    @patch("app.notification_module.get_settings")
    @patch("app.notification_module._telegram")
    @patch("app.notification_module._store")
    def test_send_success_marks_delivery_sent(
        self, mock_store, mock_telegram_svc, mock_get_settings
    ):
        mock_get_settings.return_value = _make_settings()
        mock_store.get_user_telegram_profile.return_value = {
            "id": "user-1",
            "telegram_chat_id": "123",
            "telegram_username": "test",
            "telegram_linked_at": "2026-01-01",
        }
        mock_store.create_delivery.return_value = {"id": "delivery-1"}
        mock_telegram_svc.send_telegram_message.return_value = "456"

        notification_module.dispatch_telegram_delivery(
            notification={
                "id": "notif-1",
                "user_id": "user-1",
                "type": "assigned",
            },
            request={"id": "req-1", "title": "T", "priority": "high", "status": "pending"},
        )

        mock_store.create_delivery.assert_called_once()
        mock_store.mark_delivery_sent.assert_called_once()
        mock_store.mark_delivery_failed.assert_not_called()


class TestNoTelegramTokenSkipsDelivery(unittest.TestCase):
    @patch("app.notification_module.get_settings")
    @patch("app.notification_module._store")
    def test_missing_bot_token_skips_delivery(self, mock_store, mock_get_settings):
        mock_get_settings.return_value = _make_settings(telegram_bot_token=None)

        notification_module.dispatch_telegram_delivery(
            notification={
                "id": "notif-1",
                "user_id": "user-1",
                "type": "assigned",
            },
            request={"id": "req-1", "title": "T", "priority": "high", "status": "pending"},
        )

        mock_store.create_delivery.assert_not_called()


if __name__ == "__main__":
    unittest.main()
