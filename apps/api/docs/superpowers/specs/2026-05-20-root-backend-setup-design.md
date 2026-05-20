# Root Backend Setup Design

## Goal

Scaffold the Team Request Hub FastAPI backend directly at the repository root, based on `SETUP_BE_TEAM_REQUEST_HUB.md`.

## Structure

Create the backend files at root instead of under `backend/`:

```txt
app/
  main.py
  core/
    auth.py
    config.py
    permissions.py
  db/
    supabase.py
  routes/
    health.py
    notifications.py
    requests.py
    users.py
  schemas/
    common.py
    notifications.py
    requests.py
    users.py
  services/
    assignments.py
    notifications.py
    requests.py
    status_logs.py
    users.py
  utils/
    time.py
requirements.txt
.env.example
README.md
```

## Behavior

The implementation will follow the setup guide skeleton:

- FastAPI app with CORS and routers for health, users, requests, and notifications.
- Supabase admin client built from backend-only service role credentials.
- JWT auth guard that verifies Supabase JWTs and loads the current user from the backend database.
- Pydantic schemas for roles, request status, priority, users, internal requests, and notifications.
- Permission helpers for view, reassign, cancel, and assignee-or-lead checks.
- Request routes for list, create, detail, update, self-assign, reassign, status update, done, and cancel.
- Notification routes for list and mark-read.

## Implementation Notes

Use `utc_now_iso()` for timestamp updates instead of passing the string `"now()"` to Supabase, because the Python client may store it as a literal string.

Service files are created as placeholders to match the expected project shape. Business-rule persistence helpers for assignment history, status logs, and notifications can be implemented after DB schema is finalized.

## Verification

Run import or startup checks after scaffolding. The primary smoke check is that `app.main:app` imports successfully and the app exposes `/health`.
