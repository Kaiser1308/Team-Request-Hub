# Testing Guide

This project uses a local-first strict testing workflow. Tests must run against a dedicated Supabase branch, never against production or staging data.

## Test Environment Rules

- Use a Supabase branch created from the current project for test data.
- Do not use `apps/api/.env` or `apps/web/.env.local` for destructive or integration tests.
- Use `APP_ENV=test` for backend tests that may write data.
- Use deterministic seed data with a clear prefix such as `e2e_`.
- Do not commit real Supabase service-role keys, access tokens, or user passwords.

## Backend Local Commands

Backend direct dependencies are pinned in `apps/api/requirements.txt`. Rebuild the local venv after dependency changes.

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
```

If `.venv` or `.uv-cache` is corrupt, recreate the venv and use a fresh temporary cache:

```bash
uv --cache-dir /tmp/opencode/team-request-hub-uv-cache venv --clear
uv --cache-dir /tmp/opencode/team-request-hub-uv-cache pip install -r requirements.txt
PYTHONWARNINGS=ignore uv --cache-dir /tmp/opencode/team-request-hub-uv-cache run python -m unittest discover tests
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

## CI

`.github/workflows/ci.yml` runs on manual dispatch, pushes to `master`, and pull requests targeting `master`.

CI jobs:

- Backend tests from `apps/api` with pinned `requirements.txt` and test env placeholders.
- Frontend lint and build from `apps/web` with public env placeholders.

CI does not run Playwright E2E yet because authenticated seed data and a dedicated Supabase test branch are still pending.

## Pass Criteria

- Backend tests pass completely.
- Current backend baseline: `259` unittest tests pass with warnings ignored for dependency deprecation noise.
- Frontend lint and build pass.
- E2E critical smoke tests pass on Chromium.
- Tests do not require production data.
- Forbidden role paths are rejected by the backend even if the UI hides actions.

## Next Phase Backlog

- Add Supabase branch seed/reset scripts after test branch credentials are available.
- Add authenticated API integration tests for `fe`, `be`, and `lead` users.
- Add request workflow E2E tests for create, self-assign, status update, done, and cancel.
- Add lead-only admin E2E tests.
- Add notification E2E tests.
- Add file/storage smoke tests after storage test setup is confirmed.
- Add CI E2E only after local authenticated smoke tests are deterministic.
