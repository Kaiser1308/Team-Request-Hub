# API_CONTRACT: Team Request Hub

## 1. Overview

Base URL local:

```txt
http://localhost:8000
```

Frontend gọi tất cả endpoint qua FastAPI backend.

Mọi protected request phải gửi Supabase JWT:

```http
Authorization: Bearer <supabase_access_token>
Content-Type: application/json
```

FastAPI chịu trách nhiệm:

```txt
- Verify JWT
- Load current user
- Check permission
- Validate status transition
- Write DB
- Create notification
- Create assignment history
- Create status log
```

Frontend không query Supabase DB trực tiếp.

---

## 2. Standard Error Response

Tất cả lỗi nên trả theo format:

```json
{
  "detail": "Error message"
}
```

Common status codes:

```txt
400 Bad Request       Invalid input / invalid transition
401 Unauthorized      Missing or invalid token
403 Forbidden         No permission
404 Not Found         Resource not found
409 Conflict          State conflict, e.g. request already assigned
422 Unprocessable     Validation error
500 Server Error      Unexpected backend error
```

---

## 3. Shared Types

### Role

```ts
type Role = "fe" | "be" | "lead"
```

### RequestStatus

```ts
type RequestStatus =
  | "pending"
  | "acknowledged"
  | "in_progress"
  | "done"
  | "cancelled"
```

### RequestPriority

```ts
type RequestPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent"
```

### NotificationType

```ts
type NotificationType =
  | "assigned"
  | "reassigned"
  | "status_changed"
  | "pool_new"
  | "replied"
  | "done"
  | "cancelled"
```

---

## 4. Data Models

### User

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Nguyen Van A",
  "avatar_url": "https://...",
  "role": "fe",
  "created_at": "2026-05-20T10:00:00Z"
}
```

### CurrentUser

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Nguyen Van A",
  "avatar_url": "https://...",
  "role": "fe"
}
```

### InternalRequest

```json
{
  "id": "uuid",
  "title": "Update login validation",
  "description": "Please update FE validation for login form.",
  "tags": ["frontend", "bug"],
  "priority": "medium",
  "status": "pending",
  "created_by": "uuid",
  "assigned_to": "uuid",
  "reference_links": ["https://clickup.com/task/..."],
  "reply": null,
  "acknowledged_at": null,
  "started_at": null,
  "done_at": null,
  "cancelled_at": null,
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T10:00:00Z"
}
```

### AssignmentHistory

```json
{
  "id": "uuid",
  "request_id": "uuid",
  "from_user_id": null,
  "to_user_id": "uuid",
  "assigned_by": "uuid",
  "reason": "Assigned on create",
  "created_at": "2026-05-20T10:00:00Z"
}
```

### RequestStatusLog

```json
{
  "id": "uuid",
  "request_id": "uuid",
  "from_status": "pending",
  "to_status": "acknowledged",
  "changed_by": "uuid",
  "reason": null,
  "created_at": "2026-05-20T10:00:00Z"
}
```

### Notification

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "request_id": "uuid",
  "type": "assigned",
  "message": "You were assigned a request: Update login validation",
  "is_read": false,
  "created_at": "2026-05-20T10:00:00Z"
}
```

---

# 5. Health API

## GET /health

Check backend health.

### Response 200

```json
{
  "status": "ok"
}
```

---

# 6. Auth / Users API

## GET /users/me

Get current authenticated user.

### Auth

Required.

### Response 200

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Nguyen Van A",
  "avatar_url": "https://...",
  "role": "fe"
}
```

### Errors

```txt
401 Invalid or expired token
403 User profile not found
```

---

## GET /users

List users for assign/reassign dropdown.

### Auth

Required.

### Response 200

```json
[
  {
    "id": "uuid",
    "email": "fe@example.com",
    "name": "FE User",
    "avatar_url": "https://...",
    "role": "fe",
    "created_at": "2026-05-20T10:00:00Z"
  },
  {
    "id": "uuid",
    "email": "be@example.com",
    "name": "BE User",
    "avatar_url": "https://...",
    "role": "be",
    "created_at": "2026-05-20T10:00:00Z"
  }
]
```

### Rules

