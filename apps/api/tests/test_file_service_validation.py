import unittest

from app.core.exceptions import BadRequestError
from app.services.file_service import (
    build_child_path,
    get_extension,
    is_preview_supported,
    normalize_path,
    validate_name,
)


class NormalizePathTests(unittest.TestCase):
    def test_root_returns_slash(self):
        self.assertEqual(normalize_path("/"), "/")
        self.assertEqual(normalize_path(""), "/")

    def test_simple_path(self):
        self.assertEqual(normalize_path("/docs"), "/docs")
        self.assertEqual(normalize_path("/docs/reports"), "/docs/reports")

    def test_rejects_double_dot(self):
        with self.assertRaises(BadRequestError):
            normalize_path("/../etc")

    def test_rejects_double_slash(self):
        with self.assertRaises(BadRequestError):
            normalize_path("//foo")

    def test_rejects_null_byte(self):
        with self.assertRaises(BadRequestError):
            normalize_path("/foo\x00bar")

    def test_normalizes_trailing_slash(self):
        self.assertEqual(normalize_path("/docs/"), "/docs")


class ValidateNameTests(unittest.TestCase):
    def test_valid_name(self):
        self.assertEqual(validate_name("report.pdf"), "report.pdf")

    def test_rejects_empty(self):
        with self.assertRaises(BadRequestError):
            validate_name("")

    def test_rejects_whitespace_only(self):
        with self.assertRaises(BadRequestError):
            validate_name("   ")

    def test_rejects_dot(self):
        with self.assertRaises(BadRequestError):
            validate_name(".")

    def test_rejects_double_dot(self):
        with self.assertRaises(BadRequestError):
            validate_name("..")

    def test_rejects_slash(self):
        with self.assertRaises(BadRequestError):
            validate_name("a/b")

    def test_rejects_backslash(self):
        with self.assertRaises(BadRequestError):
            validate_name("a\\b")

    def test_rejects_angle_brackets(self):
        with self.assertRaises(BadRequestError):
            validate_name("a<b")

    def test_rejects_pipe(self):
        with self.assertRaises(BadRequestError):
            validate_name("a|b")


class BuildChildPathTests(unittest.TestCase):
    def test_root_parent(self):
        self.assertEqual(build_child_path("/", "file.txt"), "/file.txt")

    def test_nested_parent(self):
        self.assertEqual(build_child_path("/docs", "file.txt"), "/docs/file.txt")

    def test_deeply_nested(self):
        self.assertEqual(build_child_path("/a/b", "c.txt"), "/a/b/c.txt")


class GetExtensionTests(unittest.TestCase):
    def test_simple_extension(self):
        self.assertEqual(get_extension("file.pdf"), "pdf")

    def test_multiple_dots(self):
        self.assertEqual(get_extension("archive.tar.gz"), "gz")

    def test_no_extension(self):
        self.assertIsNone(get_extension("Makefile"))

    def test_hidden_file_no_extension(self):
        self.assertIsNone(get_extension(".gitignore"))

    def test_uppercase_extension(self):
        self.assertEqual(get_extension("FILE.PDF"), "pdf")


class IsPreviewSupportedTests(unittest.TestCase):
    def test_png_supported(self):
        self.assertTrue(is_preview_supported("image/png", "png"))

    def test_jpeg_supported(self):
        self.assertTrue(is_preview_supported("image/jpeg", "jpg"))

    def test_pdf_supported(self):
        self.assertTrue(is_preview_supported("application/pdf", "pdf"))

    def test_svg_not_supported(self):
        self.assertFalse(is_preview_supported("image/svg+xml", "svg"))

    def test_unknown_type_not_supported(self):
        self.assertFalse(is_preview_supported("application/octet-stream", "bin"))


if __name__ == "__main__":
    unittest.main()
