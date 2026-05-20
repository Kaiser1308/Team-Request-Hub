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
