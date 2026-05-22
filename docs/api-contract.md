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

## Notifications

```txt
GET  /notifications?unread_only=false
POST /notifications/{notification_id}/read
POST /notifications/read-all
```

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
