-- DB_SCHEMA: Team Request Hub
-- Target: Supabase PostgreSQL
-- Scope: MVP internal request workflow tool

-- =========================================================
-- 0. Extensions
-- =========================================================

create extension if not exists "pgcrypto";
create extension if not exists pg_trgm schema extensions;

-- =========================================================
-- 1. Enums
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('fe', 'be', 'lead');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_status') then
    create type request_status as enum (
      'pending',
      'acknowledged',
      'in_progress',
      'done',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_priority') then
    create type request_priority as enum (
      'low',
      'medium',
      'high',
      'urgent'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum (
      'assigned',
      'reassigned',
      'status_changed',
      'pool_new',
      'replied',
      'done',
      'cancelled'
    );
  end if;
end $$;

-- =========================================================
-- 2. Users profile table
-- =========================================================
-- Supabase Auth users live in auth.users.
-- public.users stores app profile + role.
-- users.id should match auth.users.id.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  avatar_url text,
  role user_role not null default 'fe',
  is_active boolean not null default false,
  preferred_language text not null default 'vi',
  telegram_chat_id text,
  telegram_username text,
  telegram_linked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists preferred_language text not null default 'vi';

alter table public.users
  add column if not exists telegram_chat_id text,
  add column if not exists telegram_username text,
  add column if not exists telegram_linked_at timestamptz;

create unique index if not exists idx_users_telegram_chat_id
  on public.users(telegram_chat_id)
  where telegram_chat_id is not null;

create index if not exists idx_users_role on public.users(role);
create index if not exists idx_users_is_active on public.users(is_active);

-- =========================================================
-- 3. Internal Requests
-- =========================================================

create table if not exists public.internal_requests (
  id uuid primary key default gen_random_uuid(),

  title text not null check (char_length(trim(title)) > 0),
  description text not null check (char_length(trim(description)) > 0),

  tags text[] not null default '{}',
  priority request_priority not null default 'medium',
  status request_status not null default 'pending',

  created_by uuid not null references public.users(id) on delete restrict,
  assigned_to uuid references public.users(id) on delete set null,

  reference_links text[] not null default '{}',
  reply text,

  acknowledged_at timestamptz,
  started_at timestamptz,
  done_at timestamptz,
  cancelled_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint internal_requests_done_requires_reply
    check (
      status <> 'done'
      or reply is not null and char_length(trim(reply)) > 0
    ),

  constraint internal_requests_done_requires_done_at
    check (
      status <> 'done'
      or done_at is not null
    ),

  constraint internal_requests_cancelled_requires_cancelled_at
    check (
      status <> 'cancelled'
      or cancelled_at is not null
    )
);

create index if not exists idx_internal_requests_created_by
  on public.internal_requests(created_by);

create index if not exists idx_internal_requests_assigned_to
  on public.internal_requests(assigned_to);

create index if not exists idx_internal_requests_status
  on public.internal_requests(status);

create index if not exists idx_internal_requests_priority
  on public.internal_requests(priority);

create index if not exists idx_internal_requests_created_at
  on public.internal_requests(created_at desc);

create index if not exists idx_internal_requests_assigned_to_created_at
  on public.internal_requests(assigned_to, created_at desc)
  where assigned_to is not null;

create index if not exists idx_internal_requests_created_by_created_at
  on public.internal_requests(created_by, created_at desc);

create index if not exists idx_internal_requests_status_created_at
  on public.internal_requests(status, created_at desc);

create index if not exists idx_internal_requests_done_created_at
  on public.internal_requests(created_at desc)
  where status = 'done';

create index if not exists idx_internal_requests_tags
  on public.internal_requests using gin(tags);

-- Fast pool query
create index if not exists idx_internal_requests_pool
  on public.internal_requests(created_at desc)
  where assigned_to is null and status = 'pending';

-- =========================================================
-- 4. Assignment History
-- =========================================================

create table if not exists public.assignment_history (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null references public.internal_requests(id) on delete cascade,
  from_user_id uuid references public.users(id) on delete set null,
  to_user_id uuid not null references public.users(id) on delete restrict,
  assigned_by uuid not null references public.users(id) on delete restrict,

  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_assignment_history_request_id
  on public.assignment_history(request_id, created_at desc);

create index if not exists idx_assignment_history_to_user_id
  on public.assignment_history(to_user_id);

create index if not exists idx_assignment_history_from_user_id
  on public.assignment_history(from_user_id);

create index if not exists idx_assignment_history_assigned_by
  on public.assignment_history(assigned_by);

-- =========================================================
-- 4b. Current Request Assignees
-- =========================================================

create table if not exists public.request_assignees (
  request_id uuid not null references public.internal_requests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete restrict,
  assigned_by uuid not null references public.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create index if not exists idx_request_assignees_request_id
  on public.request_assignees(request_id);

create index if not exists idx_request_assignees_request_assigned_at
  on public.request_assignees(request_id, assigned_at);

create index if not exists idx_request_assignees_user_assigned_at
  on public.request_assignees(user_id, assigned_at desc);

insert into public.request_assignees (request_id, user_id, assigned_by, assigned_at)
select id, assigned_to, created_by, created_at
from public.internal_requests
where assigned_to is not null
on conflict (request_id, user_id) do nothing;

-- =========================================================
-- 5. Request Status Logs
-- =========================================================

create table if not exists public.request_status_logs (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null references public.internal_requests(id) on delete cascade,
  from_status request_status,
  to_status request_status not null,
  changed_by uuid not null references public.users(id) on delete restrict,

  reason text,
  created_at timestamptz not null default now()
);

create index if not exists idx_request_status_logs_request_id
  on public.request_status_logs(request_id, created_at desc);

create index if not exists idx_request_status_logs_changed_by
  on public.request_status_logs(changed_by);

create index if not exists idx_request_status_logs_created_at
  on public.request_status_logs(created_at desc);

-- =========================================================
-- 6. Notifications
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references public.users(id) on delete cascade,
  request_id uuid references public.internal_requests(id) on delete cascade,

  type notification_type not null,
  message text not null check (char_length(trim(message)) > 0),
  is_read boolean not null default false,

  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_id
  on public.notifications(user_id);

create index if not exists idx_notifications_user_created_at
  on public.notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where is_read = false;

create index if not exists idx_notifications_user_read_created_at
  on public.notifications(user_id, is_read, created_at desc);

create index if not exists idx_notifications_request_id
  on public.notifications(request_id);

create index if not exists idx_notifications_created_at
  on public.notifications(created_at desc);

-- =========================================================
-- 7. Telegram Link Tokens
-- =========================================================

create table if not exists public.telegram_link_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_telegram_link_tokens_user_id
  on public.telegram_link_tokens(user_id);

create index if not exists idx_telegram_link_tokens_token
  on public.telegram_link_tokens(token);

-- =========================================================
-- 9. Notification Delivery Tracking
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_channel') then
    create type notification_channel as enum ('telegram', 'email', 'web_push');
  end if;
end $$;

do $$
begin
  alter type notification_channel add value if not exists 'email';
  alter type notification_channel add value if not exists 'web_push';
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_delivery_status') then
    create type notification_delivery_status as enum ('pending', 'sent', 'failed');
  end if;
end $$;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  channel notification_channel not null,
  status notification_delivery_status not null default 'pending',
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists idx_notification_deliveries_notification_id
  on public.notification_deliveries(notification_id);

create index if not exists idx_notification_deliveries_user_channel
  on public.notification_deliveries(user_id, channel);

create index if not exists idx_notification_deliveries_status
  on public.notification_deliveries(status);

create index if not exists idx_notification_deliveries_pending_created_at
  on public.notification_deliveries(created_at)
  where status = 'pending';

-- =========================================================
-- 9b. Notification Preferences
-- =========================================================

create table if not exists public.notification_preferences (
  user_id uuid not null references public.users(id) on delete cascade,
  channel notification_channel not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, channel)
);

-- =========================================================
-- 9c. Web Push Subscriptions
-- =========================================================

create table if not exists public.web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists idx_web_push_subscriptions_user_active
  on public.web_push_subscriptions(user_id, revoked_at);

-- =========================================================
-- 10. Request Attachments
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_attachment_context') then
    create type request_attachment_context as enum ('request', 'done_reply');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'request_attachment_status') then
    create type request_attachment_status as enum ('pending_upload', 'active', 'deleted');
  end if;
end $$;

create table if not exists public.request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.internal_requests(id) on delete cascade,
  context request_attachment_context not null,
  status request_attachment_status not null default 'pending_upload',
  name text not null check (char_length(trim(name)) > 0),
  object_key text not null unique,
  content_type text not null check (char_length(trim(content_type)) > 0),
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_request_attachments_request_context_created_at
  on public.request_attachments(request_id, context, created_at)
  where status = 'active';

create index if not exists idx_request_attachments_uploaded_by_created_at
  on public.request_attachments(uploaded_by, created_at desc);

create index if not exists idx_request_attachments_cleanup
  on public.request_attachments(created_at)
  where request_id is null and status in ('pending_upload', 'active');

-- =========================================================
-- 11. Team Files
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_file_status') then
    create type team_file_status as enum (
      'pending_upload',
      'active',
      'deleted',
      'purged'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_file_action') then
    create type team_file_action as enum (
      'create_folder',
      'upload',
      'complete_upload',
      'rename',
      'move',
      'delete',
      'restore',
      'purge',
      'download',
      'preview'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_file_target_type') then
    create type team_file_target_type as enum (
      'file',
      'folder'
    );
  end if;
end $$;

create table if not exists public.team_files (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  path text not null unique check (char_length(trim(path)) > 0),
  parent_path text not null default '/',
  is_directory boolean not null default false,
  object_key text,
  size_bytes bigint not null default 0,
  content_type text,
  extension text,
  status team_file_status not null default 'active',
  uploaded_by uuid references public.users(id) on delete set null,
  created_by uuid not null references public.users(id) on delete restrict,
  updated_by uuid references public.users(id) on delete set null,
  deleted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  purge_after timestamptz
);

create index if not exists idx_team_files_parent_status_name
  on public.team_files(parent_path, status, name);

create index if not exists idx_team_files_status_purge_after
  on public.team_files(status, purge_after);

create index if not exists idx_team_files_created_by
  on public.team_files(created_by);

create index if not exists idx_team_files_uploaded_by
  on public.team_files(uploaded_by);

create index if not exists idx_team_files_updated_by
  on public.team_files(updated_by);

create index if not exists idx_team_files_deleted_by
  on public.team_files(deleted_by);

create index if not exists idx_team_files_name_trgm
  on public.team_files using gin(name extensions.gin_trgm_ops);

create table if not exists public.file_activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.users(id) on delete restrict,
  file_id uuid references public.team_files(id) on delete set null,
  action team_file_action not null,
  target_type team_file_target_type not null,
  old_path text,
  new_path text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_file_activity_logs_file_created_at
  on public.file_activity_logs(file_id, created_at desc);

create index if not exists idx_file_activity_logs_actor_created_at
  on public.file_activity_logs(actor_id, created_at desc);

-- =========================================================
-- 12. Updated_at Trigger
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists trg_internal_requests_set_updated_at on public.internal_requests;
create trigger trg_internal_requests_set_updated_at
before update on public.internal_requests
for each row
execute function public.set_updated_at();

drop trigger if exists trg_team_files_set_updated_at on public.team_files;
create trigger trg_team_files_set_updated_at
before update on public.team_files
for each row
execute function public.set_updated_at();

drop trigger if exists trg_notification_preferences_set_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_set_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();

drop trigger if exists trg_request_attachments_set_updated_at on public.request_attachments;
create trigger trg_request_attachments_set_updated_at
before update on public.request_attachments
for each row
execute function public.set_updated_at();

-- =========================================================
-- 13. Auto-create user profile after Supabase Auth signup
-- =========================================================
-- New signups start inactive. A lead must approve the profile by setting is_active = true.
-- This creates a default profile with role = fe.
-- Lead/admin can update role later from Supabase dashboard or backend admin tool.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'fe',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;
grant execute on function public.handle_new_auth_user() to postgres, service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- =========================================================
-- 14. Row Level Security
-- =========================================================
-- Architecture rule:
-- FE must NOT query DB directly.
-- FastAPI uses service role key server-side.
--
-- RLS is enabled as defense-in-depth.
-- Direct authenticated client queries are not granted broad access.

alter table public.users enable row level security;
alter table public.internal_requests enable row level security;
alter table public.assignment_history enable row level security;
alter table public.request_assignees enable row level security;
alter table public.request_status_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.telegram_link_tokens enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.web_push_subscriptions enable row level security;
alter table public.request_attachments enable row level security;
alter table public.team_files enable row level security;
alter table public.file_activity_logs enable row level security;

-- Users can read their own profile if direct client access is ever used.
drop policy if exists "users can read own profile" on public.users;
create policy "users can read own profile"
on public.users
for select
to authenticated
using ((select auth.uid()) = id);

-- Users can read their own notifications if direct client access is ever used for realtime/display.
drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read own notifications"
on public.notifications
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users can update own notification read state" on public.notifications;
create policy "users can update own notification read state"
on public.notifications
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- No insert/update/delete policies for internal_requests from FE.
-- Backend service role bypasses RLS.
-- Keep business logic in FastAPI.

-- Users can view their own notification preferences.
drop policy if exists "Users can view their own notification preferences" on public.notification_preferences;
create policy "Users can view their own notification preferences"
  on public.notification_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own notification preferences" on public.notification_preferences;
create policy "Users can insert their own notification preferences"
  on public.notification_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own notification preferences" on public.notification_preferences;
create policy "Users can update their own notification preferences"
  on public.notification_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Users can manage their own web push subscriptions.
drop policy if exists "Users can view their own web push subscriptions" on public.web_push_subscriptions;
create policy "Users can view their own web push subscriptions"
  on public.web_push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own web push subscriptions" on public.web_push_subscriptions;
create policy "Users can insert their own web push subscriptions"
  on public.web_push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own web push subscriptions" on public.web_push_subscriptions;
create policy "Users can update their own web push subscriptions"
  on public.web_push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- =========================================================
-- 15. Realtime
-- =========================================================
-- In Supabase dashboard, enable Realtime for:
-- - notifications
-- - internal_requests
--
-- Or run:
-- alter publication supabase_realtime add table public.notifications;
-- alter publication supabase_realtime add table public.internal_requests;
--
-- Note: If publication already contains the table, the command may error.
-- Use dashboard toggle if unsure.

-- =========================================================
-- 16. Seed examples
-- =========================================================
-- Do not run this blindly in production.
-- Replace UUIDs with real auth.users IDs after login.

-- update public.users
-- set role = 'lead'
-- where email = 'lead@example.com';

-- update public.users
-- set role = 'be'
-- where email = 'backend@example.com';

-- update public.users
-- set role = 'fe'
-- where email = 'frontend@example.com';

-- =========================================================
-- 17. MVP Tables Summary
-- =========================================================
-- public.users
-- public.internal_requests
-- public.assignment_history
-- public.request_status_logs
-- public.notifications
-- public.telegram_link_tokens
-- public.notification_deliveries
-- public.notification_preferences
-- public.web_push_subscriptions
-- public.request_attachments
-- public.team_files
-- public.file_activity_logs
