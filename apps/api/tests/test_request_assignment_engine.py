import unittest

from fastapi import HTTPException

from app.schemas.users import CurrentUser
from app.services import request_assignment_engine as engine


def _user(id="user-1", role="fe"):
    return CurrentUser(id=id, email=f"{id}@test.com", name=id, role=role, is_active=True)


class RequestAssignmentEngineTests(unittest.TestCase):
    def test_lead_can_manage(self):
        engine.ensure_can_manage_assignees(_user(role="lead"), {"created_by": "other", "assignee_ids": []})

    def test_creator_can_manage(self):
        engine.ensure_can_manage_assignees(_user(), {"created_by": "user-1", "assignee_ids": []})

    def test_assignee_can_manage(self):
        engine.ensure_can_manage_assignees(_user(), {"created_by": "other", "assignee_ids": ["user-1"]})

    def test_non_involved_cannot_manage(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_manage_assignees(_user(), {"created_by": "other", "assignee_ids": ["x"]})
        self.assertEqual(ctx.exception.status_code, 403)

    def test_duplicate_add_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_add_assignee({"assignee_ids": ["user-1"]}, "user-1")
        self.assertEqual(ctx.exception.status_code, 409)

    def test_missing_remove_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_remove_assignee({"status": "pending", "assignee_ids": ["user-1"]}, "missing", None)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_active_remove_requires_reason(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_remove_assignee({"status": "in_progress", "assignee_ids": ["a", "b"]}, "a", None)
        self.assertEqual(ctx.exception.status_code, 400)

    def test_active_last_assignee_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            engine.ensure_can_remove_assignee({"status": "acknowledged", "assignee_ids": ["user-1"]}, "user-1", "reason")
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