```txt
- All authenticated users can list users.
- Backend may later filter inactive users.
```

---

## PATCH /users/{user_id}/role

Update a user's application role.

### Auth

Required.

### Permission

Lead only.

### Body

```json
{
  "role": "be"
}
```

Allowed roles:

```txt
fe
be
lead
```

### Backend Behavior

```txt
- Verify Supabase JWT
- Load current user from DB
- Require current user role = lead
- Validate target role
- Update public.users.role
```

### Response 200

```json
{
  "id": "uuid",
  "email": "be@example.com",
  "name": "BE User",
  "avatar_url": null,
  "role": "be",
  "created_at": "2026-05-20T10:00:00Z"
}
```

### Errors

```txt
401 Invalid or expired token
403 Only leads can update user roles
404 User not found
422 Invalid role
```

---

# 7. Requests API

## GET /requests

List requests by view.

### Auth

Required.

### Query Params

```txt
view=assigned | created | pool | done | all
```

Default:

```txt
assigned
```

### View Meaning

```txt
assigned  Requests assigned to current user
created   Requests created by current user
pool      Requests with assigned_to = null and status = pending
done      Done requests related to current user
all       All requests, lead only
```

### Request Example

```http
GET /requests?view=assigned
```

### Response 200

```json
[
  {
    "id": "uuid",
    "title": "Update login validation",
    "description": "Please update FE validation for login form.",
    "tags": ["frontend", "bug"],
    "priority": "medium",
    "status": "pending",
    "created_by": "uuid",
    "assigned_to": "uuid",
    "reference_links": [],
    "reply": null,
    "acknowledged_at": null,
    "started_at": null,
    "done_at": null,
    "cancelled_at": null,
    "created_at": "2026-05-20T10:00:00Z",
    "updated_at": "2026-05-20T10:00:00Z"
  }
]
```

### Errors

```txt
400 Invalid view
403 Lead only for view=all
```

---

## POST /requests

Create new request.

### Auth

Required.

### Body

```json
{
  "title": "Add avatarUrl to profile response",
  "description": "Please add avatarUrl to the user profile response. Reference link attached.",
  "tags": ["api", "backend"],
  "priority": "high",
  "assigned_to": "uuid-or-null",
  "reference_links": ["https://clickup.com/task/..."]
}
```

### Required

```txt
title
description
priority
```

### Optional

```txt
tags
assigned_to
reference_links
```

### Backend Behavior

```txt
- created_by = current_user.id
- status = pending
- validate assigned_to exists if provided
- insert internal_requests
- if assigned_to exists:
  - insert assignment_history
  - notify assignee
- if assigned_to is null:
  - request appears in pool
```

### Response 201

```json
{
  "id": "uuid",
  "title": "Add avatarUrl to profile response",
  "description": "Please add avatarUrl to the user profile response. Reference link attached.",
  "tags": ["api", "backend"],
  "priority": "high",
  "status": "pending",
  "created_by": "current-user-uuid",
  "assigned_to": "uuid-or-null",
  "reference_links": ["https://clickup.com/task/..."],
  "reply": null,
  "acknowledged_at": null,
  "started_at": null,
  "done_at": null,
  "cancelled_at": null,
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T10:00:00Z"
}
```

---

## GET /requests/{request_id}

Get request detail.

### Auth

Required.

### Permission

Allowed if:

```txt
- current user is lead
- current user is creator
- current user is assignee
- request is in pool
```

### Response 200

```json
{
  "id": "uuid",
  "title": "Add avatarUrl to profile response",
  "description": "Please add avatarUrl to the user profile response.",
  "tags": ["api", "backend"],
  "priority": "high",
  "status": "pending",
  "created_by": "uuid",
  "assigned_to": "uuid",
  "reference_links": [],
  "reply": null,
  "acknowledged_at": null,
  "started_at": null,
  "done_at": null,
  "cancelled_at": null,
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T10:00:00Z"
}
```

### Errors

```txt
403 Cannot view this request
404 Request not found
```

---

## PATCH /requests/{request_id}

Edit request content.

### Auth

Required.

### Permission

Allowed if:

```txt
- current user is creator
- current user is lead
```

### Not allowed if

