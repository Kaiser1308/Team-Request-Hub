# Strict Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local-first strict testing foundation for Team Request Hub using a Supabase branch, deterministic seed/reset checks, backend API coverage, and hardened Playwright smoke tests.

**Architecture:** Keep the first implementation phase small and reliable: add test environment documentation/templates, add explicit environment guards, add deterministic backend API tests around existing routes, and improve Playwright commands/reporting. Supabase branch creation remains a documented/manual setup step first; automated branch management can be added after local tests are stable.

**Tech Stack:** FastAPI, Python `unittest`, Supabase branch, Next.js, Playwright, npm scripts, `uv`.

---

## File Structure

- Create: `docs/testing.md` — canonical local testing workflow and Supabase branch setup guide.
- Create: `apps/api/.env.test.example` — backend test env template with non-secret placeholders and test guards.
- Create: `apps/web/.env.test.example` — frontend test env template with branch-oriented public values.
- Create: `apps/api/tests/test_test_environment_guard.py` — verifies destructive/integration test guards reject non-test envs.
- Create: `apps/api/tests/test_api_contract_smoke.py` — FastAPI smoke tests for `/health` and auth-required API behavior.
- Modify: `apps/web/package.json` — add Playwright scripts.
- Modify: `apps/web/playwright.config.ts` — use explicit env-driven base URL and stable local server command.
- Modify: `apps/web/e2e/login.spec.ts` — make selectors more user-focused and add `test.step` reporting.

## Task 1: Document The Local Test Environment

**Files:**
- Create: `docs/testing.md`
- Create: `apps/api/.env.test.example`
- Create: `apps/web/.env.test.example`

- [ ] **Step 1: Write `docs/testing.md`**

Create `docs/testing.md` with this content:

```markdown
# Testing Guide

This project uses a local-first strict testing workflow. Tests must run against a dedicated Supabase branch, never against production or staging data.

## Test Environment Rules

- Use a Supabase branch created from the current project for test data.
- Do not use `apps/api/.env` or `apps/web/.env.local` for destructive or integration tests.
- Use `APP_ENV=test` for backend tests that may write data.
- Use deterministic seed data with a clear prefix such as `e2e_`.
- Do not commit real Supabase service-role keys, access tokens, or user passwords.

## Backend Local Commands

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

## Frontend Local Commands

```bash
cd apps/web
npm run lint
npm run build
npm run test:e2e
```

## Supabase Branch Setup

1. Create a Supabase branch from the current project.
2. Copy branch API URL and keys into local test env files.
3. Seed branch data with active `fe`, active `be`, active `lead`, and inactive `fe` users.
4. Seed representative requests, notifications, status logs, assignment history, and file fixtures when storage is configured.
5. Run backend tests before E2E tests.

## Initial Test Matrix

| Area | Local command |
| --- | --- |
| Backend unit/API smoke | `uv --cache-dir .uv-cache run python -m unittest discover tests` |
| Frontend lint | `npm run lint` |
| Frontend build | `npm run build` |
| E2E smoke | `npm run test:e2e` |

## Pass Criteria

- Backend tests pass completely.
- Frontend lint and build pass.
- E2E critical smoke tests pass on Chromium.
- Tests do not require production data.
- Forbidden role paths are rejected by the backend even if the UI hides actions.
```

- [ ] **Step 2: Write backend test env template**

Create `apps/api/.env.test.example` with this content:

```dotenv
APP_ENV=test
SUPABASE_URL=https://your-test-branch.supabase.co
SUPABASE_SERVICE_ROLE_KEY=replace-with-test-branch-service-role-key
SUPABASE_JWT_SECRET=replace-with-test-branch-jwt-secret-if-needed
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=team-request-hub-test
MINIO_SECURE=false
```

- [ ] **Step 3: Write frontend test env template**

Create `apps/web/.env.test.example` with this content:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-test-branch.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-test-branch-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-test-branch-publishable-key-if-used
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
PLAYWRIGHT_BASE_URL=http://localhost:3000
```

- [ ] **Step 4: Verify docs/templates are present**

Run:

```bash
test -f docs/testing.md && test -f apps/api/.env.test.example && test -f apps/web/.env.test.example
```

Expected: command exits with status `0` and no output.

## Task 2: Add Backend Test Environment Guard Tests

**Files:**
- Create: `apps/api/tests/test_test_environment_guard.py`

- [ ] **Step 1: Write failing guard tests**

Create `apps/api/tests/test_test_environment_guard.py` with this content:

```python
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
```

- [ ] **Step 2: Run the guard test**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_test_environment_guard
```

Expected: `Ran 3 tests` and `OK`.

- [ ] **Step 3: Commit this task if committing is requested**

Only commit if the user explicitly requests commits. If requested, run:

```bash
git add docs/testing.md apps/api/.env.test.example apps/web/.env.test.example apps/api/tests/test_test_environment_guard.py
git commit -m "test: document strict local test environment"
```

## Task 3: Add Backend API Contract Smoke Tests

**Files:**
- Create: `apps/api/tests/test_api_contract_smoke.py`

