import unittest
from unittest.mock import patch

from app.notification_module import _email, _web_push


REQUEST = {
    "id": "req-1",
    "title": "Fix login",
    "priority": "urgent",
    "status": "pending",
}


class NotificationAdapterTests(unittest.TestCase):
    def test_email_message_contains_request_link(self):
        message = _email.build_assignment_email(
            REQUEST,
            reassigned=False,
            app_base_url="https://app.example.com",
            lang="en",
        )
        self.assertEqual(message["subject"], "You have been assigned a request")
        self.assertIn("Fix login", message["text"])
        self.assertIn("https://app.example.com/requests/req-1", message["text"])

    def test_send_email_uses_smtp_settings(self):
        with patch("app.notification_module._email.smtplib.SMTP") as smtp:
            _email.send_email(
                host="smtp.example.com",
                port=587,
                username="user",
                password="pass",
                from_email="from@example.com",
                from_name="Team Request Hub",
                to_email="to@example.com",
                subject="Subject",
                text="Body",
            )
        smtp.assert_called_once_with("smtp.example.com", 587, timeout=10)
        smtp.return_value.__enter__.return_value.starttls.assert_called_once()
        smtp.return_value.__enter__.return_value.login.assert_called_once_with("user", "pass")

    def test_web_push_payload_contains_url(self):
        payload = _web_push.build_web_push_payload(
            REQUEST,
            notification_id="notif-1",
            reassigned=True,
            app_base_url="https://app.example.com",
            lang="en",
        )
        self.assertEqual(payload["tag"], "notif-1")
        self.assertIn("reassigned", payload["title"].lower())
        self.assertEqual(payload["url"], "https://app.example.com/requests/req-1")


class MultiChannelDispatchTests(unittest.TestCase):
    def test_dispatch_skips_disabled_channels(self):
        from app import notification_module

        notification = {"id": "notif-1", "user_id": "user-1", "type": "assigned"}
        with patch("app.notification_module._store.list_notification_preferences") as prefs, \
             patch("app.notification_module._store.get_user_email") as email, \
             patch("app.notification_module._email.send_email") as send_email:
            prefs.return_value = [
                {"channel": "telegram", "enabled": False},
                {"channel": "email", "enabled": False},
                {"channel": "web_push", "enabled": False},
            ]
            notification_module.dispatch_external_delivery(notification=notification, request=REQUEST)

        email.assert_not_called()
        send_email.assert_not_called()

    def test_dispatch_sends_enabled_email(self):
        from app import notification_module

        notification = {"id": "notif-1", "user_id": "user-1", "type": "assigned"}
        with patch("app.notification_module.get_settings") as settings, \
             patch("app.notification_module._store.list_notification_preferences") as prefs, \
             patch("app.notification_module._store.get_user_email") as get_email, \
             patch("app.notification_module._store.create_delivery") as create_delivery, \
             patch("app.notification_module._store.mark_delivery_sent") as sent, \
             patch("app.notification_module._email.send_email") as send_email:
            settings.return_value.smtp_host = "smtp.example.com"
            settings.return_value.smtp_port = 587
            settings.return_value.smtp_username = "user"
            settings.return_value.smtp_password = "pass"
            settings.return_value.smtp_from_email = "from@example.com"
            settings.return_value.smtp_from_name = "Team Request Hub"
            settings.return_value.app_base_url = "https://app.example.com"
            settings.return_value.telegram_bot_token = None
            settings.return_value.vapid_private_key = None
            settings.return_value.vapid_subject = None
            prefs.return_value = [{"channel": "email", "enabled": True}]
            get_email.return_value = "to@example.com"
            create_delivery.return_value = {"id": "delivery-1"}

            notification_module.dispatch_external_delivery(notification=notification, request=REQUEST)

        send_email.assert_called_once()
        sent.assert_called_once()


if __name__ == "__main__":
    unittest.main()