```txt
status = done
status = cancelled
```

### Body

All fields optional.

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "tags": ["backend", "auth"],
  "priority": "urgent",
  "reference_links": ["https://docs.google.com/..."]
}
```

### Editable fields

```txt
title
description
tags
priority
reference_links
```

### Not editable here

```txt
status
assigned_to
created_by
reply
timestamps
```

Use action endpoints for assign/status/done/cancel.

### Response 200

```json
{
  "id": "uuid",
  "title": "Updated title",
  "description": "Updated description",
  "tags": ["backend", "auth"],
  "priority": "urgent",
  "status": "pending",
  "created_by": "uuid",
  "assigned_to": "uuid",
  "reference_links": ["https://docs.google.com/..."],
  "reply": null,
  "acknowledged_at": null,
  "started_at": null,
  "done_at": null,
  "cancelled_at": null,
  "created_at": "2026-05-20T10:00:00Z",
  "updated_at": "2026-05-20T11:00:00Z"
}
```

---

## POST /requests/{request_id}/self-assign

Self-assign request from pool.

### Auth

Required.

### Permission

All authenticated users.

### Conditions

```txt
assigned_to = null
status = pending
```

### Backend Behavior

```txt
- assigned_to = current_user.id
- status remains pending
- insert assignment_history
- notify creator
```

### Response 200

Returns updated `InternalRequest`.

### Errors

```txt
400 Request already assigned
400 Cannot assign closed request
404 Request not found
```

---

## POST /requests/{request_id}/reassign

Reassign request to another user.

### Auth

Required.

### Permission

Allowed if:

```txt
- current user is creator and request not done/cancelled
- current user is current assignee
- current user is lead
```

### Body

```json
{
  "assigned_to": "new-user-uuid",
  "reason": "This belongs to frontend validation."
}
```

### Required

```txt
assigned_to
```

### Reason Rule

Reason required if current status is:

```txt
acknowledged
in_progress
```

Reason optional if current status is:

```txt
pending
```

### Backend Behavior

If current status is `pending`:

```txt
status remains pending
```

If current status is `acknowledged` or `in_progress`:

```txt
status = pending
acknowledged_at = null
started_at = null
insert status log: old_status → pending
```

Always:

```txt
- update assigned_to
- validate new assignee exists
- insert assignment_history
- notify new assignee
- notify creator, unless creator is actor
```

### Response 200

Returns updated `InternalRequest`.

### Errors

```txt
400 Cannot reassign closed request
400 Reason is required
403 Cannot reassign this request
404 Request not found
```

---

## POST /requests/{request_id}/status

Update request status.

### Auth

Required.

### Permission

Allowed if:

```txt
- current user is current assignee
- current user is lead
```

### Body

```json
{
  "status": "acknowledged",
  "reason": null
}
```

### Allowed Transitions

```txt
pending → acknowledged
pending → cancelled

acknowledged → in_progress
acknowledged → cancelled

