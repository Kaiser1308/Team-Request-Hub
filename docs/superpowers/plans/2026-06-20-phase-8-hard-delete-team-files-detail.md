# Hard Delete Team Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an irreversible, recursive team-file deletion path available to every active role while retaining the existing trash and scheduled-purge workflows.

**Architecture:** A new `DELETE /files/{file_id}` route delegates to the file service, which enumerates the target subtree, removes MinIO objects, records one root audit event, and physically deletes metadata in one repository call. The frontend adds a void-response API helper, a hard-delete mutation, and explicit confirmation controls for active selections and trash items.

**Tech Stack:** FastAPI, Python `unittest`, Supabase PostgREST, MinIO, Next.js 15, React 19, TypeScript, TanStack Query v5, Tailwind CSS v4.

---

## Phase Context

This is Phase 8, a post-MVP extension to the completed team-files feature. It is based on:

- `docs/superpowers/specs/2026-06-20-hard-delete-team-files-design.md`
- `docs/frontend-ui-framework.md`
- `docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md`
- `docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md`
- `apps/web/README.md`

In scope: database enum migration, backend repository/service/route behavior, frontend API/hook/UI behavior, bilingual labels, and Markdown documentation updates.

Out of scope: batch hard delete, typed-name confirmation, request attachments, retention-period changes, and automatic restore of deleted MinIO objects.

## File Map

- Create `migrations/2026-06-20-add-team-file-hard-delete.sql`: idempotent enum migration for deployed databases.
- Modify `DB_SCHEMA_TEAM_REQUEST_HUB.sql`: include `hard_delete` in fresh database setup.
- Modify `apps/api/app/repositories/file_repository.py`: select descendants and physically delete a set of metadata rows.
- Modify `apps/api/app/services/file_service.py`: orchestrate recursive permanent deletion.
- Modify `apps/api/app/routes/files.py`: expose `DELETE /files/{file_id}` with a 204 response.
- Modify `apps/api/app/schemas/files.py`: add `hard_delete` to the audit action type.
- Modify `apps/api/tests/test_file_service_workflow.py`: cover storage, recursion, audit, and failure ordering.
- Modify `apps/api/tests/test_file_service_permissions.py`: prove every active role is accepted by the service.
- Create `apps/api/tests/test_file_repository.py`: verify repository subtree and physical-delete query construction.
- Modify `apps/api/tests/test_api_contract_smoke.py`: assert route registration and 204 status.
- Modify `apps/web/src/lib/api/client.ts`: support successful responses without JSON bodies.
- Modify `apps/web/src/lib/api/files.ts`: add the permanent-delete API function.
- Modify `apps/web/src/hooks/use-files.ts`: expose the mutation and invalidate all file queries.
- Modify `apps/web/src/components/files/team-file-explorer.tsx`: track selection and confirm permanent deletion of active items.
- Modify `apps/web/src/components/files/trash-panel.tsx`: add permanent deletion beside restore.
- Modify `apps/web/src/i18n/messages/vi.json` and `apps/web/src/i18n/messages/en.json`: add irreversible-action labels and warnings.
- Modify `docs/api-contract.md`, `docs/architecture.md`, `docs/database-schema.md`, and `docs/permissions.md`: document final behavior and permissions.

### Task 1: Add the database audit action

**Files:**
- Create: `migrations/2026-06-20-add-team-file-hard-delete.sql`
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `apps/api/app/schemas/files.py`

- [ ] **Step 1: Inspect impact before editing the schema type**

Run GitNexus impact analysis for `FileAction` (or the audit action alias reported by context lookup) in the upstream direction. Report direct consumers and risk before editing. Stop and warn the user if risk is HIGH or CRITICAL.

- [ ] **Step 2: Add the idempotent deployed-database migration**

```sql
alter type public.team_file_action add value if not exists 'hard_delete';
```

- [ ] **Step 3: Update fresh schema and API literal type**

Add `'hard_delete'` after `'purge'` in the SQL enum declaration and add `"hard_delete"` to the Python `FileAction` `Literal`.

- [ ] **Step 4: Verify the schema text**

Run:

```powershell
rg -n "hard_delete" DB_SCHEMA_TEAM_REQUEST_HUB.sql migrations apps/api/app/schemas/files.py
```

Expected: one migration statement plus the fresh-schema and Python literal entries.

- [ ] **Step 5: Commit the database contract**

```powershell
git add DB_SCHEMA_TEAM_REQUEST_HUB.sql migrations/2026-06-20-add-team-file-hard-delete.sql apps/api/app/schemas/files.py
git commit -m "feat: add team file hard delete audit action"
```

### Task 2: Build repository subtree deletion with TDD

**Files:**
- Create: `apps/api/tests/test_file_repository.py`
- Modify: `apps/api/app/repositories/file_repository.py`

