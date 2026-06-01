import os
import unittest

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from app.schemas.requests import RequestAttachmentOut, RequestAttachmentUploadUrlRequest


class RequestAttachmentSchemaTests(unittest.TestCase):
    def test_upload_schema_accepts_image_context(self):
        payload = RequestAttachmentUploadUrlRequest(
            name="screenshot.png",
            content_type="image/png",
            size_bytes=1024,
            context="request",
        )

        self.assertEqual(payload.context, "request")
        self.assertEqual(payload.size_bytes, 1024)

    def test_output_schema_has_request_metadata(self):
        attachment = RequestAttachmentOut(
            id="attachment-1",
            request_id="request-1",
            context="done_reply",
            status="active",
            name="done.png",
            content_type="image/png",
            size_bytes=2048,
            uploaded_by="user-1",
            created_at="2026-05-31T00:00:00Z",
            updated_at="2026-05-31T00:00:00Z",
        )

        self.assertEqual(attachment.context, "done_reply")


if __name__ == "__main__":
    unittest.main()
