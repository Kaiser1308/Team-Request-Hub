# Multi-Assignee Request Workflow Design

Date: 2026-05-28

## Goal

Support assigning one request to multiple active users while keeping the request workflow simple: each request has one shared status, and the audit logs record who performed each action. Also standardize unread notification counts as red badges across the app.

## Current Context

The current workflow stores a single assignee on `internal_requests.assigned_to`. Backend permissions, request list queries, dashboard counts, request actions, assignment history, and frontend rendering all assume one assignee. Notification records and status logs already exist, and `request_status_logs.changed_by` records the actor for status changes.

The backend remains the source of truth for business rules. Frontend Supabase usage remains limited to auth/session handling.

## Decisions

- Use a normalized join table, `request_assignees`, as the new source of truth.
- Keep one shared request status on `internal_requests.status`.
- Use existing status logs to record which assignee performed each status action.
- Let request creation choose zero, one, or many assignees.
- Keep Pool behavior: a pending request with zero assignees is in the Pool.
- Manage assignees through add/remove operations, not whole-list replacement.
- Allow creator, lead, or current assignee to add/remove assignees.
- Do not notify a removed assignee; only write assignment history/audit.
- Use a consistent red badge treatment anywhere unread notification counts appear.

## Data Model

Add `public.request_assignees`:

```sql
request_id uuid not null references public.internal_requests(id) on delete cascade
user_id uuid not null references public.users(id) on delete restrict
assigned_by uuid not null references public.users(id) on delete restrict
assigned_at timestamptz not null default now()
primary key (request_id, user_id)
```

Indexes:

- `(request_id)` for detail enrichment.
- `(user_id, assigned_at desc)` for Assigned to me and dashboard queries.
- Primary key `(request_id, user_id)` to prevent duplicate assignment.

Migration:

- Backfill from existing `internal_requests.assigned_to` into `request_assignees`.
- Existing requests with `assigned_to is null` remain Pool requests.
- Keep `internal_requests.assigned_to` during the migration window, but new service logic reads assignments from `request_assignees`.
- Frontend moves to `assignees[]`; compatibility fields `assigned_to` and `assignee` may remain in responses during transition but should not drive new UI.

## API Contract

Request create payload changes from single assignee to a list:

```json
{
  "title": "...",
  "description": "...",
  "priority": "medium",
  "tags": [],
  "reference_links": [],
  "assignee_ids": ["uuid-1", "uuid-2"]
}
```

`assignee_ids` is optional. Empty or omitted means the request stays in Pool.

Request responses add:

```json
{
  "assignees": [
    {"id": "uuid", "email": "user@example.com", "name": "User", "avatar_url": null}
  ]
}
```

Add assignee endpoint:

```txt
POST /requests/{request_id}/assignees
```

Payload:

```json
{
  "user_id": "uuid",
  "reason": "optional reason"
}
```

Remove assignee endpoint:

```txt
DELETE /requests/{request_id}/assignees/{user_id}
```

Payload for active requests:

```json
{
  "reason": "handoff reason"
}
```

## Workflow Rules

Create request:

- If `assignee_ids` is empty, create a pending Pool request.
- If assignees are provided, validate all users are active.
- Create one `request_assignees` row per assignee.
- Create assignment history entries for each assignee.
- Send assignment notifications to each selected assignee.

Request visibility:

- Lead can see all requests.
- Creator can see requests they created.
- Current assignees can see and act on assigned requests.
- Active users can see Pool requests only when the request has zero assignees and status is `pending`.

Status actions:

- Request status remains shared.
- Any current assignee or lead can acknowledge, start, and mark done.
- Existing `request_status_logs.changed_by` records who performed the action.
- Creator receives existing status/done notifications unless they performed the action.
- Other assignees do not receive status notifications by default.

Add assignee:

- Creator, lead, or current assignee can add an active user.
- Reject duplicate assignees.
- Reject closed requests.
- Create assignment history.
- Notify the newly added user.

Remove assignee:

- Creator, lead, or current assignee can remove a current assignee.
- Reject removing a user who is not assigned.
- Reject closed requests.
- Treat `acknowledged` and `in_progress` as active request states.
- Reject removing the last assignee from an active request.
- Allow removing the last assignee only while request status is `pending`, which returns the request to Pool.
- Require a reason when removing an assignee from an active request.
- Create assignment history/audit only; do not notify the removed user.

Active handoff:

- Reassignment is modeled as add new assignee, then remove old assignee.
- The removal reason captures the handoff context in assignment history.

## Frontend Design

Request create form:

- Replace the single assignee select with multi-select/list selection using active users.
- Empty selection means Leave in Pool.
- Submit `assignee_ids`.

Request cards, list, and detail:

- Render `assignees[]` as compact chips, avatars, or names.
- Pool requests display Unassigned / Pool.
- Replace single-assignee text with plural rendering.

Request actions:

- Permission checks use current user membership in `assignees[]` instead of `request.assigned_to`.
- Shared status buttons keep the current workflow semantics.
- Request detail gets Add assignee and Remove assignee controls for creator, lead, or current assignee.
- Removing an assignee from an active request requires a reason input.

Views:

- Assigned to me lists requests where the current user appears in `request_assignees`.
- Pool lists pending requests with zero assignees.
- Done and All views continue to follow current role rules, using assignee membership for non-lead visibility.

Notification badges:

- Create a shared red unread-count badge treatment.
- Top bar notification button uses a red count badge instead of a neutral number.
- Sidebar badges stay red.
- Dashboard unread notification summary uses the same red badge treatment.

## Backend Boundaries

Routes stay thin and delegate workflow rules to services.

Services own:

- Assignment validation.
- Permission checks.
- Shared status transitions.
- Assignment history writes.
- Notification side effects.

Repositories own:

- `request_assignees` CRUD.
- Request list queries by assignee membership.
- Pool queries by absence of assignees.
- Bulk loading user summaries for `assignees[]` enrichment.

## Error Handling

Backend rejects:

- Invalid assignee IDs.
- Inactive assignee IDs.
- Duplicate assignee adds.
- Add/remove attempts on closed requests.
- Removing a non-assignee.
- Removing the last assignee from an active request.
- Missing reason when removing from an active request.
- Status updates by a user who is neither lead nor current assignee.

Migration must preserve existing request visibility and Pool behavior.

## Testing

Backend tests:

- Create request with zero assignees.
- Create request with one assignee.
- Create request with many assignees.
- Assigned view returns requests where current user is one assignee.
- Pool view returns only pending requests with zero assignees.
- Creator, lead, and current assignee can add/remove assignees.
- Duplicate add is rejected.
- Removing last active assignee is rejected for `acknowledged` and `in_progress` requests.
- Removing from active request requires a reason.
- Any current assignee can update shared status.
- Status log `changed_by` records the acting assignee.

Frontend verification:

- Request create form submits selected `assignee_ids`.
- Request list/detail render multiple assignees.
- Status action visibility uses `assignees[]` membership.
- Add/remove assignee controls show only for allowed users.
- Notification count displays as red badges in top bar, sidebar, and dashboard summary.
- Run `npm run lint` and `npm run build` from `apps/web` after implementation.

Docs to update during implementation:

- `docs/api-contract.md`
- `docs/database-schema.md`
- `docs/permissions.md`

## Out Of Scope

- Per-assignee status tracking.
- Notifying removed assignees.
- Replacing all assignees in one operation.
- Removing `internal_requests.assigned_to` immediately.
- Frontend direct database queries.
