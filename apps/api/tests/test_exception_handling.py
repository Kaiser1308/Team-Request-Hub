import os
import unittest

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.core.exceptions import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    GoneError,
    NotFoundError,
    DomainError,
)


class DomainExceptionTests(unittest.TestCase):
    def test_not_found_error_is_domain_error(self):
        error = NotFoundError("User not found")
        self.assertIsInstance(error, DomainError)
        self.assertEqual(str(error), "User not found")

    def test_conflict_error_is_domain_error(self):
        error = ConflictError("Already assigned")
        self.assertIsInstance(error, DomainError)

    def test_forbidden_error_is_domain_error(self):
        error = ForbiddenError("Access denied")
        self.assertIsInstance(error, DomainError)

    def test_bad_request_error_is_domain_error(self):
        error = BadRequestError("Invalid input")
        self.assertIsInstance(error, DomainError)

    def test_gone_error_is_domain_error(self):
        error = GoneError("Resource is gone")
        self.assertIsInstance(error, DomainError)
        self.assertEqual(str(error), "Resource is gone")

    def test_gone_error_default_message(self):
        error = GoneError()
        self.assertEqual(str(error), "Resource is gone")

    def test_domain_errors_are_not_http_exceptions(self):
        from fastapi import HTTPException
        error = NotFoundError("test")
        self.assertNotIsInstance(error, HTTPException)


if __name__ == "__main__":
    unittest.main()
