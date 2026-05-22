import os
import unittest

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.services import telegram


class TestBuildAssignmentMessage(unittest.TestCase):
    def test_assigned_uses_vietnamese_labels(self):
        request = {
            "id": "req-1",
            "title": "Sửa lỗi đăng nhập",
            "priority": "urgent",
            "status": "pending",
        }

        message = telegram.build_assignment_message(
            request,
            reassigned=False,
            app_base_url="http://localhost:3000",
        )

        self.assertIn("Bạn vừa được giao task mới", message)
        self.assertIn("Tiêu đề: Sửa lỗi đăng nhập", message)
        self.assertIn("Độ ưu tiên: Khẩn cấp", message)
        self.assertIn("Trạng thái: Đang chờ", message)
        self.assertIn("http://localhost:3000/requests/req-1", message)

    def test_reassigned_uses_reassigned_heading(self):
        request = {
            "id": "req-1",
            "title": "Cập nhật API",
            "priority": "high",
            "status": "pending",
        }

        message = telegram.build_assignment_message(
            request,
            reassigned=True,
            app_base_url="http://localhost:3000",
        )

        self.assertIn("Bạn vừa được giao lại một task", message)
        self.assertIn("Độ ưu tiên: Cao", message)

    def test_unknown_priority_falls_back_to_raw_value(self):
        request = {
            "id": "req-2",
            "title": "Test",
            "priority": "custom",
            "status": "in_progress",
        }

        message = telegram.build_assignment_message(
            request,
            reassigned=False,
            app_base_url="http://localhost:3000",
        )

        self.assertIn("Độ ưu tiên: custom", message)
        self.assertIn("Trạng thái: Đang xử lý", message)


if __name__ == "__main__":
    unittest.main()
