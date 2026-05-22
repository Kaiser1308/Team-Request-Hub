# BE Setup: Team Request Hub

This document describes the current backend setup for `apps/api`.

## Stack

```txt
Runtime     Python + FastAPI
Package     uv + requirements.txt
Database    Supabase PostgreSQL
Auth        Supabase Auth JWT
DB access   Supabase service-role key, backend only
Tests       Python unittest
```

## Backend Responsibility

FastAPI owns all server-side business logic:

```txt
- Verify Supabase JWT
- Load current user profile from public.users
- Enforce role and request permissions
- Create and update internal requests
- Assign, self-assign, and reassign requests
- Update status, mark done, and cancel
- Create notification records
- Create assignment history
- Create request status logs
- Update user roles through lead-only endpoint
```

Frontend must not store service-role keys, query Supabase tables directly, or
make workflow decisions that belong to the backend.

## Current Architecture

The backend uses this layering:

```txt
routes -> services / notification_module -> repositories -> Supabase
```

```txt
apps/api/app/
  main.py
  core/
    auth.py
    config.py
    permissions.py
  db/
    supabase.py
  notification_module/
    __init__.py          public interface
    _store.py            notification + delivery + telegram DB access
    _telegram.py         message building + sending
    _webhook.py          webhook /start handling
  repositories/
    assignment_repository.py
    request_repository.py
    status_log_repository.py
    user_repository.py
  routes/
    dashboard.py
    health.py
    notifications.py
    requests.py
    telegram.py
  schemas/
    common.py
    dashboard.py
    notifications.py
    requests.py
    telegram.py
    users.py
  services/
    dashboard.py
    request_service.py
    users.py
  utils/
    time.py
tests/
  test_request_service_rules.py
  test_user_service_roles.py
```

Rules:

```txt
- Routes stay thin and call services.
- Services own business workflow, permission orchestration, and side effects.
- Repositories own Supabase table access only.
- Schemas own Pydantic request/response shapes.
```

## Local Setup

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache venv
uv --cache-dir .uv-cache pip install -r requirements.txt
cp .env.example .env
```

Fill `.env`:

```env
APP_NAME=Team Request Hub API
APP_ENV=development
CORS_ORIGINS=http://localhost:3000

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY` must stay backend-only.

## Run

```bash
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

Health check:

```txt
GET http://localhost:8000/health
```

Expected:

```json
{"status":"ok"}
```

API docs:

```txt
http://localhost:8000/docs
```

## Test

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

## Auth Flow

```txt
User signs in with Supabase Auth from FE
Supabase returns access token
FE sends Authorization: Bearer <token> to FastAPI
FastAPI verifies token in app/core/auth.py
FastAPI loads public.users profile by JWT sub
FastAPI uses DB role for permissions
```

Backend never trusts role data from frontend.

## Roles

```txt
fe
be
lead
```

New users are created by the database trigger in `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
with default role `fe`.

Role updates are lead-only:

```txt
PATCH /users/{user_id}/role
```

Request body:

```json
{
  "role": "be"
}
```

## Core Request Rules

```txt
- Everyone can create requests.
- Requests can be directly assigned or left in pool.
- Pool means assigned_to = null and status = pending.
- Everyone can self-assign from pool.
- Creator, current assignee, or lead can reassign open requests.
- Reassign from acknowledged/in_progress requires reason and resets status to pending.
- Only assignee or lead can update active status.
- Done requires status = in_progress and a non-empty reply.
- Cancel is creator-or-lead only.
- Lead can view all requests.
```

## Side Effects

Request actions create side-effect records:

```txt
assignment_history:
- create request with assigned_to
- self-assign
- reassign

request_status_logs:
- status update
- mark done
- cancel
- reassign active request back to pending

notifications:
- assigned
- reassigned
- status_changed
- done
- cancelled
```

## Endpoint Summary

```txt
Health:
GET    /health

Users:
GET    /users/me
GET    /users
PATCH  /users/{user_id}/role

Requests:
GET    /requests
POST   /requests
GET    /requests/{request_id}
PATCH  /requests/{request_id}
POST   /requests/{request_id}/self-assign
POST   /requests/{request_id}/reassign
POST   /requests/{request_id}/status
POST   /requests/{request_id}/done
POST   /requests/{request_id}/cancel
GET    /requests/{request_id}/assignment-history
GET    /requests/{request_id}/status-logs

Notifications:
GET    /notifications
POST   /notifications/{notification_id}/read
POST   /notifications/read-all
```

## Constraints

```txt
- Do not expose SUPABASE_SERVICE_ROLE_KEY to apps/web.
- Do not trust role, created_by, status, or assignee decisions from FE.
- Do not put business workflow in routes.
- Do not put permission logic in repositories.
- Use utc_now_iso() for backend timestamps instead of SQL string literals.
```
