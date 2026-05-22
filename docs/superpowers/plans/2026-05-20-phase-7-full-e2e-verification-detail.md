# Phase 7 Full End-To-End Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute this verification plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Team Request Hub MVP works end-to-end with real Supabase configuration, passing automated checks and manual browser smoke tests, then update docs to match the final implementation state.

**Architecture:** This phase should not add product features. It verifies the established architecture: Next.js uses Supabase only for auth/session, FastAPI owns workflow permissions and database access, and Supabase stores auth users plus application tables.

**Tech Stack:** FastAPI, uv, unittest, Supabase PostgreSQL/Auth, Next.js 15, npm, browser smoke testing.

---

## Required Context

Read these before executing:

```txt
AGENTS.md
apps/api/README.md
apps/web/README.md
docs/architecture.md
docs/api-contract.md
docs/database-schema.md
docs/frontend-ui-framework.md
docs/permissions.md
docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

Also inspect phase detail plans if a failure points to a specific phase:

```txt
docs/superpowers/plans/2026-05-20-phase-1-backend-stabilization-detail.md
docs/superpowers/plans/2026-05-20-phase-2-auth-ui-detail.md
docs/superpowers/plans/2026-05-20-phase-3-frontend-data-layer-app-shell-detail.md
docs/superpowers/plans/2026-05-20-phase-4-request-list-create-ui-detail.md
docs/superpowers/plans/2026-05-20-phase-5-request-actions-detail.md
docs/superpowers/plans/2026-05-20-phase-6-lead-admin-notifications-detail.md
```

## Phase Scope

In scope:

```txt
- Verify backend env/config loads.
- Verify backend unit tests, compile checks, import checks, and route list.
- Verify frontend lint and production build.
- Verify Supabase schema exists.
- Verify Supabase Auth Google provider redirects correctly.
- Start backend and frontend locally.
- Manually smoke test core MVP flows.
- Update docs and README current-state sections.
- Produce final release-readiness report.
```

Out of scope:

```txt
- New product features.
- Large refactors.
- New database migrations beyond re-running the existing schema if missing.
- Production deployment.
- CI/CD setup.
- Payment, email, push, or realtime notification providers.
```

Known current setup:

```txt
- Supabase project URL is configured in local env files.
- DB schema was applied once and backend Supabase service query returned rows 0.
- Google OAuth provider authorize endpoint redirected to accounts.google.com.
- apps/api uses uv with .uv-cache.
- apps/web uses npm and may require npm install --force if native optional dependencies are missing on Windows.
```

Risks:

```txt
- Runtime E2E requires at least two users to fully test creator vs assignee notification/role flows.
- Lead-only role management requires one user to already have role lead in public.users.
- Supabase projects with new JWT Signing Keys may require future backend auth refactor if legacy JWT secret becomes unavailable.
- Browser OAuth smoke may require user interaction and cannot be fully automated without credentials.
```

---

## Files

Modify only if verification exposes stale docs or a real bug:

```txt
docs/architecture.md
docs/api-contract.md
docs/database-schema.md
docs/permissions.md
README.md
apps/api/README.md
apps/web/README.md
API_CONTRACT_TEAM_REQUEST_HUB.md
BUSINESS_RULES_TEAM_REQUEST_HUB.md
```

Do not modify unless fixing a verified failure:

```txt
apps/api/app/*
apps/web/src/*
DB_SCHEMA_TEAM_REQUEST_HUB.sql
```

---

## Task 1: Preflight Environment And Supabase Checks

**Files:**

- Modify: none unless docs are stale.

- [ ] **Step 1: Check backend env keys are present without printing secrets**

Run from repo root:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -c "from app.core.config import get_settings; s=get_settings(); print('config ok'); print('url', s.supabase_url.startswith('https://')); print('anon', bool(s.supabase_anon_key)); print('service', bool(s.supabase_service_role_key)); print('jwt', bool(s.supabase_jwt_secret))"
```

Expected:

```txt
config ok
url True
anon True
service True
jwt True
```

If `jwt False`, stop and report that current backend auth still expects
`SUPABASE_JWT_SECRET`.

- [ ] **Step 2: Check frontend env keys are present without printing secrets**

Run from repo root:

```bash
cd apps/web
node -e "const keys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_API_URL']; for (const key of keys) console.log(key, process.env[key] ? 'SET' : 'MISSING')"
```

Expected:

```txt
NEXT_PUBLIC_SUPABASE_URL SET
NEXT_PUBLIC_SUPABASE_ANON_KEY SET
NEXT_PUBLIC_API_URL SET
```

If this prints missing values, ensure `apps/web/.env.local` exists.

- [ ] **Step 3: Verify Supabase tables through backend service client**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -c "from app.db.supabase import get_supabase_admin; client=get_supabase_admin(); tables=['users','internal_requests','assignment_history','request_status_logs','notifications']; [client.table(t).select('*').limit(1).execute() for t in tables]; print('supabase tables ok')"
```

Expected:

```txt
supabase tables ok
```

If a table is missing, apply `DB_SCHEMA_TEAM_REQUEST_HUB.sql` in Supabase SQL
Editor and rerun this step.

- [ ] **Step 4: Verify Google OAuth provider redirects**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -c "from app.core.config import get_settings; import urllib.parse, urllib.request, urllib.error; s=get_settings(); endpoint=s.supabase_url.rstrip('/') + '/auth/v1/authorize?' + urllib.parse.urlencode({'provider':'google','redirect_to':'http://localhost:3000'}); req=urllib.request.Request(endpoint, headers={'apikey':s.supabase_anon_key}); class NoRedirect(urllib.request.HTTPRedirectHandler):\n    def redirect_request(self, req, fp, code, msg, headers, newurl): return None\nopener=urllib.request.build_opener(NoRedirect);\ntry:\n    opener.open(req, timeout=20); print('authorize returned without redirect')\nexcept urllib.error.HTTPError as e:\n    loc=e.headers.get('Location',''); print('status', e.code); print('redirect_to_google', 'google.com' in loc)"
```

Expected:

```txt
status 302
redirect_to_google True
```

---

## Task 2: Automated Backend Verification

**Files:**

- Modify: backend files only if a check fails and the root cause is a backend bug.

- [ ] **Step 1: Run backend unit tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected:

```txt
OK
```

- [ ] **Step 2: Run backend compile check**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m compileall app tests
```

Expected:

```txt
command exits 0
```

- [ ] **Step 3: Run backend import check**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -c "import app.main; print('import ok')"
```

Expected:

```txt
import ok
```

- [ ] **Step 4: Print route list and compare with docs**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -c "from app.main import app; print('\\n'.join(sorted(route.path for route in app.routes if hasattr(route, 'path'))))"
```

Expected route families:

```txt
/health
/users/me
/users
/users/{user_id}/role
/requests
/requests/{request_id}
/requests/{request_id}/self-assign
/requests/{request_id}/reassign
/requests/{request_id}/status
/requests/{request_id}/done
/requests/{request_id}/cancel
/requests/{request_id}/assignment-history
/requests/{request_id}/status-logs
/notifications
/notifications/{notification_id}/read
/notifications/read-all
```

If route behavior differs, update `docs/api-contract.md` and
`API_CONTRACT_TEAM_REQUEST_HUB.md` in Task 6.

---

## Task 3: Automated Frontend Verification

**Files:**

- Modify frontend files only if a check fails and the root cause is a frontend bug.

- [ ] **Step 1: Ensure dependencies are usable on Windows**

Run from `apps/web`:

```bash
npm install --force
```

Expected:

```txt
command exits 0
```

This is acceptable on this Windows workspace because optional native packages
for Next/SWC and lightningcss have previously been missing after sandboxed runs.

- [ ] **Step 2: Run frontend lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected:

```txt
eslint exits 0
```

- [ ] **Step 3: Run frontend build**

Run from `apps/web`:

```bash
npm run build
```

Expected:

```txt
next build exits 0
```

- [ ] **Step 4: Confirm no forbidden FE patterns**

Run from repo root:

```bash
rg --line-number "SUPABASE_SERVICE_ROLE_KEY|createServerClient|from\\(\" apps/web/src
rg --line-number "src/app/api|app/api" apps/web/src
```

Expected:

```txt
No frontend service-role usage.
No frontend business API route handlers.
```

If `rg` returns intentional Supabase auth/session code, inspect manually and
report it.

---

## Task 4: Start Local Servers

**Files:**

- Modify: none.

- [ ] **Step 1: Start backend**

Run from `apps/api` in a dedicated terminal:

```bash
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

Expected:

```txt
Uvicorn running on http://127.0.0.1:8000
```

- [ ] **Step 2: Check backend health**

Open or request:

```txt
http://localhost:8000/health
```

Expected:

```json
{"status":"ok"}
```

- [ ] **Step 3: Start frontend**

Run from `apps/web` in a dedicated terminal:

```bash
npm run dev
```

Expected:

```txt
Local: http://localhost:3000
```

- [ ] **Step 4: Open app**

Open:

```txt
http://localhost:3000
```

Expected:

```txt
Unauthenticated browser redirects to /login.
```

---

## Task 5: Manual Browser Smoke Test

**Files:**

- Modify product files only if the smoke test exposes a real bug.

- [ ] **Step 1: Auth smoke**

In the browser:

```txt
1. Open http://localhost:3000/login.
2. Click Continue with Google.
3. Complete Google login.
4. Confirm the app returns to /dashboard.
5. Confirm top bar shows current user and role.
6. Click Sign out.
7. Confirm the app returns to /login.
```

Expected:

```txt
Login/logout completes without frontend crashes or backend 401 loops after login.
```

- [ ] **Step 2: Ensure one lead user exists**

In Supabase Table Editor, inspect `public.users`.

If no user has role `lead`, update the test user's role to `lead` manually for
this smoke test.

Expected:

```txt
At least one test account has role lead.
```

- [ ] **Step 3: Request create/list smoke**

In the browser as a logged-in user:

```txt
1. Open /requests/new.
2. Create a request with title, description, priority, tags, and optional links.
3. Confirm redirect to /requests.
4. Confirm the request appears in Created by me.
5. Open Assigned, Pool, Done, and All requests.
6. Confirm forbidden states or empty states render cleanly where expected.
```

Expected:

```txt
Create succeeds and list pages render without 4xx/5xx UI crashes.
```

- [ ] **Step 4: Request workflow smoke**

Use a lead or BE user and a request that is open:

```txt
1. Open the request detail.
2. If it is in Pool, self-assign it.
3. Acknowledge the request.
4. Start the request.
5. Mark done with a non-empty reply.
6. Confirm status becomes done and reply displays.
7. Create another request and cancel it.
8. As lead, test reassign with a valid user id.
```

Expected:

```txt
Workflow actions complete in order and backend rejects invalid actions with readable UI errors.
```

- [ ] **Step 5: Notifications smoke**

In the browser:

```txt
1. Open Dashboard.
2. Confirm notifications list renders.
3. Trigger at least one workflow action that creates a notification.
4. Confirm notification appears for the expected user.
5. Mark one notification read.
6. Mark all notifications read.
```

Expected:

```txt
Notifications display and read actions update UI after mutation.
```

- [ ] **Step 6: Lead role management smoke**

As a lead user:

```txt
1. Open /admin/users.
2. Confirm user table loads.
3. Change a non-lead user's role to be or fe.
4. Confirm the row updates.
5. Log in as a non-lead user or inspect nav.
6. Confirm Users nav is hidden or forbidden state is shown.
```

Expected:

```txt
Lead can update roles; non-leads cannot manage roles.
```

- [ ] **Step 7: Mobile viewport smoke**

Resize browser to a mobile width around 390px.

Check:

```txt
login
dashboard
request list
request detail
create request
admin users table
```

Expected:

```txt
No obvious text overlap, broken navigation, or inaccessible primary actions.
```

---

## Task 6: Update Documentation

**Files:**

- Modify: `docs/architecture.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/database-schema.md` only if schema notes are stale
- Modify: `docs/permissions.md`
- Modify: `README.md`
- Modify: `apps/api/README.md`
- Modify: `apps/web/README.md`
- Modify: `API_CONTRACT_TEAM_REQUEST_HUB.md`
- Modify: `BUSINESS_RULES_TEAM_REQUEST_HUB.md`

- [ ] **Step 1: Update architecture current state**

Add or update a `## Current State` section in `docs/architecture.md`:

```md
## Current State

- Google OAuth login/logout is implemented in `apps/web`.
- Frontend protected pages call FastAPI through `apiFetch` with a Supabase Bearer JWT.
- Request list, create, detail, workflow action, role management, and notification UI are implemented.
- Backend request workflow creates assignment history, status logs, and notifications.
- Lead role management is available through `PATCH /users/{user_id}/role`.
```

- [ ] **Step 2: Update API docs if route list differs**

Compare Task 2 route output with:

```txt
docs/api-contract.md
API_CONTRACT_TEAM_REQUEST_HUB.md
```

If route list and payloads already match, do not churn docs. If they differ,
update the docs to match executable backend behavior.

- [ ] **Step 3: Update frontend README current state**

In `apps/web/README.md`, replace skeleton statements with current MVP status:

```md
## Current State

- Google OAuth login/logout is implemented.
- Protected dashboard routes use the app shell and current user role.
- Request list, create, detail, workflow action, admin users, and notification UI are implemented.
- Frontend still depends on a running FastAPI backend and Supabase project for runtime smoke tests.
```

- [ ] **Step 4: Update root README**

In `README.md`, add a short MVP verification section:

```md
## MVP Verification

Backend:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

Frontend:

```bash
cd apps/web
npm run lint
npm run build
```
```

- [ ] **Step 5: Run docs-adjacent final checks**

Run:

```bash
rg --line-number "placeholder|skeleton|TODO|TBD" README.md docs apps/web/README.md apps/api/README.md
```

Expected:

```txt
No stale placeholder/skeleton wording that contradicts current implementation.
```

If results are intentional historical docs, report them.

---

## Task 7: Final Report

**Files:**

- Modify: none.

- [ ] **Step 1: Run final automated checks**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

Run:

```bash
cd apps/web
npm run lint
npm run build
```

Expected:

```txt
all commands exit 0
```

- [ ] **Step 2: Summarize E2E smoke results**

Create final report text with:

```txt
- backend test result
- backend compile result
- frontend lint result
- frontend build result
- Supabase schema check result
- Google OAuth redirect check result
- browser smoke checklist result
- docs updated
- known remaining risks
```

- [ ] **Step 3: Known risk checklist**

Explicitly evaluate:

```txt
- JWT verification still depends on SUPABASE_JWT_SECRET.
- Reassign UI uses raw user id unless Phase 6 improved it.
- No CI configured.
- No automated browser tests configured.
- No production deployment config.
- No realtime notifications.
```

## Done Criteria

Phase 7 is complete when:

```txt
- Supabase table check passes.
- Google OAuth provider redirects to Google.
- Backend unittest passes.
- Backend compileall passes.
- Backend import check passes.
- Frontend lint passes.
- Frontend build passes.
- Backend and frontend dev servers start.
- Browser smoke test is completed or clearly marked blocked with reason.
- Docs no longer describe the frontend as a skeleton if phases 2-6 are implemented.
- Final report lists pass/fail state and remaining risks.
```