- [ ] **Step 1: Run impact analysis**

Run upstream GitNexus impact analysis for `file_repository` and the new symbols `list_descendants` and `delete_files` once introduced in the plan context. Report the expected Team Files-only blast radius before editing.

- [ ] **Step 2: Write failing repository tests**

Add tests with a mocked Supabase fluent query verifying these calls:

```python
rows = file_repository.list_descendants("/docs/")
admin.table.assert_called_with("team_files")
table.select.assert_called_with(file_repository.COLUMNS)
select.like.assert_called_with("path", "/docs/%")
self.assertEqual(rows, descendants)

file_repository.delete_files(["child-1", "folder-1"])
table.delete.assert_called_once_with()
delete.in_.assert_called_once_with("id", ["child-1", "folder-1"])
```

Also test that `delete_files([])` returns immediately without opening a Supabase query.

- [ ] **Step 3: Run the focused tests and verify RED**

Run from `apps/api`:

```powershell
uv --cache-dir .uv-cache run python -m unittest tests.test_file_repository -v
```

Expected: failures because `list_descendants` and `delete_files` do not exist.

- [ ] **Step 4: Implement minimal repository methods**

```python
def list_descendants(path_prefix: str) -> list[dict]:
    result = (
        get_supabase_admin()
        .table(TABLE)
        .select(COLUMNS)
        .like("path", f"{path_prefix}%")
        .execute()
    )
    return result.data or []


def delete_files(file_ids: list[str]) -> list[dict]:
    if not file_ids:
        return []
    result = (
        get_supabase_admin()
        .table(TABLE)
        .delete()
        .in_("id", file_ids)
        .execute()
    )
    return result.data or []
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run the command from Step 3. Expected: all repository tests pass.

- [ ] **Step 6: Commit repository behavior**

```powershell
git add apps/api/app/repositories/file_repository.py apps/api/tests/test_file_repository.py
git commit -m "feat: add team file subtree deletion repository"
```

### Task 3: Implement service orchestration with TDD

**Files:**
- Modify: `apps/api/tests/test_file_service_workflow.py`
- Modify: `apps/api/tests/test_file_service_permissions.py`
- Modify: `apps/api/app/services/file_service.py`

- [ ] **Step 1: Run impact analysis for the service symbols**

Run upstream GitNexus impact analysis for `activity`, `soft_delete_file`, and the planned `hard_delete_file`. Report callers, affected Team Files flows, and risk before editing.

- [ ] **Step 2: Write failing workflow tests**

Add tests asserting that a file deletion removes its object, records `hard_delete`, then calls `delete_files(["file-1"])`; and that a folder loads all descendants and deletes all non-null object keys:

```python
result = file_service.hard_delete_file("folder-1", _lead())
self.assertIsNone(result)
mock_file_repo.list_descendants.assert_called_once_with("/docs/")
mock_minio.delete_object.assert_has_calls([
    call("docs/a.pdf"),
    call("docs/nested/b.png"),
])
mock_file_repo.delete_files.assert_called_once_with([
    "folder-1", "file-1", "folder-2", "file-2",
])
activity_data = mock_activity_repo.create_activity.call_args.args[0]
self.assertEqual(activity_data["action"], "hard_delete")
self.assertEqual(activity_data["metadata"], {"files_deleted": 2, "folders_deleted": 2})
```

Add an active-file case, a soft-deleted-file case, and a MinIO failure case that asserts neither `create_activity` nor `delete_files` is called.

- [ ] **Step 3: Write failing permission tests**

Use one small test per role (`fe`, `be`, `lead`) with repository/storage mocks and assert `hard_delete_file` completes without `ForbiddenError`.

- [ ] **Step 4: Run focused tests and verify RED**

```powershell
uv --cache-dir .uv-cache run python -m unittest tests.test_file_service_workflow tests.test_file_service_permissions -v
```

Expected: new tests fail because `hard_delete_file` is missing.

- [ ] **Step 5: Implement the minimal service operation**

```python
def hard_delete_file(file_id: str, current_user: CurrentUser) -> None:
    file = file_repository.get_file_or_404(file_id)
    targets = [file]
    if file.get("is_directory"):
        targets.extend(
            file_repository.list_descendants(file_tree.descendant_prefix(file["path"]))
        )

    for target in targets:
        object_key = target.get("object_key")
        if object_key:
            minio_storage.delete_object(object_key)

    files_deleted = sum(not target.get("is_directory") for target in targets)
    folders_deleted = sum(bool(target.get("is_directory")) for target in targets)
    activity(
        current_user.id,
        file,
        "hard_delete",
        metadata={
            "files_deleted": files_deleted,
            "folders_deleted": folders_deleted,
        },
    )
    file_repository.delete_files([target["id"] for target in targets])
