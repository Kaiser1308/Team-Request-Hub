# Team Request Hub

Team Request Hub is an internal request-management platform for coordinating product, frontend, backend, and lead workflows. It provides request intake, assignment, status tracking, notifications, file storage, and operational dashboards in a two-app architecture.

## Highlights

- Authenticated request workflow with role-based access.
- Lead-controlled user approval and role management.
- Request assignment, reassignment, status history, and completion tracking.
- Dashboard views for team workload and request progress.
- Notification infrastructure for in-app, Telegram, email, and web push channels.
- Team file explorer backed by S3-compatible object storage.
- Request attachments with presigned upload and preview flows.
- Bilingual user interface support.
- Docker Compose deployment support.

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

Runtime overview:

```text
Browser
  ├── Auth provider for login/session
  ├── FastAPI backend for business workflows
  └── S3-compatible storage endpoint for presigned file upload/download

FastAPI
  ├── Verifies user access tokens
  ├── Owns permissions and workflow rules
  ├── Uses server-side database access
  └── Coordinates request, notification, and file metadata workflows
```

The frontend handles UI, session state, and API calls. The backend owns business logic, permission enforcement, notification dispatch, file metadata, assignment history, and status logs.

## Tech Stack

Frontend:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- TanStack Query

Backend:

- FastAPI
- Pydantic
- Supabase-compatible PostgreSQL/Auth integration
- MinIO-compatible object storage integration

Infrastructure:

- PostgreSQL database and managed auth
- S3-compatible object storage
- Docker Compose
- Tunnel or reverse proxy based public routing

## Environment

Required environment files are not committed:

```text
.env
apps/web/.env.local
apps/api/.env
```

Frontend environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_SITE_URL=
```

Backend environment variables:

```env
APP_ENV=production
CORS_ORIGINS=
APP_BASE_URL=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

MINIO_ENDPOINT=
MINIO_REGION=us-east-1
MINIO_BUCKET=team-files
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_SECURE=false
MINIO_PUBLIC_ENDPOINT=

TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
```

## Database Setup

Apply the schema file to the target database:

```text
DB_SCHEMA_TEAM_REQUEST_HUB.sql
```

The schema creates the application tables, enums, indexes, triggers, row-level-security setup, and the auth profile trigger used by the backend.

After the first login, promote the initial administrator account in the database by setting the user role to `lead` and `is_active` to `true`.

## Docker Deployment

Start the stack:

```bash
docker compose up -d --build
```

Check services:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f web
docker compose logs -f minio
```

The Compose stack includes:

```text
web          Next.js frontend
api          FastAPI backend
minio        Local object storage
minio-init   Bucket and CORS initialization
cloudflared  Tunnel client for public routing
```

## Local Development

Frontend:

```bash
cd apps/web
npm install
npm run dev
```

Backend:

```bash
cd apps/api
uv --cache-dir .uv-cache venv
uv --cache-dir .uv-cache pip install -r requirements.txt
uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000
```

## Verification

Frontend:

```bash
cd apps/web
npm run lint
npm run build
```

Backend:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

## Branch Strategy

- `develop`: active development and integration branch.
- `master`: production branch.

Production deployments should be promoted from `develop` into `master` after verification.

## Security Notes

- Do not commit environment files or credentials.
- Service-role database credentials are backend-only.
- Public frontend variables must not contain secrets.
- File upload and download operations use short-lived presigned URLs.
- New users are inactive by default and must be approved before accessing protected workflows.
