import unittest
from unittest.mock import patch

from app.core.exceptions import ForbiddenError
from app.schemas.files import MoveFileRequest, RenameFileRequest
from app.schemas.users import CurrentUser
from app.services import file_service


def _lead():
    return CurrentUser(id="lead-1", email="lead@example.com", name="Lead", role="lead")


def _fe_user():
    return CurrentUser(id="fe-1", email="fe@example.com", name="FE", role="fe")


def _be_user():
    return CurrentUser(id="be-1", email="be@example.com", name="BE", role="be")


class FileServicePermissionTests(unittest.TestCase):
    def test_non_lead_cannot_rename(self):
        with self.assertRaises(ForbiddenError):
            file_service.rename_file("f-1", RenameFileRequest(name="new.txt"), _fe_user())

    def test_non_lead_cannot_move(self):
        with self.assertRaises(ForbiddenError):
            file_service.move_file("f-1", MoveFileRequest(parent_path="/other"), _be_user())

    def test_non_lead_cannot_soft_delete(self):
        with self.assertRaises(ForbiddenError):
            file_service.soft_delete_file("f-1", _fe_user())

    def test_non_lead_cannot_restore(self):
        with self.assertRaises(ForbiddenError):
            file_service.restore_file("f-1", _be_user())

    def test_non_lead_cannot_purge(self):
        with self.assertRaises(ForbiddenError):
            file_service.purge_expired(_fe_user())

    @patch("app.services.file_service.file_repository")
    @patch("app.services.file_service.file_activity_repository")
    def test_lead_can_rename(self, mock_activity_repo, mock_file_repo):
        file = {
            "id": "f-1",
            "name": "old.txt",
            "path": "/old.txt",
            "parent_path": "/",
            "is_directory": False,
            "status": "active",
        }
        updated = {**file, "name": "new.txt", "path": "/new.txt"}
        mock_file_repo.get_file_or_404.return_value = file
        mock_file_repo.get_by_path.return_value = None
        mock_file_repo.update_file.return_value = updated

        result = file_service.rename_file("f-1", RenameFileRequest(name="new.txt"), _lead())

        self.assertEqual(result["name"], "new.txt")
        self.assertEqual(result["path"], "/new.txt")


if __name__ == "__main__":
    unittest.main()
