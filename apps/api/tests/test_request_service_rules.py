import unittest

from fastapi import HTTPException

from app.services.request_service import (
    build_status_update_data,
    ensure_done_allowed,
    ensure_reassign_reason,
    ensure_status_transition_allowed,
)


class RequestServiceRuleTests(unittest.TestCase):
    def test_pending_can_transition_to_acknowledged(self):
        ensure_status_transition_allowed("pending", "acknowledged")

    def test_pending_cannot_transition_directly_to_done(self):
        with self.assertRaises(HTTPException) as context:
            ensure_status_transition_allowed("pending", "done")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Use /done endpoint")

    def test_in_progress_can_be_marked_done(self):
        ensure_done_allowed({"status": "in_progress"})

    def test_done_requires_in_progress_status(self):
        with self.assertRaises(HTTPException) as context:
            ensure_done_allowed({"status": "acknowledged"})

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Request must be in_progress before done")

    def test_reassign_active_request_requires_reason(self):
        with self.assertRaises(HTTPException) as context:
            ensure_reassign_reason({"status": "in_progress"}, None)

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Reason is required to reassign an active request")

    def test_reassign_pending_request_does_not_require_reason(self):
        ensure_reassign_reason({"status": "pending"}, None)

    def test_acknowledged_status_sets_acknowledged_timestamp(self):
        data = build_status_update_data("acknowledged", now="2026-05-20T01:02:03+00:00")

        self.assertEqual(
            data,
            {
                "status": "acknowledged",
                "acknowledged_at": "2026-05-20T01:02:03+00:00",
            },
        )


if __name__ == "__main__":
    unittest.main()
