# Team Request Hub API

FastAPI backend for Team Request Hub.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Fill `.env` with Supabase backend credentials. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side only.

## Run

```bash
uvicorn app.main:app --reload --port 8000
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
