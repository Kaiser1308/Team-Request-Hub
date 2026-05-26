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
GET    /files/search?q=logo
POST   /files/folders
POST   /files/upload-url
POST   /files/{file_id}/complete-upload
POST   /files/{file_id}/download-url
POST   /files/{file_id}/preview-url
GET    /files/{file_id}/preview-content
PATCH  /files/{file_id}/rename
PATCH  /files/{file_id}/move
POST   /files/batch-copy
POST   /files/batch-move
POST   /files/{file_id}/delete
POST   /files/{file_id}/restore
POST   /files/purge-expired
GET    /files/activity?file_id=...
```

All active users can browse, search, create folders, upload, download, and preview supported files (images, PDF). Only `lead` users can rename, move, copy, delete, restore, and purge files or folders. Deleted files are retained for 7 days in trash before permanent purge.

Uploads use two-step presigned URL flow: request an upload URL, then PUT the file directly to MinIO, then complete the upload. Max file size is 200MB.

`GET /files?path=/` — list children of a folder.

Response:

```json
[
  {
    "id": "uuid",
    "name": "Design",
    "path": "/Design",
    "parent_path": "/",
    "is_directory": true,
    "size_bytes": 0,
    "content_type": null,
    "extension": null,
    "status": "active",
    "created_by": "uuid",
    "created_at": "2026-05-25T10:00:00Z",
    "updated_at": "2026-05-25T10:00:00Z"
  }
]
```

`GET /files/search?q=logo` — search files by name across all folders.

`POST /files/folders` — create a new folder.

Request:

```json
{
  "parent_path": "/",
  "name": "Design"
}
```

`POST /files/upload-url` — request a presigned upload URL.

Request:

```json
{
  "parent_path": "/",
  "name": "logo.png",
  "size_bytes": 2048,
  "content_type": "image/png"
}
```

Response:

```json
{
  "file": { "id": "uuid", "name": "logo.png", "status": "pending_upload", "..." : "..." },
  "upload_url": "https://minio/bucket/object?signature=...",
  "method": "PUT",
  "expires_in_seconds": 300
}
```

`POST /files/{file_id}/complete-upload` — confirm upload completed. Request: `{ "size_bytes": 2048 }`.

`POST /files/{file_id}/download-url` — get a presigned download URL.

Response:

```json
{
  "url": "https://minio/bucket/object?signature=...",
  "expires_in_seconds": 300
}
```

`POST /files/{file_id}/preview-url` — get a presigned preview URL. Supported for images (png, jpg, jpeg, gif, webp), PDF, Markdown (md, markdown), and HTML (html, htm).

`GET /files/{file_id}/preview-content` — get authenticated inline text content for Markdown/HTML preview rendering in-app. Supported only for `md`, `markdown`, `html`, `htm`.

`PATCH /files/{file_id}/rename` — rename a file or folder. Lead-only.

Request:

```json
{ "name": "new-name.pdf" }
```

`PATCH /files/{file_id}/move` — move a single file/folder to a new parent. Lead-only.

Request:

```json
{ "parent_path": "/Archive" }
```

`POST /files/batch-copy` — copy multiple files/folders to a destination. Lead-only.

Request:

```json
{
  "file_ids": ["uuid1", "uuid2"],
  "parent_path": "/Archive"
}
```

`POST /files/batch-move` — move multiple files/folders to a destination. Lead-only.

Request:

```json
{
  "file_ids": ["uuid1", "uuid2"],
  "parent_path": "/Archive"
}
```

`POST /files/{file_id}/delete` — soft-delete. File goes to trash, retained 7 days. Lead-only.

`POST /files/{file_id}/restore` — restore from trash. Lead-only.

`POST /files/purge-expired` — permanently delete all expired trash items from MinIO and DB. Lead-only.

Response:

```json
{ "purged": 3 }
```

`GET /files/activity?file_id=uuid` — list audit logs. Supports `limit` (default 50, max 100).
