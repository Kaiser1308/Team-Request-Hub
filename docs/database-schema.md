# Database Schema

The executable schema lives in `DB_SCHEMA_TEAM_REQUEST_HUB.sql` and targets Supabase PostgreSQL.

## Tables

- `public.users`: application profile for `auth.users`, including `role`, `is_active`, `preferred_language`, profile metadata, and optional Telegram linking fields (`telegram_chat_id`, `telegram_username`, `telegram_linked_at`).
- `public.internal_requests`: core request records with title, description, tags, priority, status, creator, assignee, reply, and lifecycle timestamps.
- `public.request_assignees`: current many-to-many request assignment membership with `request_id`, `user_id`, `assigned_by`, and `assigned_at`. This is the source of truth for current assignees.
- `public.assignment_history`: audit trail for create-with-assignee, self-assign, and reassign events.
- `public.request_status_logs`: audit trail for status changes, done, and cancel events.
- `public.notifications`: user-facing notification records tied to request workflow events.
- `public.telegram_link_tokens`: one-time tokens for linking a user's Telegram account via deep link.
- `public.notification_deliveries`: per-channel delivery tracking for notifications (e.g. Telegram).
- `public.notification_preferences`: per-user opt-in/out settings for external notification channels.
- `public.web_push_subscriptions`: per-device browser Push API subscription records for Web Push delivery.
- `public.request_attachments`: MinIO-backed files attached while creating requests or submitting done replies, with pending upload state and request/done-reply context.
- `public.request_attachment_activity_logs`: audit trail for request attachment management (add/remove actions), with `action` check constraint (`add` | `remove`), `name` snapshot, and `created_at`.
- `public.team_files`: team file explorer records with directory hierarchy, unique `path`, MinIO object references, soft-delete, and purge scheduling.
- `public.file_activity_logs`: audit trail for file operations including upload, rename, move, delete, restore, purge, and hard delete events.

## Performance Indexes

Request list and queue views use composite and partial indexes on `internal_requests` so filter + sort patterns by assignee, creator, status, and recent done requests stay fast. Request assignment and dashboard views use indexes on `request_assignees(user_id, assigned_at desc)` and `request_assignees(request_id, assigned_at)` so multi-assignee request lists can use `request_assignees` as the source of truth. Notification processing uses a partial index on pending `notification_deliveries` and a user/read/recent index on `notifications` to speed unread dashboard access. Audit history tables keep `created_at desc` indexes so recent assignment and status activity can be retrieved efficiently. Team file path operations rely on the `team_files.path` uniqueness constraint plus parent/status/name indexes for browse and search.

Pool, done, and dashboard request reads use SQL functions:

- `public.list_pool_requests(result_limit)` resolves unassigned pending work with `not exists` against `request_assignees`.
- `public.list_done_requests(result_limit, current_user_id)` scopes non-lead done views by creator or current assignment membership.
- `public.get_dashboard_data(current_user_id, result_limit)` collects created requests, assigned requests, and unassigned pending pool work in one database round-trip.

These functions avoid loading all assignment rows into the FastAPI process and keep membership checks inside Postgres.

Key composite indexes:
- `request_assignees(user_id, assigned_at desc)` — assigned-request list view
- `request_assignees(request_id, assigned_at)` — per-request assignee lookups
- `request_assignees(assigned_by)` — covers the assignment creator foreign key for FK maintenance and advisor compliance
- `internal_requests(status, created_at desc)` — done/pool status filter + sort
- `internal_requests(created_by, created_at desc)` — created-request list view
- `notifications(user_id, is_read, created_at desc)` — read/unread notification list queries

## Enums

- `user_role`: `fe`, `be`, `lead`.
- `request_status`: `pending`, `acknowledged`, `in_progress`, `done`, `cancelled`.
- `request_priority`: `low`, `medium`, `high`, `urgent`.
- `notification_type`: `assigned`, `reassigned`, `status_changed`, `pool_new`, `replied`, `done`, `cancelled`.
- `notification_channel`: `telegram`, `email`, `web_push`.
- `notification_delivery_status`: `pending`, `sent`, `failed`.
- `request_attachment_context`: `request`, `done_reply`.
- `request_attachment_status`: `pending_upload`, `active`, `deleted`.
- `team_file_status`: `pending_upload`, `active`, `deleted`, `purged`.
- `team_file_action`: `create_folder`, `upload`, `complete_upload`, `rename`, `move`, `delete`, `restore`, `purge`, `hard_delete`, `download`, `preview`.
- `team_file_target_type`: `file`, `folder`.

## Auth Profile Trigger

`public.handle_new_auth_user()` creates a matching `public.users` profile after Supabase Auth signup. New users default to role `fe` and `is_active = false`; a lead must approve the user before they can use request workflow endpoints.

## Row Level Security

RLS is enabled on all application tables as defense-in-depth. The frontend does not query application tables directly; FastAPI uses the service-role key server-side. Direct authenticated policies are intentionally narrow for reading a user's own profile and notifications, plus updating that user's notification read state.

## Applying Locally

Apply `DB_SCHEMA_TEAM_REQUEST_HUB.sql` in the Supabase SQL editor for the target project, then verify through the backend service client.
