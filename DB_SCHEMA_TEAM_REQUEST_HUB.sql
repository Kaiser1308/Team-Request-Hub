-- DB_SCHEMA: Team Request Hub
-- Target: Supabase PostgreSQL
-- Scope: MVP internal request workflow tool

-- =========================================================
-- 0. Extensions
-- =========================================================

create extension if not exists "pgcrypto";

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  on public.assignment_history(request_id);

create index if not exists idx_assignment_history_to_user_id
  on public.assignment_history(to_user_id);

create index if not exists idx_assignment_history_assigned_by
  on public.assignment_history(assigned_by);

create index if not exists idx_assignment_history_created_at
  on public.assignment_history(created_at desc);

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
  on public.request_status_logs(request_id);

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

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, created_at desc)
  where is_read = false;

create index if not exists idx_notifications_request_id
  on public.notifications(request_id);

create index if not exists idx_notifications_created_at
  on public.notifications(created_at desc);

-- =========================================================
-- 7. Updated_at Trigger
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
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

-- =========================================================
-- 8. Auto-create user profile after Supabase Auth signup
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
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name'),
    new.raw_user_meta_data->>'avatar_url',
    'fe',
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

-- =========================================================
-- 9. Row Level Security
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
alter table public.request_status_logs enable row level security;
alter table public.notifications enable row level security;

-- Users can read their own profile if direct client access is ever used.
drop policy if exists "users can read own profile" on public.users;
create policy "users can read own profile"
on public.users
for select
to authenticated
using (auth.uid() = id);

-- Users can read their own notifications if direct client access is ever used for realtime/display.
drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read own notifications"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can update own notification read state" on public.notifications;
create policy "users can update own notification read state"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- No insert/update/delete policies for internal_requests from FE.
-- Backend service role bypasses RLS.
-- Keep business logic in FastAPI.

-- =========================================================
-- 10. Realtime
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
-- 11. Seed examples
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
-- 12. MVP Tables Summary
-- =========================================================
-- public.users
-- public.internal_requests
-- public.assignment_history
-- public.request_status_logs
-- public.notifications
