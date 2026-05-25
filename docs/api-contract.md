# API Contract

Base URL for local development:

```txt
http://localhost:8000
```

Protected endpoints require:

```http
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

Standard errors use FastAPI's `detail` field.

## Health

```txt
GET /health
```

Response:

```json
{"status":"ok"}
```

## Users

```txt
GET /users/me
GET /users
PATCH /users/{user_id}/role
```

`PATCH /users/{user_id}/role` is lead-only.

Request:

```json
{
  "role": "fe"
}
```

Allowed roles:

```txt
fe | be | lead
```

Response:

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User",
  "avatar_url": null,
  "role": "fe",
  "created_at": "2026-05-20T10:00:00Z"
}
```

## Requests

```txt
GET    /requests?view=assigned|created|pool|done|all
POST   /requests
GET    /requests/{request_id}
PATCH  /requests/{request_id}
POST   /requests/{request_id}/self-assign
POST   /requests/{request_id}/reassign
POST   /requests/{request_id}/status
POST   /requests/{request_id}/done
POST   /requests/{request_id}/cancel
GET    /requests/{request_id}/assignment-history
GET    /requests/{request_id}/status-logs
```

`view=all` is lead-only.

Status updates follow:

```txt
pending -> acknowledged | cancelled
acknowledged -> in_progress | cancelled
in_progress -> acknowledged | done | cancelled
```

Use `/done` for `done` and `/cancel` for cancel actions from the frontend.

`assignment-history` and `status-logs` support optional `limit` query param with default `50` and max `100`.

## Notifications

```txt
GET  /notifications?unread_only=false&limit=50
POST /notifications/{notification_id}/read
POST /notifications/read-all
```

`GET /notifications` supports `limit` with default `50` and max `100`.

`POST /notifications/read-all` response:

```json
{
  "updated": 5
}
```

## Dashboard

```txt
GET /dashboard/summary
```

Returns bounded dashboard data for the current active user:

```json
{
  "counts": {
    "assigned": 3,
    "created": 4,
    "pool": 2,
    "done": 5,
    "urgent": 1
  },
  "assigned_recent": [],
  "created_recent": [],
  "pool_recent": [],
  "notifications_unread": 0
}
```

## Telegram

```txt
GET    /notifications/telegram/profile
POST   /notifications/telegram/link
DELETE /notifications/telegram/link
POST   /notifications/telegram/webhook
```

`GET /notifications/telegram/profile` — returns Telegram linking status for current user.

Response:

```json
{
  "linked": true,
  "username": "tguser",
  "linked_at": "2026-05-22T10:00:00Z"
}
```

`POST /notifications/telegram/link` — creates a one-time link token, returns Telegram deep link.

Response:

```json
{
  "url": "https://t.me/bot?start=token",
  "expires_at": "2026-05-22T10:10:00Z"
}
```

`DELETE /notifications/telegram/link` — unlinks Telegram from current user.

`POST /notifications/telegram/webhook` — receives Telegram webhook updates. Validates `X-Telegram-Bot-Api-Secret-Token` header when `TELEGRAM_WEBHOOK_SECRET` is configured. Handles `/start <code>` messages for account linking.

## Files

```txt
GET    /files?path=/
POST   /files/folders
POST   /files/upload
GET    /files/{file_id}
GET    /files/{file_id}/download
GET    /files/{file_id}/preview
PATCH  /files/{file_id}/rename
PATCH  /files/{file_id}/move
POST   /files/{file_id}/delete
POST   /files/{file_id}/restore
DELETE /files/{file_id}/purge
GET    /files/{file_id}/activity
GET    /files/search?q=
```

Active `fe`, `be`, and `lead` users can browse, search, create folders, upload, download, and preview. Only `lead` users can rename, move, delete, restore, and purge.

`GET /files?path=/` — list directory contents. Returns files and folders at the given path.

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "doc.pdf",
      "path": "/doc.pdf",
      "is_directory": false,
      "size_bytes": 1024,
      "content_type": "application/pdf",
      "extension": "pdf",
      "status": "active",
      "created_by": "uuid",
      "created_at": "2026-05-20T10:00:00Z"
    }
  ]
}
```

`POST /files/folders` — create a new folder.

Request:

```json
{
  "name": "reports",
  "parent_path": "/"
}
```

`POST /files/upload` — upload a file. Uses `multipart/form-data` with fields: `file`, `path`.

`GET /files/{file_id}/download` — returns a 302 redirect to a presigned MinIO download URL.

`GET /files/{file_id}/preview` — returns a 302 redirect to a presigned MinIO preview URL.

`PATCH /files/{file_id}/rename` — rename a file or folder. Lead-only.

Request:

```json
{
  "name": "new-name.pdf"
}
```

`PATCH /files/{file_id}/move` — move a file or folder to a new parent path. Lead-only.

Request:

```json
{
  "parent_path": "/archive"
}
```

`POST /files/{file_id}/delete` — soft-delete a file or folder. Deleted files are retained for 7 days. Lead-only.

`POST /files/{file_id}/restore` — restore a soft-deleted file or folder. Lead-only.

`DELETE /files/{file_id}/purge` — permanently delete a file and its MinIO object. Lead-only.

`GET /files/{file_id}/activity` — list activity logs for a file. Supports `limit` query param with default `50` and max `100`.

`GET /files/search?q=` — search files by name across the team.
