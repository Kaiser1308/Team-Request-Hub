import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.core.exceptions import BadRequestError, ConflictError, ForbiddenError, NotFoundError
from app.schemas.users import CurrentUser
from app.services import request_attachment_service


def _user(uid: str, role: str = "fe") -> CurrentUser:
    return CurrentUser(
        id=uid, email=f"{uid}@example.com", name=uid, role=role, is_active=True,
        avatar_url=None,
    )


class AddAttachmentsTests(unittest.TestCase):
    def test_creator_can_add_links_and_logs_activity(self):
        req = {"id": "r1", "created_by": "u1", "status": "pending"}
        att = {
            "id": "a1", "uploaded_by": "u1", "context": "request",
            "status": "active", "request_id": None, "name": "f.png",
            "object_key": "request-attachments/x-f.png",
        }
        with patch("app.services.request_attachment_service.request_repository") as req_repo, \
             patch("app.services.request_attachment_service.request_attachment_repository") as att_repo, \
             patch("app.services.request_attachment_service.request_attachment_activity_repository") as act_repo:
            req_repo.get_request_or_404.return_value = req
            att_repo.get_attachment_or_404.return_value = att
            att_repo.count_active_by_request.return_value = 1
            att_repo.list_by_request_ids.return_value = []
            att_repo.update_attachment.return_value = {**att, "request_id": "r1"}

            result = request_attachment_service.add_attachments_to_request(
                "r1", ["a1"], _user("u1")
            )

            att_repo.update_attachment.assert_called_once()
            act_repo.create_activity.assert_called_once()
            activity = act_repo.create_activity.call_args.args[0]
            self.assertEqual(activity["action"], "add")
            self.assertEqual(activity["actor_id"], "u1")
            self.assertEqual(activity["name"], "f.png")
            self.assertEqual(result, {"request": [], "done_reply": []})

    def test_non_creator_non_lead_forbidden(self):
        req = {"id": "r1", "created_by": "u1", "status": "pending"}
        with patch("app.services.request_attachment_service.request_repository") as req_repo:
            req_repo.get_request_or_404.return_value = req
            with self.assertRaises(ForbiddenError):
                request_attachment_service.add_attachments_to_request(
                    "r1", ["a1"], _user("u2")
                )

    def test_lead_can_manage_others_request(self):
        req = {"id": "r1", "created_by": "u1", "status": "in_progress"}
        with patch("app.services.request_attachment_service.request_repository") as req_repo, \
             patch("app.services.request_attachment_service.request_attachment_repository") as att_repo, \
             patch("app.services.request_attachment_service.request_attachment_activity_repository") as act_repo:
            req_repo.get_request_or_404.return_value = req
            att_repo.list_by_request_ids.return_value = []
            result = request_attachment_service.add_attachments_to_request(
                "r1", [], _user("u9", "lead")
            )
            self.assertEqual(result, {"request": [], "done_reply": []})

    def test_closed_status_rejected(self):
        req = {"id": "r1", "created_by": "u1", "status": "done"}
        with patch("app.services.request_attachment_service.request_repository") as req_repo:
            req_repo.get_request_or_404.return_value = req
            with self.assertRaises(ConflictError):
                request_attachment_service.add_attachments_to_request(
                    "r1", ["a1"], _user("u1")
                )

    def test_count_cap_exceeded_rejected(self):
        req = {"id": "r1", "created_by": "u1", "status": "pending"}
        att = {
            "id": "a1", "uploaded_by": "u1", "context": "request",
            "status": "active", "request_id": None, "name": "f.png",
        }
        with patch("app.services.request_attachment_service.request_repository") as req_repo, \
             patch("app.services.request_attachment_service.request_attachment_repository") as att_repo:
            req_repo.get_request_or_404.return_value = req
            att_repo.get_attachment_or_404.return_value = att
            att_repo.count_active_by_request.return_value = 5
            with self.assertRaises(BadRequestError):
                request_attachment_service.add_attachments_to_request(
                    "r1", ["a1"], _user("u1")
                )


class RemoveAttachmentTests(unittest.TestCase):
    def test_creator_remove_hard_deletes_object_and_logs(self):
        req = {"id": "r1", "created_by": "u1", "status": "acknowledged"}
        att = {
            "id": "a1", "request_id": "r1", "context": "request",
            "status": "active", "name": "f.png",
            "object_key": "request-attachments/x-f.png",
        }
        with patch("app.services.request_attachment_service.request_repository") as req_repo, \
             patch("app.services.request_attachment_service.request_attachment_repository") as att_repo, \
             patch("app.services.request_attachment_service.request_attachment_activity_repository") as act_repo, \
             patch("app.services.request_attachment_service.minio_storage") as storage:
            req_repo.get_request_or_404.return_value = req
            att_repo.get_attachment_or_404.return_value = att
            att_repo.list_by_request_ids.return_value = []

            result = request_attachment_service.remove_attachment_from_request(
                "r1", "a1", _user("u1")
            )

            storage.delete_object.assert_called_once_with("request-attachments/x-f.png")
            att_repo.update_attachment.assert_called_once()
            update = att_repo.update_attachment.call_args.args[1]
            self.assertEqual(update["status"], "deleted")
            activity = act_repo.create_activity.call_args.args[0]
            self.assertEqual(activity["action"], "remove")
            self.assertEqual(activity["name"], "f.png")
            self.assertEqual(result, {"request": [], "done_reply": []})

    def test_remove_wrong_request_not_found(self):
        req = {"id": "r1", "created_by": "u1", "status": "pending"}
        att = {"id": "a1", "request_id": "r2", "context": "request", "status": "active"}
        with patch("app.services.request_attachment_service.request_repository") as req_repo, \
             patch("app.services.request_attachment_service.request_attachment_repository") as att_repo:
            req_repo.get_request_or_404.return_value = req
            att_repo.get_attachment_or_404.return_value = att
            with self.assertRaises(NotFoundError):
                request_attachment_service.remove_attachment_from_request(
                    "r1", "a1", _user("u1")
                )

    def test_remove_non_creator_forbidden(self):
        req = {"id": "r1", "created_by": "u1", "status": "pending"}
        with patch("app.services.request_attachment_service.request_repository") as req_repo:
            req_repo.get_request_or_404.return_value = req
            with self.assertRaises(ForbiddenError):
                request_attachment_service.remove_attachment_from_request(
                    "r1", "a1", _user("u2")
                )

    def test_remove_on_done_rejected(self):
        req = {"id": "r1", "created_by": "u1", "status": "done"}
        with patch("app.services.request_attachment_service.request_repository") as req_repo:
            req_repo.get_request_or_404.return_value = req
            with self.assertRaises(ConflictError):
                request_attachment_service.remove_attachment_from_request(
                    "r1", "a1", _user("u1")
                )


if __name__ == "__main__":
    unittest.main()
