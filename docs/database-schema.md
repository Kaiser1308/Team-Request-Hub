# Database Schema

The executable schema lives in `DB_SCHEMA_TEAM_REQUEST_HUB.sql` and targets Supabase PostgreSQL.

## Tables

- `public.users`: application profile for `auth.users`, including `role`, `is_active`, profile metadata, and optional Telegram linking fields.
- `public.internal_requests`: core request records with title, description, tags, priority, status, creator, assignee, reply, and lifecycle timestamps.
- `public.assignment_history`: audit trail for create-with-assignee, self-assign, and reassign events.
- `public.request_status_logs`: audit trail for status changes, done, and cancel events.
- `public.notifications`: user-facing notification records tied to request workflow events.
- `public.telegram_link_tokens`: one-time tokens for linking a user's Telegram account via deep link.
- `public.notification_deliveries`: per-channel delivery tracking for notifications (e.g. Telegram).

## Enums

- `user_role`: `fe`, `be`, `lead`.
- `request_status`: `pending`, `acknowledged`, `in_progress`, `done`, `cancelled`.
- `request_priority`: `low`, `medium`, `high`, `urgent`.
- `notification_type`: `assigned`, `reassigned`, `status_changed`, `pool_new`, `replied`, `done`, `cancelled`.
- `notification_channel`: `telegram`.
- `notification_delivery_status`: `pending`, `sent`, `failed`.

## Auth Profile Trigger

`public.handle_new_auth_user()` creates a matching `public.users` profile after Supabase Auth signup. New users default to role `fe` and `is_active = false`; a lead must approve the user before they can use request workflow endpoints.

## Row Level Security

RLS is enabled on all application tables as defense-in-depth. The frontend does not query application tables directly; FastAPI uses the service-role key server-side. Direct authenticated policies are intentionally narrow for reading a user's own profile and notifications, plus updating that user's notification read state.

## Applying Locally

Apply `DB_SCHEMA_TEAM_REQUEST_HUB.sql` in the Supabase SQL editor for the target project, then verify through the backend service client.