in_progress → acknowledged
in_progress → cancelled
```

Important:

```txt
Use /done endpoint for done.
Use /cancel endpoint for cancel in FE.
```

Although backend may accept cancelled here internally, FE should call `/cancel`.

### Backend Behavior

```txt
- validate transition
- update status
- set acknowledged_at if status = acknowledged
- set started_at if status = in_progress
- insert request_status_logs
- notify creator
```

### Response 200

Returns updated `InternalRequest`.

### Errors

```txt
400 Invalid status transition
400 Use /done endpoint
403 Only assignee or lead can update status
404 Request not found
```

---

## POST /requests/{request_id}/done

Mark request done.

### Auth

Required.

### Permission

Allowed if:

```txt
- current user is current assignee
- current user is lead
```

### Conditions

```txt
status = in_progress
```

### Body

```json
{
  "reply": "Done. Added avatarUrl to GET /users/me response. Swagger updated."
}
```

### Required

```txt
reply
```

Reply must not be empty.

### Backend Behavior

```txt
- status = done
- reply = payload.reply
- done_at = now
- insert request_status_logs
- notify creator
```

### Response 200

Returns updated `InternalRequest`.

### Errors

```txt
400 Reply is required
400 Request must be in_progress before done
403 Only assignee or lead can mark done
404 Request not found
```

---

## POST /requests/{request_id}/cancel

Cancel request.

### Auth

Required.

### Permission

Allowed if:

```txt
- current user is creator
- current user is lead
```

### Body

```json
{
  "reason": "No longer needed."
}
```

### Reason

Optional in MVP.

### Not allowed if

```txt
status = done
status = cancelled
```

### Backend Behavior

```txt
- status = cancelled
- cancelled_at = now
- insert request_status_logs
- notify assignee if exists
```

### Response 200

Returns updated `InternalRequest`.

### Errors

```txt
400 Request already closed
403 Cannot cancel this request
404 Request not found
```

---

# 8. Assignment History API

## GET /requests/{request_id}/assignment-history

Get assignment history for a request.

### Auth

Required.

### Permission

Same as request detail view.

### Response 200

```json
[
  {
    "id": "uuid",
    "request_id": "uuid",
    "from_user_id": null,
    "to_user_id": "uuid",
    "assigned_by": "uuid",
    "reason": "Assigned on create",
    "created_at": "2026-05-20T10:00:00Z"
  }
]
```

---

# 9. Status Logs API

## GET /requests/{request_id}/status-logs

Get status logs for a request.

### Auth

Required.

### Permission

Same as request detail view.

### Response 200

```json
[
  {
    "id": "uuid",
    "request_id": "uuid",
    "from_status": "pending",
    "to_status": "acknowledged",
    "changed_by": "uuid",
    "reason": null,
    "created_at": "2026-05-20T10:05:00Z"
  }
]
```

---

# 10. Notifications API

## GET /notifications

List notifications for current user.

### Auth

Required.

### Query Params

Optional:

```txt
unread_only=true | false
```

### Response 200

```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "request_id": "uuid",
    "type": "assigned",
    "message": "You were assigned a request: Add avatarUrl to profile response",
    "is_read": false,
    "created_at": "2026-05-20T10:00:00Z"
  }
]
```

---

## POST /notifications/{notification_id}/read

Mark one notification as read.

### Auth

Required.

### Permission

Only notification owner.

### Response 200

```json
{
  "id": "uuid",
  "user_id": "uuid",
  "request_id": "uuid",
  "type": "assigned",
  "message": "You were assigned a request: Add avatarUrl to profile response",
  "is_read": true,
  "created_at": "2026-05-20T10:00:00Z"
}
```

---

## POST /notifications/read-all

Mark all notifications as read.

### Auth

Required.

### Response 200

```json
{
  "updated": 5
}
```

---

# 11. FE View Mapping

## Assigned to me

```http
GET /requests?view=assigned
```

## Created by me

```http
GET /requests?view=created
```

## Pool

```http
GET /requests?view=pool
```

## Done

```http
GET /requests?view=done
```

## All requests

Lead only.

```http
GET /requests?view=all
```

---

# 12. FE Action Mapping

## Create request

```http
POST /requests
```

## Self-assign from pool

```http
POST /requests/{id}/self-assign
```

## Reassign

```http
POST /requests/{id}/reassign
```

## Acknowledge

```http
POST /requests/{id}/status
```

Body:

```json
{
  "status": "acknowledged"
}
```

## Start work

```http
POST /requests/{id}/status
```

Body:

```json
{
  "status": "in_progress"
}
```

## Mark done

```http
POST /requests/{id}/done
```

Body:

```json
{
  "reply": "Done..."
}
```

## Cancel

```http
POST /requests/{id}/cancel
```

Body:

```json
{
  "reason": "No longer needed"
}
```

---

# 13. MVP Endpoint Summary

```txt
Health:
GET    /health

Users:
GET    /users/me
GET    /users
PATCH  /users/{user_id}/role

Requests:
GET    /requests
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

Notifications:
GET    /notifications
POST   /notifications/{notification_id}/read
POST   /notifications/read-all
```

---

# 14. Out of Scope for MVP API

```txt
- Comments API
- File upload API
- Catalog API
- ClickUp sync API
- Slack/Discord/Telegram webhook API
- Analytics API
- Due date / SLA API
- Reopen request API
- Multi-tenant API
```
