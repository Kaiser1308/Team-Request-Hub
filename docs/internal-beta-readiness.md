# Internal Beta Readiness

This document tracks what is safe for internal use now and what should be improved before a wider production rollout.

## Current Decision

Team Request Hub can be used as an internal beta for a small team after the request workflow regression fixes landed.

Use it with these assumptions:

- Access is limited to the team through the configured Cloudflare route and app login.
- Supabase project credentials and MinIO credentials are production values, not test values.
- `SUPABASE_SERVICE_ROLE_KEY` is only present in `apps/api/.env` and never exposed through `apps/web`.
- Supabase and MinIO data are backed up before regular team usage.
- The team accepts that role/deactivation changes can take up to the current backend profile cache TTL to fully take effect in a running API worker.
- Backend direct dependencies are pinned in `apps/api/requirements.txt` to reduce Docker build drift.

## Recently Fixed

- `PATCH /requests/{request_id}` now updates non-empty payloads instead of returning before the repository update.
- Empty request update payloads return the unchanged request without crashing.
- Request create and self-assign no longer swallow `request_assignees` write failures.
- Backend regression coverage was added for request update and assignment membership failure behavior.
- Backend unittest suite passes: `256` tests.
- Supabase performance advisor's unindexed `request_assignees.assigned_by` foreign key warning is resolved by `idx_request_assignees_assigned_by`.

## Internal Beta Checklist

- Run backend tests from `apps/api` before deploy.
- Run frontend lint and build from `apps/web` before deploy.
- Verify `CORS_ORIGINS` is the app domain only.
- Verify `NEXT_PUBLIC_API_URL` points to the public API route.
- Verify MinIO bucket CORS allows the app domain only.
- Verify `https://api.kaiser-bot.online/health` returns `{"status":"ok"}`.
- Verify `docker compose ps` reports `healthy` for `web`, `api`, and `minio`.
- Verify login, dashboard, create request, self-assign, status update, done reply, file upload, preview, and download manually after deploy.
- Confirm Supabase backups and MinIO volume backups are configured.

## Remaining P1 Work

- Periodically review pinned backend dependency versions and update intentionally with tests.
- Add security headers through Next.js, FastAPI middleware, or Cloudflare.
- Add Cloudflare/API rate limits for webhook and upload-url endpoints.
- Add a simple CI workflow once local commands are deterministic.

## Remaining P2 Work

- Move external notification delivery to a durable queue if usage grows.
- Add cursor pagination for request lists and file activity if data grows.
- Add load tests for dashboard, request list, request lifecycle, file upload, and notification flows.
- Add a restore drill for Supabase and MinIO, not just backup creation.
- Add basic metrics/log aggregation for API latency, container restarts, Supabase latency, MinIO errors, and notification delivery failures.

## Scale Expectation

This version is appropriate for a small internal team, roughly `5-30` active users and likely acceptable up to `100` active internal users if request/file activity is moderate.

Do not claim capacity above that without load testing the actual workstation, Supabase project, MinIO volume, and Cloudflare tunnel setup.

## Next Recommended Step

Do the P1 work in this order:

1. Add CI for backend tests and frontend lint/build.
2. Add load tests for the internal beta critical paths.
3. Run a manual deploy smoke test against the workstation stack after applying DB RPC migrations.
