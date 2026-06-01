# Team Request Hub

Team Request Hub is an internal request-management platform for coordinating frontend, backend, and lead workflows. It provides authenticated request intake, assignment, status tracking, notifications, team file storage, and operational dashboards in a production-ready two-app architecture.

## Features

- Supabase authentication with Google OAuth support.
- Lead-controlled user approval, activation, and role management.
- Request creation, assignment, reassignment, cancellation, and completion workflows.
- Multi-assignee request handling with status history and assignment audit trails.
- Dashboard views for assigned, created, pending, completed, urgent, and all-team work.
- Telegram, email, and web push notification infrastructure.
- Team file explorer backed by MinIO-compatible object storage.
- Request attachments with presigned upload and preview URLs.
- Bilingual UI support for Vietnamese and English.
- Docker Compose deployment for workstation or internal production hosting.

## Architecture

```text
team-request-hub/
├── apps/
│   ├── api/   # FastAPI backend
│   └── web/   # Next.js frontend
├── DB_SCHEMA_TEAM_REQUEST_HUB.sql
├── docker-compose.yml
└── minio/
```

Runtime boundaries:

```text
Browser
  ├── Supabase Auth for login/session
  ├── FastAPI backend for business workflows
  └── MinIO public endpoint for presigned file upload/download

FastAPI
  ├── Verifies Supabase JWTs
  ├── Uses Supabase service-role access server-side
  ├── Owns permissions and workflow rules
  └── Reads/writes MinIO object metadata through Supabase tables
```

Frontend code does not contain service-role keys or direct database business logic. The backend owns workflow rules, permissions, notifications, file metadata, assignment history, and status logs.

## Tech Stack

Frontend:

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- Supabase browser/SSR clients for auth/session handling

Backend:

- FastAPI
- Pydantic and pydantic-settings
- Supabase Python client
- MinIO Python client
- Telegram, email, and web push notification modules

Infrastructure:

- Supabase PostgreSQL and Auth
- MinIO-compatible object storage
- Docker Compose
- Cloudflare Tunnel for public routing

## Production Domains

The current production deployment expects these public hostnames:

```text
https://app.kaiser-bot.online    -> web service
https://api.kaiser-bot.online    -> api service
https://minio.kaiser-bot.online  -> MinIO S3 API
```

Cloudflare Tunnel should route them to the Docker network services:

```text
app.kaiser-bot.online    -> http://web:3000
api.kaiser-bot.online    -> http://api:8000
minio.kaiser-bot.online  -> http://minio:9000
```

## Environment Setup

Required local files are intentionally not committed:

```text
.env
apps/web/.env.local
apps/api/.env
```

Root `.env` for Docker Compose:

```env
CLOUDFLARE_TUNNEL_TOKEN=
APP_PUBLIC_URL=https://app.kaiser-bot.online
API_PUBLIC_URL=https://api.kaiser-bot.online
MINIO_PUBLIC_URL=https://minio.kaiser-bot.online
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=
MINIO_BUCKET=team-files
```

Frontend env:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=https://api.kaiser-bot.online
NEXT_PUBLIC_SITE_URL=https://app.kaiser-bot.online
```

Backend env:

```env
APP_ENV=production
CORS_ORIGINS=https://app.kaiser-bot.online
APP_BASE_URL=https://app.kaiser-bot.online

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

MINIO_ENDPOINT=minio:9000
MINIO_REGION=us-east-1
MINIO_BUCKET=team-files
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_SECURE=false
MINIO_PUBLIC_ENDPOINT=https://minio.kaiser-bot.online

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
```

## Supabase Setup

For a new Supabase project:

1. Create the Supabase project.
2. Apply `DB_SCHEMA_TEAM_REQUEST_HUB.sql` in the Supabase SQL Editor.
3. Configure Google OAuth and add this redirect URL:

```text
https://app.kaiser-bot.online/auth/callback
```

4. Set the Supabase Site URL:

```text
https://app.kaiser-bot.online
```

5. Copy the new project URL, anon key, service-role key, and JWT secret into the frontend and backend env files.
6. Log in once, then promote the first user to lead:

```sql
update public.users
set role = 'lead', is_active = true
where email = 'your-admin-email@example.com';
```

## Docker Deployment

Start the full stack:

```bash
docker compose up -d --build
```

Check services:

```bash
docker compose ps
docker compose logs -f cloudflared
docker compose logs -f api
docker compose logs -f minio
```

The Docker stack includes:

```text
web          Next.js frontend
api          FastAPI backend
minio        Local object storage
minio-init   Bucket and CORS initialization
cloudflared  Cloudflare Tunnel client
```

## Local Development

Run the frontend:

```bash
cd apps/web
npm install
npm run dev
```

Run the backend:

```bash
cd apps/api
uv --cache-dir .uv-cache venv
uv --cache-dir .uv-cache pip install -r requirements.txt
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

## Verification

Frontend checks:

```bash
cd apps/web
npm run lint
npm run build
```

Backend checks:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

## Branch Strategy

- `develop`: active development and integration branch.
- `master`: production branch. Deploy production from this branch.

Production releases should be promoted from `develop` into `master` after verification.

## Security Notes

- Never commit `.env`, `.env.local`, service-role keys, tunnel tokens, or MinIO credentials.
- Supabase service-role access is backend-only.
- Frontend code must only use public Supabase keys and the FastAPI API URL.
- MinIO upload and download flows use short-lived presigned URLs.
- New users default to inactive and must be approved by a lead before using protected workflows.
