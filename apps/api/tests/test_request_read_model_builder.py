import unittest
from unittest.mock import patch

from app.services import request_read_model_builder as builder


class RequestReadModelBuilderTests(unittest.TestCase):
    def test_enriches_creator_and_assignees(self):
        requests = [{"id": "r1", "created_by": "c1", "assigned_to": "legacy-1"}]
        users_by_id = {
            "c1": {"id": "c1", "email": "c@x.com", "name": "C"},
            "u1": {"id": "u1", "email": "u1@x.com", "name": "U1"},
            "u2": {"id": "u2", "email": "u2@x.com", "name": "U2"},
        }
        with (
            patch("app.services.request_read_model_builder.request_assignee_repository.list_assignee_ids_by_request_ids", return_value={"r1": ["u1", "u2"]}),
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value=users_by_id),
        ):
            result = builder.enrich_requests_with_users(requests)
        self.assertEqual(result[0]["creator"]["id"], "c1")
        self.assertEqual([a["id"] for a in result[0]["assignees"]], ["u1", "u2"])
        self.assertEqual(result[0]["assignee"]["id"], "u1")
        self.assertEqual(result[0]["assigned_to"], "u1")
        self.assertEqual(result[0]["assignee_ids"], ["u1", "u2"])

    def test_falls_back_to_legacy_assigned_to(self):
        requests = [{"id": "r1", "created_by": "c1", "assigned_to": "legacy-1"}]
        users_by_id = {
            "c1": {"id": "c1", "email": "c@x.com", "name": "C"},
            "legacy-1": {"id": "legacy-1", "email": "l@x.com", "name": "L"},
        }
        with (
            patch("app.services.request_read_model_builder.request_assignee_repository.list_assignee_ids_by_request_ids", side_effect=Exception("fail")),
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value=users_by_id),
        ):
            result = builder.enrich_requests_with_users(requests)
        self.assertEqual(result[0]["assignee"]["id"], "legacy-1")
        self.assertEqual(result[0]["assigned_to"], "legacy-1")
        self.assertEqual(result[0]["assignee_ids"], ["legacy-1"])

    def test_enrich_single_request(self):
        request = {"id": "r1", "created_by": "c1", "assigned_to": None}
        users_by_id = {"c1": {"id": "c1", "email": "c@x.com", "name": "C"}}
        with (
            patch("app.services.request_read_model_builder.request_assignee_repository.list_assignee_ids_by_request_ids", return_value={"r1": []}),
            patch("app.services.request_read_model_builder.user_repository.list_user_summaries", return_value=users_by_id),
        ):
            result = builder.enrich_request_with_users(request)
        self.assertEqual(result["id"], "r1")
        self.assertEqual(result["creator"]["id"], "c1")


if __name__ == "__main__":
    unittest.main()
