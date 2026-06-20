# Hard Delete Team Files Design

## Goal

Add an explicit permanent-delete operation to the team file explorer while preserving the existing seven-day soft-delete and restore workflow.

Every active `fe`, `be`, and `lead` user may permanently delete an active or deleted file or folder. Permanently deleting a folder includes every descendant. The operation cannot be undone.

## Scope

This change covers team files managed through `/files` and `public.team_files`. It does not change request-attachment deletion or the scheduled purge of completed and cancelled requests.

The existing operations remain unchanged:

- `POST /files/{file_id}/delete` soft-deletes a file or folder.
- `POST /files/{file_id}/restore` restores a soft-deleted item and remains lead-only.
- `POST /files/purge-expired` purges expired trash items and remains lead-only.

## API Design

Add this protected endpoint:

```text
DELETE /files/{file_id}
```

The endpoint accepts any active user and returns `204 No Content` after the complete subtree has been permanently removed. It returns the existing standard `404` response when the target metadata row does not exist.

The endpoint is intentionally separate from soft-delete. A query flag on the existing delete action would make an irreversible operation too easy to invoke accidentally and would blur the API contract.

## Backend Architecture

The route remains thin and delegates to a new file-service operation. The service owns authorization, subtree orchestration, MinIO side effects, and audit metadata. The repository owns subtree reads and physical metadata deletion.

For a single file, the target is the only deletion candidate. For a folder, the repository selects the target and every row whose path begins with the folder's descendant prefix. Selection must include active, pending-upload, deleted, and purged rows so no hidden descendant metadata survives.

The service performs the operation in this order:

1. Load the target or return `404`.
2. Load all descendants when the target is a folder.
3. Delete each non-null MinIO object key. Missing objects are treated according to the storage adapter's existing idempotent delete behavior.
4. Create one `hard_delete` activity record for the root target, including deleted file and folder counts in metadata.
5. Physically delete all selected `team_files` rows in one repository operation.
6. Return no response body.

Object deletion happens before metadata deletion so a storage failure does not erase the information needed to retry. MinIO and PostgreSQL cannot share a transaction, so a failure partway through object deletion can leave some objects already absent while all metadata remains. Retrying the same operation completes cleanup; object deletion therefore must remain idempotent.

The database deletion should remove the subtree as one statement. The root activity record is written before metadata deletion, and `file_activity_logs.file_id ON DELETE SET NULL` preserves the audit event after the target row disappears.

## Database Changes

Add `hard_delete` to `team_file_action`. Update both the executable schema and an idempotent migration suitable for an already-provisioned Supabase database.

No new table or status is required. Hard-deleted rows are physically removed from `public.team_files`; unlike scheduled purge, they are not retained with status `purged`.

## Frontend Design

Keep the existing soft-delete action, presented as moving an item to trash. Add a distinct permanent-delete action for active and deleted items for every role.

Before invoking the API, show an irreversible-action confirmation that names the selected item. For folders, the warning explicitly states that all contents will be permanently deleted. Confirmation is required once; typed-name confirmation is outside this scope.

After success, invalidate the file list, search, and tree query families so the item disappears from every current view. The UI should show the normal mutation error feedback if the API fails and leave the visible list unchanged until the next query refresh confirms server state.

## Error Handling

- Missing target metadata returns `404`.
- Authentication and inactive-user rejection continue through the existing `active_user` dependency.
- Storage failures propagate as the existing domain/API error and prevent metadata deletion.
- Database deletion failure propagates as an API error. Objects may already be absent; a retry remains safe and finishes deleting metadata.
- An empty object key, as used by folders or previously purged records, does not trigger a MinIO call.

## Testing

Backend service tests cover:

- permanent deletion of one active file;
- permanent deletion of one soft-deleted file;
- recursive folder deletion, including active and deleted descendants;
- deletion by `fe`, `be`, and `lead` users;
- no metadata deletion when MinIO deletion fails;
- audit action and file/folder counts;
- missing target behavior.

Route tests verify `DELETE /files/{file_id}`, active-user enforcement, and `204 No Content`.

Repository tests verify subtree selection and physical deletion filters. Frontend tests, where practical within the existing test setup, verify API method selection, confirmation wiring, query invalidation, and folder warning copy. The available repository-wide verification remains backend `unittest`, frontend lint, and frontend build.

## Documentation

Update the API contract, architecture, database schema guide, and permissions guide to distinguish soft-delete, scheduled purge, and user-triggered hard delete.

## Out of Scope

- Batch hard delete.
- Typed-name or multi-step confirmation.
- Restoring hard-deleted metadata or MinIO objects.
- Changing request-attachment deletion.
- Changing the seven-day soft-delete retention period.
