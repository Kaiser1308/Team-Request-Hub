import os
import unittest


def require_test_environment() -> None:
    if os.environ.get("APP_ENV") != "test":
        raise RuntimeError("Refusing to run destructive tests outside APP_ENV=test")


class TestEnvironmentGuardTests(unittest.TestCase):
    def test_guard_allows_test_environment(self):
        previous = os.environ.get("APP_ENV")
        os.environ["APP_ENV"] = "test"
        try:
            require_test_environment()
        finally:
            if previous is None:
                os.environ.pop("APP_ENV", None)
            else:
                os.environ["APP_ENV"] = previous

    def test_guard_rejects_missing_environment(self):
        previous = os.environ.get("APP_ENV")
        os.environ.pop("APP_ENV", None)
        try:
            with self.assertRaisesRegex(RuntimeError, "APP_ENV=test"):
                require_test_environment()
        finally:
            if previous is not None:
                os.environ["APP_ENV"] = previous

    def test_guard_rejects_non_test_environment(self):
        previous = os.environ.get("APP_ENV")
        os.environ["APP_ENV"] = "production"
        try:
            with self.assertRaisesRegex(RuntimeError, "APP_ENV=test"):
                require_test_environment()
        finally:
            if previous is None:
                os.environ.pop("APP_ENV", None)
            else:
                os.environ["APP_ENV"] = previous
