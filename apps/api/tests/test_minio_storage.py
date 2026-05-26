import unittest
from types import SimpleNamespace
from unittest.mock import patch

from app.services import minio_storage


def _settings(**overrides):
    values = {
        "minio_endpoint": "minio:9000",
        "minio_region": "us-east-1",
        "minio_bucket": "team-files",
        "minio_access_key": "access",
        "minio_secret_key": "secret",
        "minio_secure": False,
        "minio_public_endpoint": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


class PresignedUrlTests(unittest.TestCase):
    @patch("app.services.minio_storage.Minio")
    @patch("app.services.minio_storage.get_settings")
    def test_put_url_is_signed_with_public_endpoint_when_configured(self, mock_get_settings, mock_minio):
        mock_get_settings.return_value = _settings(
            minio_public_endpoint="https://files.example.com",
        )
        mock_minio.return_value.presigned_put_object.return_value = (
            "https://files.example.com/team-files/object.txt?X-Amz-Signature=abc"
        )

        result = minio_storage.presigned_put_url("team-files/object.txt")

        mock_minio.assert_called_once_with(
            "files.example.com",
            access_key="access",
            secret_key="secret",
            secure=True,
            region="us-east-1",
        )
        self.assertIn("files.example.com", result)

    @patch("app.services.minio_storage.Minio")
    @patch("app.services.minio_storage.get_settings")
    def test_get_url_passes_response_headers_to_minio_client(self, mock_get_settings, mock_minio):
        mock_get_settings.return_value = _settings()
        mock_minio.return_value.presigned_get_object.return_value = (
            "http://minio:9000/team-files/object.txt?response-content-disposition=attachment"
        )

        result = minio_storage.presigned_get_url(
            "team-files/object.txt",
            response_headers={
                "response-content-disposition": 'attachment; filename="object.txt"',
            },
        )

        self.assertIn("response-content-disposition", result)
        mock_minio.return_value.presigned_get_object.assert_called_once()
        _, kwargs = mock_minio.return_value.presigned_get_object.call_args
        self.assertEqual(
            kwargs["response_headers"],
            {"response-content-disposition": 'attachment; filename="object.txt"'},
        )


if __name__ == "__main__":
    unittest.main()
