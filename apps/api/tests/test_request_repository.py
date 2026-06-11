import unittest
from unittest.mock import patch

from app.repositories import request_repository


class _Result:
    def __init__(self, data):
        self.data = data


class _RpcCall:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return _Result(self.data)


class _SupabaseClient:
    def __init__(self, data):
        self.data = data
        self.rpc_calls = []
        self.table_calls = []

    def rpc(self, name, params):
        self.rpc_calls.append((name, params))
        return _RpcCall(self.data)

    def table(self, name):
        self.table_calls.append(name)
        raise AssertionError("list_pool_requests should not scan tables directly")


class RequestRepositoryTests(unittest.TestCase):
    def test_list_pool_requests_uses_rpc_without_scanning_all_assignees(self):
        data = [{"id": "request-1", "status": "pending", "assigned_to": None}]
        client = _SupabaseClient(data)

        with patch("app.repositories.request_repository.get_supabase_admin", return_value=client):
            result = request_repository.list_pool_requests(limit=25)

        self.assertEqual(result, data)
        self.assertEqual(
            client.rpc_calls,
            [("list_pool_requests", {"result_limit": 25})],
        )
        self.assertEqual(client.table_calls, [])

    def test_list_done_requests_uses_membership_rpc_for_non_leads(self):
        data = [{"id": "request-1", "status": "done"}]
        client = _SupabaseClient(data)

        with patch("app.repositories.request_repository.get_supabase_admin", return_value=client):
            result = request_repository.list_done_requests(limit=25, user_id="user-1")

        self.assertEqual(result, data)
        self.assertEqual(
            client.rpc_calls,
            [("list_done_requests", {"result_limit": 25, "current_user_id": "user-1"})],
        )
        self.assertEqual(client.table_calls, [])

    def test_get_dashboard_data_uses_membership_rpc(self):
        data = [{"id": "request-1", "status": "pending"}]
        client = _SupabaseClient(data)

        with patch("app.repositories.request_repository.get_supabase_admin", return_value=client):
            result = request_repository.get_dashboard_data("user-1")

        self.assertEqual(result, data)
        self.assertEqual(
            client.rpc_calls,
            [("get_dashboard_data", {"current_user_id": "user-1", "result_limit": 200})],
        )
        self.assertEqual(client.table_calls, [])


if __name__ == "__main__":
    unittest.main()
