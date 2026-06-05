# Permissions

Permissions are enforced by the FastAPI backend after verifying the Supabase JWT and loading the current profile from `public.users`. The frontend hides or disables actions for usability, but backend services are the source of truth.

## Roles

- `fe`: frontend team member. Can create requests, self-assign from the pool, and update requests assigned to them. Can reassign requests as creator or assignee, and cancel requests as creator.
- `be`: backend team member. Can create requests, self-assign from the pool, and update requests assigned to them. Can reassign requests as creator or assignee, and cancel requests as creator.
- `lead`: lead/admin user. Can view all requests, reassign and cancel any request, and update user roles.

New users default to `fe` through the Supabase Auth profile trigger.

## Request Access

- Creators can see requests they created.
- Assignees can see and act on requests where they are current members in `request_assignees`.
- `request_assignees` is the assignment membership source of truth. Pool, done, dashboard, permission, and enrichment paths use membership-based reads. `assigned_to` remains the primary-assignee compatibility field for legacy response shape and older single-assignee assumptions.
- Pending requests with no current `request_assignees` rows appear in the pool and can be viewed by active users.
- Active users can self-assign from the pool; backend rejects invalid state changes.
- `view=all` is lead-only.
- Leads can reassign any request and cancel any request across the team.
- Creator, lead, or a current assignee can add/remove assignees on open requests.
- Removing an assignee from an active request requires a reason; the last assignee cannot be removed from `acknowledged` or `in_progress` requests.

## Role Management

`PATCH /users/{user_id}/role` is lead-only. The backend rejects non-lead role updates regardless of frontend navigation state.

## User Approval

`PATCH /users/{user_id}/active` is lead-only. Leads can approve (`is_active: true`) or deactivate (`is_active: false`) users.

## User Language Preference

`PATCH /users/me/language` is available to all active users. Updates the `preferred_language` field used for i18n and Telegram message language.

## Pending Approval

New users can authenticate but start with `is_active = false`. `/users/me` returns the profile so the frontend can show a pending approval screen. Request, notification, user-list, and admin endpoints reject inactive users until a lead approves them.

## Row Level Security

Supabase RLS is enabled as defense-in-depth, but product authorization lives in FastAPI. The frontend must not query application tables directly or use service-role credentials.

## Team Files

- Active `fe`, `be`, and `lead` users can browse, search, create folders, upload, download, preview, rename, move, batch-move, and soft-delete files.
- Only `lead` users can batch-copy, restore from trash, and purge expired files.
- Deleted files are retained for 7 days before purge eligibility.

## Request Attachments

- Active `fe`, `be`, and `lead` users can upload attachments (presigned URL flow) and preview attachments.
- Attachments are scoped to request or done-reply context.
- Attachment IDs are referenced during request creation (`attachment_ids`) and done reply submission (`attachment_ids`).