```

No role guard is added; route authentication already supplies an active `CurrentUser`.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 4. Expected: all focused service and permission tests pass.

- [ ] **Step 7: Commit service behavior**

```powershell
git add apps/api/app/services/file_service.py apps/api/tests/test_file_service_workflow.py apps/api/tests/test_file_service_permissions.py
git commit -m "feat: hard delete team file subtrees"
```

### Task 4: Expose the 204 API route with TDD

**Files:**
- Modify: `apps/api/tests/test_api_contract_smoke.py`
- Modify: `apps/api/app/routes/files.py`

- [ ] **Step 1: Run impact analysis for `delete_file` and the files router**

Use GitNexus upstream impact analysis and report route-level blast radius. The existing soft-delete route must remain unchanged.

- [ ] **Step 2: Add a failing contract test**

Assert the FastAPI route table contains a `DELETE` operation at `/files/{file_id}` and that its configured status code is `204`.

- [ ] **Step 3: Run the contract test and verify RED**

```powershell
uv --cache-dir .uv-cache run python -m unittest tests.test_api_contract_smoke -v
```

Expected: no matching DELETE route.

- [ ] **Step 4: Add the route**

```python
@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def hard_delete_file(
    file_id: str,
    current_user: CurrentUser = Depends(active_user),
) -> Response:
    file_service.hard_delete_file(file_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 5: Run the contract and full backend suites**

```powershell
uv --cache-dir .uv-cache run python -m unittest tests.test_api_contract_smoke -v
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

Expected: all commands exit successfully.

- [ ] **Step 6: Commit the API route**

```powershell
git add apps/api/app/routes/files.py apps/api/tests/test_api_contract_smoke.py
git commit -m "feat: expose team file hard delete endpoint"
```

### Task 5: Add the frontend API and mutation

**Files:**
- Modify: `apps/web/src/lib/api/client.ts`
- Modify: `apps/web/src/lib/api/files.ts`
- Modify: `apps/web/src/hooks/use-files.ts`

- [ ] **Step 1: Run impact analysis**

Run upstream GitNexus impact analysis for `apiFetch`, `useFileMutations`, and `deleteFile`. Report the shared-client risk before editing. Do not change `apiFetch` JSON semantics for existing callers.

- [ ] **Step 2: Add a dedicated void-response helper**

Implement `apiFetchVoid(path, options)` alongside `apiFetchText`. It must reuse authenticated headers, throw `ApiError` using the existing error-body parsing behavior, and return `Promise<void>` without parsing JSON.

- [ ] **Step 3: Add the hard-delete API call**

```typescript
export function hardDeleteFile(fileId: string) {
  return apiFetchVoid(`/files/${fileId}`, { method: "DELETE" });
}
```

- [ ] **Step 4: Add the invalidating mutation**

```typescript
hardDeleteFile: useMutation({
  mutationFn: (fileId: string) => hardDeleteFile(fileId),
  onSuccess: invalidate,
}),
```

- [ ] **Step 5: Verify TypeScript and lint**

Run from `apps/web`:

```powershell
npm run lint
npm run build
```

Expected: both commands exit successfully.

- [ ] **Step 6: Commit the frontend data layer**

```powershell
git add apps/web/src/lib/api/client.ts apps/web/src/lib/api/files.ts apps/web/src/hooks/use-files.ts
git commit -m "feat: add team file hard delete mutation"
```

### Task 6: Add irreversible-delete UI for active and trashed items

**Files:**
- Modify: `apps/web/src/components/files/team-file-explorer.tsx`
- Modify: `apps/web/src/components/files/trash-panel.tsx`
- Modify: `apps/web/src/i18n/messages/vi.json`
- Modify: `apps/web/src/i18n/messages/en.json`

- [ ] **Step 1: Run impact analysis for both file components**

Run upstream GitNexus impact analysis for `TeamFileExplorer` and `TrashPanel`. Report affected routes and risk before editing.

- [ ] **Step 2: Add bilingual copy**

Add a `files` namespace in both message files with keys for `hardDelete`, `hardDeleting`, `hardDeleteFileConfirm`, `hardDeleteFolderConfirm`, and `hardDeleteError`. Vietnamese copy must explicitly say “không thể hoàn tác”; English copy must explicitly say “cannot be undone.”

- [ ] **Step 3: Wire active-item selection and confirmation**

Use `onSelectionChange` to store selected `CuboneFile[]`. Add a compact danger-styled “Xóa vĩnh viễn” button near the existing file controls, disabled when no item is selected or the mutation is pending.

For each selected item, call `window.confirm` with the file or folder-specific translated warning. Only confirmed items call `mutations.hardDeleteFile.mutateAsync(file.id)`. The existing FileManager `onDelete` continues to soft-delete and is relabeled in surrounding helper text as moving items to trash.

- [ ] **Step 4: Add trash-item permanent deletion**

Add a red `Trash2` button beside Restore. Confirm with the same file/folder-specific warning, then call `hardDeleteFile`. Keep the Trash panel lead-only because viewing deleted items remains lead-only; the backend endpoint itself remains available to every active role for known IDs and active items.

- [ ] **Step 5: Verify frontend behavior statically**

Run from `apps/web`:

```powershell
npm run lint
npm run build
```

Expected: lint and production build pass with no TypeScript errors.

- [ ] **Step 6: Browser-check both paths**

Run the app and verify:

1. An `fe`, `be`, or `lead` can select an active file and see permanent delete.
2. Cancelling confirmation makes no request.
3. Confirming removes the item after query invalidation.
4. A folder warning mentions all contents.
5. Lead trash view shows Restore and Permanent delete.
6. Soft delete still moves items to trash.

- [ ] **Step 7: Commit the UI**

```powershell
git add apps/web/src/components/files/team-file-explorer.tsx apps/web/src/components/files/trash-panel.tsx apps/web/src/i18n/messages/vi.json apps/web/src/i18n/messages/en.json
git commit -m "feat: add permanent delete controls to team files"
```

### Task 7: Update Markdown documentation

**Files:**
- Modify: `docs/api-contract.md`
- Modify: `docs/architecture.md`
- Modify: `docs/database-schema.md`
- Modify: `docs/permissions.md`

- [ ] **Step 1: Update the API contract**

Document `DELETE /files/{file_id}`, `204 No Content`, recursive folder behavior, availability to every active role, and irreversible removal from MinIO and `team_files`. Keep `POST /files/{file_id}/delete` documented as soft delete.

- [ ] **Step 2: Update architecture and schema guides**

Describe storage-first recursive deletion, retry behavior across the MinIO/Postgres boundary, physical metadata deletion, and the `hard_delete` audit action.

- [ ] **Step 3: Update permissions**

State that every active `fe`, `be`, and `lead` can soft-delete and hard-delete active items. Preserve lead-only restore, trash visibility, and scheduled purge rules.

- [ ] **Step 4: Check documentation consistency**

```powershell
rg -n "hard.delete|permanent|xóa cứng|xóa vĩnh viễn|DELETE /files" docs/*.md
git diff --check
```

Expected: all four documents describe the same endpoint, permissions, and irreversibility; `git diff --check` succeeds.

- [ ] **Step 5: Commit documentation**

```powershell
git add docs/api-contract.md docs/architecture.md docs/database-schema.md docs/permissions.md
git commit -m "docs: document team file hard delete"
```

### Task 8: Final verification and scope audit

**Files:**
- Verify all changed files from Tasks 1-7.

- [ ] **Step 1: Run full backend verification**

```powershell
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

Expected: all tests pass and compileall succeeds.

- [ ] **Step 2: Run full frontend verification**

```powershell
cd apps/web
npm run lint
npm run build
```

Expected: lint and build succeed.

- [ ] **Step 3: Run GitNexus change detection**

Run `gitnexus_detect_changes()` before any final commit. Expected affected scope: Team Files API/repository/service/UI, the shared void API helper, schema/migration, and the four Markdown guides. Investigate any unrelated request, notification, or authentication flow.

- [ ] **Step 4: Review the final diff**

```powershell
git status --short
git diff --check
git diff --stat HEAD~7..HEAD
```

Expected: no whitespace errors, no secrets, no generated build output, and only the planned files.

- [ ] **Step 5: Record verification outcome**

If verification requires a corrective change, make the smallest scoped fix, rerun the affected command, and commit it with a specific `fix:` message. Do not claim completion until every required command has current passing output.

## Done Criteria

- Soft delete and seven-day purge behavior remain operational.
- Every active role can permanently delete an active file or folder.
- Folder hard delete removes all descendant MinIO objects and metadata rows.
- A storage error prevents audit and metadata deletion and remains retryable.
- The API returns 204 without forcing JSON parsing.
- Active selection and lead trash views require an irreversible-action confirmation.
- Backend tests and compile checks pass.
- Frontend lint and build pass.
- API, architecture, schema, and permissions Markdown files are updated.
- GitNexus reports only the intended blast radius.

## Known Risks

- MinIO and PostgreSQL cannot share a transaction. Partial object deletion is possible on storage failure; metadata remains to make retry safe.
- The shared API client needs a separate void helper because existing `apiFetch` always parses JSON.
- `team_file_action` is a PostgreSQL enum; deployed environments must apply the migration before the API writes `hard_delete` activity.
- Trash listing remains lead-only, so non-lead users can hard-delete active items but cannot browse soft-deleted items through the current UI.
