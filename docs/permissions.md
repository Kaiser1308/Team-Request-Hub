# Permissions

Permissions are enforced by the FastAPI backend after verifying the Supabase JWT and loading the current profile from `public.users`. The frontend hides or disables actions for usability, but backend services are the source of truth.

## Roles

- `fe`: frontend team member. Can create requests, self-assign from the pool, and update requests assigned to them.
- `be`: backend team member. Can create requests, self-assign from the pool, and update requests assigned to them.
- `lead`: lead/admin user. Can view all requests, reassign requests, cancel requests, and update user roles.

New users default to `fe` through the Supabase Auth profile trigger.

## Request Access

- Creators can see requests they created.
- Assignees can see and act on requests assigned to them.
- Unassigned pending requests appear in the pool and can be self-assigned.
- `view=all` is lead-only.
- Leads can reassign and cancel requests across the team.

## Role Management

`PATCH /users/{user_id}/role` is lead-only. The backend rejects non-lead role updates regardless of frontend navigation state.

## Pending Approval

New users can authenticate but start with `is_active = false`. `/users/me` returns the profile so the frontend can show a pending approval screen. Request, notification, user-list, and admin endpoints reject inactive users until a lead approves them.

## Row Level Security

Supabase RLS is enabled as defense-in-depth, but product authorization lives in FastAPI. The frontend must not query application tables directly or use service-role credentials.