- [ ] **Step 1: Inspect current FastAPI import path**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "from app.main import app; print(app.title)"
```

Expected: command imports `app.main` successfully and prints the FastAPI title.

- [ ] **Step 2: Write API smoke tests**

Create `apps/api/tests/test_api_contract_smoke.py` with this content:

```python
import unittest

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


class ApiContractSmokeTests(unittest.TestCase):
    def test_health_returns_ok(self):
        response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_users_me_requires_authentication(self):
        response = client.get("/users/me")

        self.assertIn(response.status_code, {401, 403})

    def test_requests_requires_authentication(self):
        response = client.get("/requests")

        self.assertIn(response.status_code, {401, 403})

    def test_notifications_requires_authentication(self):
        response = client.get("/notifications")

        self.assertIn(response.status_code, {401, 403})
```

- [ ] **Step 3: Run the API smoke tests**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest tests.test_api_contract_smoke
```

Expected: `Ran 4 tests` and `OK`. If import fails due missing local dependencies, install dependencies first with `uv --cache-dir .uv-cache pip install -r requirements.txt`, then rerun.

- [ ] **Step 4: Run all backend tests**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: all existing and new backend tests pass.

## Task 4: Harden Playwright Scripts And Config

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/playwright.config.ts`

- [ ] **Step 1: Update `apps/web/package.json` scripts**

Modify the `scripts` object to include E2E commands:

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test:e2e": "playwright test --reporter=list",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:report": "playwright show-report"
}
```

- [ ] **Step 2: Update `apps/web/playwright.config.ts`**

Replace the file with this content:

```typescript
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 3000",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
```

- [ ] **Step 3: Verify Playwright can list tests**

Run:

```bash
cd apps/web
npx playwright test --list
```

Expected: output lists tests from `e2e/login.spec.ts`.

## Task 5: Improve Login E2E Test Readability

**Files:**
- Modify: `apps/web/e2e/login.spec.ts`

- [ ] **Step 1: Replace login spec with step-based assertions**

Replace `apps/web/e2e/login.spec.ts` with this content:

```typescript
import { expect, test } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
  });

  test("renders the login page", async ({ page }) => {
    await test.step("show the app heading", async () => {
      await expect(page.getByRole("heading", { name: "Team Request Hub" })).toBeVisible();
    });

    await test.step("show the Google login button", async () => {
      await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    });

    await test.step("capture desktop screenshot", async () => {
      await page.screenshot({ path: "e2e/screenshots/login-page.png", fullPage: true });
    });
  });

  test("allows the Google login button to be clicked", async ({ page }) => {
    const googleButton = page.getByRole("button", { name: /google/i });

    await expect(googleButton).toBeEnabled();
  });

  test("renders on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await expect(page.getByRole("heading", { name: "Team Request Hub" })).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    await page.screenshot({ path: "e2e/screenshots/login-mobile.png", fullPage: true });
  });
});
```

- [ ] **Step 2: Run login E2E tests**

Run:

```bash
cd apps/web
npm run test:e2e -- e2e/login.spec.ts
```

Expected: `3 passed`.

- [ ] **Step 3: Verify screenshots exist**

Run:

```bash
cd apps/web
test -f e2e/screenshots/login-page.png && test -f e2e/screenshots/login-mobile.png
```

Expected: command exits with status `0` and no output.

## Task 6: Run Full Local Verification

**Files:**
- No file changes expected.

- [ ] **Step 1: Run backend suite**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: all backend tests pass.

- [ ] **Step 2: Run frontend lint**

Run:

```bash
cd apps/web
npm run lint
```

Expected: lint exits successfully.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd apps/web
npm run build
```

Expected: Next.js build exits successfully.

- [ ] **Step 4: Run E2E smoke tests**

Run:

```bash
cd apps/web
npm run test:e2e
```

Expected: Playwright reports all E2E tests passed.

## Task 7: Prepare Next Phase Backlog

**Files:**
- Modify: `docs/testing.md`

- [ ] **Step 1: Add next-phase backlog to `docs/testing.md`**

Append this section to `docs/testing.md`:

```markdown
## Next Phase Backlog

- Add Supabase branch seed/reset scripts after test branch credentials are available.
- Add authenticated API integration tests for `fe`, `be`, and `lead` users.
- Add request workflow E2E tests for create, self-assign, status update, done, and cancel.
- Add lead-only admin E2E tests.
- Add notification E2E tests.
- Add file/storage smoke tests after storage test setup is confirmed.
- Add CI only after local commands are deterministic.
```

- [ ] **Step 2: Verify docs include backlog**

Run:

```bash
grep -n "Next Phase Backlog" docs/testing.md
```

Expected: output includes the line number for `## Next Phase Backlog`.

## Self-Review

- Spec coverage: The plan implements the local-first foundation, env templates, safety guard, API smoke tests, Playwright hardening, local commands, and next-phase backlog. Supabase branch automation, authenticated role tests, and storage tests are intentionally deferred to the next phase because they require branch credentials and seed details.
- Placeholder scan: No `TBD`, `TODO`, or unspecified code steps are present.
- Type consistency: Commands and file paths match the current two-app repo shape: backend commands run from `apps/api`, frontend commands run from `apps/web`.
