# Workstation Docker Deployment

This deployment moves the existing public app from the current machine to the company workstation without changing domains.

## Public Routes

Keep these Cloudflare Zero Trust tunnel routes:

```text
app.kaiser-bot.online    -> http://web:3000
api.kaiser-bot.online    -> http://api:8000
minio.kaiser-bot.online  -> http://minio:9000
```

The Cloudflare tunnel runs inside Docker through the `cloudflared` service.

## One-Time Workstation Setup

Install Git and Docker, then clone the repository:

```bash
git clone <repo-url>
cd team-request-hub
```

Create the root production env file:

```bash
cp .env.production.example .env
```

Fill `.env` with:

```env
CLOUDFLARE_TUNNEL_TOKEN=<fixed-cloudflare-token>
APP_PUBLIC_URL=https://app.kaiser-bot.online
API_PUBLIC_URL=https://api.kaiser-bot.online
MINIO_PUBLIC_URL=https://minio.kaiser-bot.online
MINIO_ROOT_USER=<strong-minio-user>
MINIO_ROOT_PASSWORD=<strong-minio-password>
MINIO_BUCKET=team-files
```

Create or copy `apps/web/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=<supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
NEXT_PUBLIC_API_URL=https://api.kaiser-bot.online
NEXT_PUBLIC_SITE_URL=https://app.kaiser-bot.online
```

Create or copy `apps/api/.env`, but use Docker MinIO values:

```env
APP_NAME=Team Request Hub API
APP_ENV=production
CORS_ORIGINS=https://app.kaiser-bot.online
APP_BASE_URL=https://app.kaiser-bot.online

SUPABASE_URL=<supabase-url>
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SUPABASE_JWT_SECRET=<supabase-jwt-secret>

MINIO_ENDPOINT=minio:9000
MINIO_REGION=us-east-1
MINIO_BUCKET=team-files
MINIO_ACCESS_KEY=<same-as-MINIO_ROOT_USER>
MINIO_SECRET_KEY=<same-as-MINIO_ROOT_PASSWORD>
MINIO_SECURE=false
MINIO_PUBLIC_ENDPOINT=https://minio.kaiser-bot.online
```

Keep notification secrets in `apps/api/.env` if Telegram, email, or web push are used.

## First Start

Stop the old app and tunnel on the current machine, then start the stack on the company workstation:

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

The `minio-init` service creates the `team-files` bucket and applies CORS for `https://app.kaiser-bot.online`.

The Compose stack includes healthchecks for `web`, `api`, and `minio`. `web` checks `http://127.0.0.1:3000`, `api` checks `http://127.0.0.1:8000/health`, and `minio` uses `mc ready local`.

## Verification

Open:

```text
https://app.kaiser-bot.online
```

Verify basic service health:

- Login works.
- Dashboard loads.
- `https://api.kaiser-bot.online/health` responds.
- `docker compose ps` reports `healthy` for `web`, `api`, and `minio` after startup.
- Upload from `/files` works.
- File preview/download works through `https://minio.kaiser-bot.online`.
- Request attachment upload works.

## Manual Smoke Checklist

Run this checklist after every workstation deploy before announcing the app is ready for team use.

### Auth And Shell

- Open `https://app.kaiser-bot.online`.
- Sign in with Google OAuth.
- Confirm inactive users stop at the pending approval screen.
- Confirm an active user reaches the dashboard.
- Confirm sidebar navigation works for Dashboard, Assigned, Pool, Done, Files, and Notifications.

### Request Pool And Assignment

- Create a new request without assignees.
- Open Pool and confirm the request appears.
- Self-assign the request.
- Return to Pool and confirm the request no longer appears.
- Open Assigned and confirm the request appears for the assignee.
- Open Dashboard and confirm assigned/pending counts reflect the request.

### Request Workflow

- Open the request detail page.
- Move status from `pending` to `acknowledged`.
- Move status from `acknowledged` to `in_progress`.
- Submit a Done reply.
- Open Done and confirm the completed request appears.
- Confirm assignment history and status logs render on the detail page.

### Multi-Assignee Visibility

- As a creator or lead, add a second assignee to an open request.
- Sign in as the second assignee or ask them to check.
- Confirm the request appears in their Assigned view and Dashboard.
- Complete the request and confirm it appears in their Done view.

### Files And Attachments

- Upload a file from Files.
- Preview the uploaded file if its type is supported.
- Download the uploaded file.
- Create a request attachment during request creation or Done reply submission.
- Confirm the attachment appears on the request detail page.

### Notifications

- Trigger an assignment notification.
- Open Notifications and confirm the notification appears.
- Mark it read and confirm unread state updates.
- If Telegram/email/web push are configured, confirm external delivery manually for one assignment.

### Admin

- As a lead, open Admin Users.
- Approve or deactivate a test user if available.
- Confirm non-lead users cannot access lead-only pages/actions.

Record any failure with the user, browser, route, request ID, timestamp, and relevant `docker compose logs -f api` output.

## Updates

Run:

```bash
./scripts/deploy.sh
```

The script pulls code, rebuilds images, restarts containers, and keeps the MinIO Docker volume.

## MinIO Reset Note

This setup starts a new local MinIO volume. Existing Supabase file metadata may still reference old object keys. If old files are not needed, clean file metadata tables in Supabase carefully: `team_files`, `file_activity_logs`, and `request_attachments`.
