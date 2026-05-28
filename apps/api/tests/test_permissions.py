import unittest

from fastapi import HTTPException

from app.core.permissions import (
    ensure_can_cancel,
    ensure_can_reassign,
    ensure_can_view_request,
    ensure_is_assignee_or_lead,
)
from app.schemas.users import CurrentUser


def _user(id="user-1", role="fe"):
    return CurrentUser(id=id, email=f"{id}@test.com", name=id, role=role)


class TestEnsureCanViewRequest(unittest.TestCase):
    def test_lead_can_view_any_request(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "other2"}
        ensure_can_view_request(_user(role="lead"), request)

    def test_creator_can_view_own_request(self):
        request = {"id": "r1", "created_by": "user-1", "assigned_to": "other"}
        ensure_can_view_request(_user(), request)

    def test_assignee_can_view_assigned_request(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "user-1"}
        ensure_can_view_request(_user(), request)

    def test_unassigned_request_visible_to_anyone(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": None}
        ensure_can_view_request(_user(), request)

    def test_regular_user_cannot_view_request_assigned_to_others(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "other2"}
        with self.assertRaises(HTTPException) as ctx:
            ensure_can_view_request(_user(), request)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_assignee_in_assignee_ids_can_view_request(self):
        request = {"id": "r1", "created_by": "other", "assignee_ids": ["user-1", "user-2"]}
        ensure_can_view_request(_user(), request)


class TestEnsureCanReassign(unittest.TestCase):
    def test_lead_can_reassign_any_request(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "other2"}
        ensure_can_reassign(_user(role="lead"), request)

    def test_creator_can_reassign_own_request(self):
        request = {"id": "r1", "created_by": "user-1", "assigned_to": "other"}
        ensure_can_reassign(_user(), request)

    def test_assignee_can_reassign_request(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "user-1"}
        ensure_can_reassign(_user(), request)

    def test_non_involved_user_cannot_reassign(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "other2"}
        with self.assertRaises(HTTPException) as ctx:
            ensure_can_reassign(_user(), request)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("cannot reassign", ctx.exception.detail.lower())


class TestEnsureCanCancel(unittest.TestCase):
    def test_lead_can_cancel_any_request(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "other2"}
        ensure_can_cancel(_user(role="lead"), request)

    def test_creator_can_cancel_own_request(self):
        request = {"id": "r1", "created_by": "user-1", "assigned_to": "other"}
        ensure_can_cancel(_user(), request)

    def test_assignee_cannot_cancel_request(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "user-1"}
        with self.assertRaises(HTTPException) as ctx:
            ensure_can_cancel(_user(), request)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_non_involved_user_cannot_cancel(self):
        request = {"id": "r1", "created_by": "other", "assigned_to": "other2"}
        with self.assertRaises(HTTPException) as ctx:
            ensure_can_cancel(_user(), request)
        self.assertEqual(ctx.exception.status_code, 403)


class TestEnsureIsAssigneeOrLead(unittest.TestCase):
    def test_lead_can_always_act(self):
        request = {"id": "r1", "assigned_to": "other"}
        ensure_is_assignee_or_lead(_user(role="lead"), request)

    def test_assignee_can_act(self):
        request = {"id": "r1", "assigned_to": "user-1"}
        ensure_is_assignee_or_lead(_user(), request)

    def test_non_assignee_non_lead_cannot_act(self):
        request = {"id": "r1", "assigned_to": "other"}
        with self.assertRaises(HTTPException) as ctx:
            ensure_is_assignee_or_lead(_user(), request)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertIn("assignee or lead", ctx.exception.detail.lower())

    def test_assignee_in_assignee_ids_can_act(self):
        request = {"id": "r1", "assignee_ids": ["user-1", "user-2"]}
        ensure_is_assignee_or_lead(_user(), request)


if __name__ == "__main__":
    unittest.main()
