import unittest

from fastapi import HTTPException

from app.services import request_transition_engine


class RequestTransitionEngineTests(unittest.TestCase):
    def test_open_statuses_pass(self):
        for request_status in ("pending", "acknowledged", "in_progress"):
            request_transition_engine.ensure_open_request({"status": request_status})

    def test_done_request_is_closed(self):
        with self.assertRaises(HTTPException) as context:
            request_transition_engine.ensure_open_request({"status": "done"})

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Request is already closed")

    def test_pending_can_transition_to_acknowledged(self):
        request_transition_engine.ensure_status_transition_allowed("pending", "acknowledged")

    def test_pending_to_done_uses_done_endpoint(self):
        with self.assertRaises(HTTPException) as context:
            request_transition_engine.ensure_status_transition_allowed("pending", "done")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Use /done endpoint")

    def test_pending_to_in_progress_is_invalid(self):
        with self.assertRaises(HTTPException) as context:
            request_transition_engine.ensure_status_transition_allowed("pending", "in_progress")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Invalid status transition")

    def test_done_requires_in_progress(self):
        with self.assertRaises(HTTPException) as context:
            request_transition_engine.ensure_done_allowed({"status": "acknowledged"})

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Request must be in_progress before done")

    def test_reassign_active_request_requires_reason(self):
        with self.assertRaises(HTTPException) as context:
            request_transition_engine.ensure_reassign_reason({"status": "in_progress"}, None)

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Reason is required to reassign an active request")

    def test_unassigned_request_fails_before_status_change(self):
        with self.assertRaises(HTTPException) as context:
            request_transition_engine.ensure_request_assigned({"assigned_to": None})

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.detail, "Request must be assigned before status can change")

    def test_acknowledged_status_sets_acknowledged_timestamp(self):
        data = request_transition_engine.build_status_update_data(
            "acknowledged",
            now="2026-05-20T01:02:03+00:00",
        )

        self.assertEqual(
            data,
            {
                "status": "acknowledged",
                "acknowledged_at": "2026-05-20T01:02:03+00:00",
            },
        )

    def test_in_progress_status_sets_started_timestamp(self):
        data = request_transition_engine.build_status_update_data(
            "in_progress",
            now="2026-05-20T01:02:03+00:00",
        )

        self.assertEqual(
            data,
            {"status": "in_progress", "started_at": "2026-05-20T01:02:03+00:00"},
        )

    def test_cancelled_status_sets_cancelled_timestamp(self):
        data = request_transition_engine.build_status_update_data(
            "cancelled",
            now="2026-05-20T01:02:03+00:00",
        )

        self.assertEqual(
            data,
            {"status": "cancelled", "cancelled_at": "2026-05-20T01:02:03+00:00"},
        )

    def test_pending_status_returns_only_status(self):
        data = request_transition_engine.build_status_update_data("pending")

        self.assertEqual(data, {"status": "pending"})


if __name__ == "__main__":
    unittest.main()
