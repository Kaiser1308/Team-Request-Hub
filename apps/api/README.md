# Team Request Hub API

FastAPI backend for Team Request Hub.

## Setup

```bash
uv --cache-dir .uv-cache venv
uv --cache-dir .uv-cache pip install -r requirements.txt
cp .env.example .env
```

Fill `.env` with Supabase backend credentials. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

## Run

```bash
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

Run backend tests:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

Health check:

```txt
GET http://localhost:8000/health
```

Expected response:

```json
{"status":"ok"}
```

API docs:

```txt
http://localhost:8000/docs
```

## Current State

- FastAPI routers are mounted for health, users, requests, and notifications.
- Supabase service-role access stays backend-only through `app/db/supabase.py`.
- Request workflow logic lives in services and writes assignment history, status logs, and notification records.
- Role updates are lead-only through `PATCH /users/{user_id}/role`.
- Local verification uses `uv --cache-dir .uv-cache` from this directory.
