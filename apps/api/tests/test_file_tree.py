import unittest

from app.core.exceptions import BadRequestError
from app.services import file_tree


class FileTreePathTests(unittest.TestCase):
    def test_normalize_empty_and_root_to_slash(self):
        self.assertEqual(file_tree.normalize_path(""), "/")
        self.assertEqual(file_tree.normalize_path("/"), "/")

    def test_normalize_nested_path(self):
        self.assertEqual(file_tree.normalize_path("docs/reports"), "/docs/reports")
        self.assertEqual(file_tree.normalize_path("/docs/reports/"), "/docs/reports")

    def test_rejects_path_traversal_null_and_double_slash(self):
        for path in ("/../etc", "/foo\x00bar", "//foo"):
            with self.assertRaises(BadRequestError):
                file_tree.normalize_path(path)

    def test_validate_name_rejects_unsafe_names(self):
        for name in ("", "   ", ".", "..", "a/b", "a\\b", "a<b", "a|b"):
            with self.assertRaises(BadRequestError):
                file_tree.validate_name(name)

    def test_child_path_from_root_and_nested_parent(self):
        self.assertEqual(file_tree.child_path("/", "file.txt"), "/file.txt")
        self.assertEqual(file_tree.child_path("/docs", "file.txt"), "/docs/file.txt")

    def test_descendant_prefix_does_not_match_sibling_prefix(self):
        self.assertEqual(file_tree.descendant_prefix("/foo"), "/foo/")
        self.assertTrue("/foo/bar".startswith(file_tree.descendant_prefix("/foo")))
        self.assertFalse("/foobar".startswith(file_tree.descendant_prefix("/foo")))

    def test_cannot_move_folder_inside_itself(self):
        with self.assertRaises(BadRequestError) as ctx:
            file_tree.assert_can_move({"path": "/docs", "is_directory": True}, "/docs/archive")
        self.assertEqual(str(ctx.exception), "Cannot move a folder inside itself")

    def test_plan_rename_subtree_returns_new_path(self):
        file = {"path": "/docs", "parent_path": "/", "name": "docs", "is_directory": True}
        plan = file_tree.plan_rename_subtree(file, "reports")
        self.assertEqual(plan["old_path"], "/docs")
        self.assertEqual(plan["new_path"], "/reports")
        self.assertEqual(plan["descendant_prefix"], "/docs/")

    def test_plan_move_subtree_returns_new_parent_and_path(self):
        file = {"path": "/docs/report.pdf", "parent_path": "/docs", "name": "report.pdf", "is_directory": False}
        plan = file_tree.plan_move_subtree(file, "/archive")
        self.assertEqual(plan["old_path"], "/docs/report.pdf")
        self.assertEqual(plan["new_parent_path"], "/archive")
        self.assertEqual(plan["new_path"], "/archive/report.pdf")


if __name__ == "__main__":
    unittest.main()
