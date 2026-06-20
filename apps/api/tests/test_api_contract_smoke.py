import os
import unittest

os.environ.setdefault("SUPABASE_URL", "http://localhost")
os.environ.setdefault("SUPABASE_ANON_KEY", "anon")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service")
os.environ.setdefault("SUPABASE_JWT_SECRET", "secret")

from fastapi.testclient import TestClient

from app.main import app


class ApiContractSmokeTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_returns_ok(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_users_me_requires_authentication(self):
        response = self.client.get("/users/me")

        self.assertIn(response.status_code, {401, 403})

    def test_requests_requires_authentication(self):
        response = self.client.get("/requests")

        self.assertIn(response.status_code, {401, 403})

    def test_notifications_requires_authentication(self):
        response = self.client.get("/notifications")

        self.assertIn(response.status_code, {401, 403})

    def test_files_hard_delete_route_registered_with_204(self):
        hard_delete_routes = [
            route
            for route in app.routes
            if hasattr(route, "methods")
            and "DELETE" in route.methods
            and route.path == "/files/{file_id}"
        ]

        self.assertEqual(len(hard_delete_routes), 1)
        self.assertEqual(hard_delete_routes[0].status_code, 204)
