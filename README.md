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
docs/superpowers/specs/2026-05-25-team-files-explorer-design.md
docs/superpowers/plans/2026-05-25-team-files-explorer-implementation.md
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

## Team Files (Shared File Explorer)

The dashboard includes a shared file explorer at `/files`. All active members can browse, search, upload files, create folders, preview images/PDFs, and download files. Only `lead` users can rename, move, delete, and restore files. Deleted files are kept in trash for 7 days before permanent purge.

File storage uses **MinIO** (self-hosted, S3-compatible). The backend generates short-lived presigned URLs for upload/download; MinIO credentials are never exposed to the frontend.

### MinIO Setup

```bash
# Start MinIO with Docker
docker run -d -p 9002:9000 -p 9003:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  --name team-files-minio \
  minio/minio server /data --console-address ":9001"

# Create the bucket
docker exec team-files-minio mc alias set local http://localhost:9000 minioadmin minioadmin
docker exec team-files-minio mc mb local/team-files
```

MinIO Console: `http://localhost:9003` (login: `minioadmin` / `minioadmin`)

### Backend MinIO Config

Add to `apps/api/.env`:

```txt
MINIO_ENDPOINT=localhost:9002
MINIO_REGION=us-east-1
MINIO_BUCKET=team-files
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
```

### Database Migration

Run the Team Files section (section 10+) from `DB_SCHEMA_TEAM_REQUEST_HUB.sql` in your Supabase SQL editor to create `team_files` and `file_activity_logs` tables.

## Environment Variables

Environment variables are stored in each app's `.env.example` file. Copy the relevant example file to a local `.env` file before running an app.

For the file explorer, MinIO environment variables are also required (see Team Files section above).

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