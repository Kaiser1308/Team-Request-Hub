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
