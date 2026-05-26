# Team Request Hub

Team Request Hub is a monorepo for the request management platform.

## Tech Stack

- Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
- Backend: FastAPI
- Database/Auth: Supabase PostgreSQL + Supabase Auth

## Project Structure

```text
team-request-hub/
├── apps/
│   ├── api/   # FastAPI backend
│   └── web/   # Next.js frontend
├── docs/      # Architecture, API, database, and permissions notes
```

## Agent Handoff Docs

Read these before assigning or executing phase work:

```text
docs/architecture.md
docs/api-contract.md
docs/database-schema.md
docs/permissions.md
docs/frontend-ui-framework.md
docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

For frontend work, treat `ui-frameware/` as a visual reference only. Rebuild the
screens using the rules in `docs/frontend-ui-framework.md`.

## Auth And Welcome Flow (Important)

Frontend login no longer redirects directly to `/dashboard`.

```txt
/login
  -> Supabase OAuth / password login
  -> /auth/callback
  -> /auth/welcome?next=/dashboard
  -> preload dashboard
  -> redirect to dashboard
```

If `GET /users/me` returns `is_active = false`, `/auth/welcome` must show the
blocked-account state (`ACCOUNT DISABLED`) and must not redirect into dashboard.

## Running The Frontend

```bash
cd apps/web
npm install
npm run dev
```

## Running The Backend

```bash
cd apps/api
uv --cache-dir .uv-cache venv
uv --cache-dir .uv-cache pip install -r requirements.txt
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

## Environment Variables

Environment variables are stored in each app's `.env.example` file. Copy the relevant example file to a local `.env` file before running an app.

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

Runtime smoke checks require valid local Supabase env files, a configured Google OAuth provider, and at least one `lead` user in `public.users` for role-management verification.

# Quick tunnel
cloudflared tunnel --url http://localhost:8000