import unittest
from unittest.mock import MagicMock, patch

from app.repositories import file_repository


def _select_chain(admin, data):
    """Return the terminal mock for table().select().like(...).execute()."""
    table = admin.table.return_value
    select = table.select.return_value
    like = select.like.return_value
    like.execute.return_value = MagicMock(data=data)
    return table, select, like


def _delete_chain(admin, data):
    """Return the terminal mock for table().delete().in_(...).execute()."""
    table = admin.table.return_value
    delete = table.delete.return_value
    delete_in = delete.in_.return_value
    delete_in.execute.return_value = MagicMock(data=data)
    return table, delete


class ListDescendantsTests(unittest.TestCase):
    @patch("app.repositories.file_repository.get_supabase_admin")
    def test_selects_descendants_by_path_prefix(self, mock_get_admin):
        descendants = [
            {"id": "child-1", "path": "/docs/a.pdf"},
            {"id": "child-2", "path": "/docs/nested/b.png"},
        ]
        admin = MagicMock()
        mock_get_admin.return_value = admin
        table, select, like = _select_chain(admin, descendants)

        rows = file_repository.list_descendants("/docs/")

        admin.table.assert_called_once_with("team_files")
        table.select.assert_called_once_with(file_repository.COLUMNS)
        select.like.assert_called_once_with("path", "/docs/%")
        self.assertEqual(rows, descendants)

    @patch("app.repositories.file_repository.get_supabase_admin")
    def test_returns_empty_list_when_no_descendants(self, mock_get_admin):
        admin = MagicMock()
        mock_get_admin.return_value = admin
        _select_chain(admin, [])

        rows = file_repository.list_descendants("/docs/")

        self.assertEqual(rows, [])


class DeleteFilesTests(unittest.TestCase):
    @patch("app.repositories.file_repository.get_supabase_admin")
    def test_deletes_rows_by_id_list(self, mock_get_admin):
        admin = MagicMock()
        mock_get_admin.return_value = admin
        table, delete = _delete_chain(admin, [{"id": "child-1"}, {"id": "folder-1"}])

        result = file_repository.delete_files(["child-1", "folder-1"])

        admin.table.assert_called_once_with("team_files")
        table.delete.assert_called_once_with()
        delete.in_.assert_called_once_with("id", ["child-1", "folder-1"])
        self.assertEqual(result, [{"id": "child-1"}, {"id": "folder-1"}])

    @patch("app.repositories.file_repository.get_supabase_admin")
    def test_empty_id_list_returns_without_query(self, mock_get_admin):
        result = file_repository.delete_files([])

        mock_get_admin.assert_not_called()
        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
