import unittest
from unittest.mock import patch, MagicMock

from app.core.exceptions import BadRequestError, GoneError
from app.schemas.files import CompleteUploadRequest, CreateFolderRequest, UploadUrlRequest
from app.schemas.users import CurrentUser
from app.services import file_service


def _lead():
    return CurrentUser(id="lead-1", email="lead@example.com", name="Lead", role="lead")


def _fe_user():
    return CurrentUser(id="fe-1", email="fe@example.com", name="FE", role="fe")


class CreateFolderTests(unittest.TestCase):
    @patch("app.services.file_service.file_activity_repository")
    @patch("app.services.file_service.file_repository")
    def test_creates_active_folder(self, mock_file_repo, mock_activity_repo):
        mock_file_repo.get_by_path.return_value = None
        mock_file_repo.create_file.return_value = {
            "id": "folder-1",
            "name": "reports",
            "path": "/reports",
            "parent_path": "/",
            "is_directory": True,
            "status": "active",
        }

        result = file_service.create_folder(
            CreateFolderRequest(name="reports", parent_path="/"),
            _lead(),
        )

        self.assertEqual(result["status"], "active")
        self.assertTrue(result["is_directory"])
        mock_file_repo.create_file.assert_called_once()
        call_data = mock_file_repo.create_file.call_args[0][0]
        self.assertEqual(call_data["status"], "active")


class CreateUploadUrlTests(unittest.TestCase):
    @patch("app.services.file_service.minio_storage")
    @patch("app.services.file_service.file_activity_repository")
    @patch("app.services.file_service.file_repository")
    def test_creates_pending_upload_and_returns_put_url(self, mock_file_repo, mock_activity_repo, mock_minio):
        mock_file_repo.get_by_path.return_value = None
        mock_file_repo.create_file.return_value = {
            "id": "file-1",
            "name": "doc.pdf",
            "path": "/doc.pdf",
            "parent_path": "/",
            "is_directory": False,
            "status": "pending_upload",
            "object_key": "team-files/uuid-doc.pdf",
        }
        mock_minio.presigned_put_url.return_value = "https://minio.example.com/put-url"

        result = file_service.create_upload_url(
            UploadUrlRequest(name="doc.pdf", parent_path="/", size_bytes=1024, content_type="application/pdf"),
            _fe_user(),
        )

        self.assertEqual(result["file"]["status"], "pending_upload")
        self.assertEqual(result["upload_url"], "https://minio.example.com/put-url")
        self.assertEqual(result["method"], "PUT")
        self.assertEqual(result["expires_in_seconds"], 300)


class CompleteUploadTests(unittest.TestCase):
    @patch("app.services.file_service.file_activity_repository")
    @patch("app.services.file_service.file_repository")
    def test_changes_pending_upload_to_active(self, mock_file_repo, mock_activity_repo):
        mock_file_repo.get_file_or_404.return_value = {
            "id": "file-1",
            "status": "pending_upload",
            "is_directory": False,
        }
        mock_file_repo.update_file.return_value = {
            "id": "file-1",
            "status": "active",
            "size_bytes": 1024,
            "is_directory": False,
        }

        result = file_service.complete_upload(
            "file-1",
            CompleteUploadRequest(size_bytes=1024),
            _fe_user(),
        )

        self.assertEqual(result["status"], "active")
        mock_file_repo.update_file.assert_called_once()


class CreatePreviewUrlTests(unittest.TestCase):
    @patch("app.services.file_service.file_repository")
    def test_rejects_svg(self, mock_file_repo):
        mock_file_repo.get_file_or_404.return_value = {
            "id": "file-1",
            "status": "active",
            "is_directory": False,
            "object_key": "team-files/uuid-image.svg",
            "content_type": "image/svg+xml",
            "extension": "svg",
        }

        with self.assertRaises(BadRequestError):
            file_service.create_preview_url("file-1", _fe_user())


class SoftDeleteTests(unittest.TestCase):
    @patch("app.services.file_service.file_activity_repository")
    @patch("app.services.file_service.file_repository")
    def test_sets_deleted_with_purge_after_7_days(self, mock_file_repo, mock_activity_repo):
        mock_file_repo.get_file_or_404.return_value = {
            "id": "file-1",
            "path": "/doc.pdf",
            "is_directory": False,
            "status": "active",
        }
        mock_file_repo.update_file.return_value = {
            "id": "file-1",
            "status": "deleted",
            "purge_after": "2026-06-01T00:00:00+00:00",
        }

        result = file_service.soft_delete_file("file-1", _lead())

        self.assertEqual(result["status"], "deleted")
        self.assertIsNotNone(result["purge_after"])
        update_call = mock_file_repo.update_file.call_args[0][1]
        self.assertEqual(update_call["status"], "deleted")
        self.assertIsNotNone(update_call["purge_after"])


class RestoreTests(unittest.TestCase):
    @patch("app.services.file_service.file_repository")
    def test_rejects_purged_file_with_gone_error(self, mock_file_repo):
        mock_file_repo.get_file_or_404.return_value = {
            "id": "file-1",
            "path": "/doc.pdf",
            "status": "purged",
        }

        with self.assertRaises(GoneError):
            file_service.restore_file("file-1", _lead())


class PurgeExpiredTests(unittest.TestCase):
    @patch("app.services.file_service.minio_storage")
    @patch("app.services.file_service.file_activity_repository")
    @patch("app.services.file_service.file_repository")
    def test_deletes_minio_object_and_marks_purged(self, mock_file_repo, mock_activity_repo, mock_minio):
        mock_file_repo.list_deleted_ready_for_purge.return_value = [
            {"id": "file-1", "object_key": "team-files/uuid-doc.pdf", "is_directory": False},
        ]
        mock_file_repo.update_file.return_value = {"id": "file-1", "status": "purged"}

        result = file_service.purge_expired(_lead())

        self.assertEqual(result["purged"], 1)
        mock_minio.delete_object.assert_called_once_with("team-files/uuid-doc.pdf")
        update_call = mock_file_repo.update_file.call_args[0][1]
        self.assertEqual(update_call["status"], "purged")
        self.assertIsNone(update_call["object_key"])


if __name__ == "__main__":
    unittest.main()
