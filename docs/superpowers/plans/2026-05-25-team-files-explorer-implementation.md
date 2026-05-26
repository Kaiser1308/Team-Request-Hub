# Team Files Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared team file explorer backed by FastAPI metadata, Supabase Postgres audit tables, and external MinIO presigned URLs.

**Architecture:** Add a backend `/files` module following `routes -> services -> repositories -> Supabase`, with a separate MinIO adapter for presigned URLs and object operations. Add a dashboard `/files` page that uses `@cubone/react-file-manager` as the UI shell while all business actions go through FastAPI.

**Tech Stack:** FastAPI, Pydantic, Supabase Python client, MinIO Python SDK, Next.js 15 App Router, React 19, TanStack Query v5, `@cubone/react-file-manager`, Tailwind CSS v4.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-25-team-files-explorer-design.md`
- Architecture: `docs/architecture.md`
- API contract: `docs/api-contract.md`
- Database schema: `docs/database-schema.md`
- Permissions: `docs/permissions.md`
- Frontend UI framework: `docs/frontend-ui-framework.md`

## File Structure

- `DB_SCHEMA_TEAM_REQUEST_HUB.sql`: add `team_files`, `file_activity_logs`, enums, indexes, triggers, RLS.
- `apps/api/app/schemas/files.py`: Pydantic schemas for file metadata, actions, presigned URL responses.
- `apps/api/app/repositories/file_repository.py`: `team_files` Supabase table access only.
- `apps/api/app/repositories/file_activity_repository.py`: `file_activity_logs` write/read access only.
- `apps/api/app/services/minio_storage.py`: MinIO client, presigned PUT/GET, copy, delete.
- `apps/api/app/services/file_service.py`: validation, permissions, workflow, audit logging.
- `apps/api/app/routes/files.py`: thin `/files` HTTP routes.
- `apps/web/src/lib/api/files.ts`: typed frontend API calls.
- `apps/web/src/hooks/use-files.ts`: TanStack Query hooks/mutations.
- `apps/web/src/components/files/team-file-explorer.tsx`: UI adapter around `@cubone/react-file-manager`.
- `apps/web/src/app/(dashboard)/files/page.tsx`: route entry.

---

### Task 1: Schema, Docs, And Dependencies

**Files:**
- Modify: `DB_SCHEMA_TEAM_REQUEST_HUB.sql`
- Modify: `docs/database-schema.md`
- Modify: `docs/api-contract.md`
- Modify: `docs/permissions.md`
- Modify: `apps/api/requirements.txt`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/app/core/config.py`
- Modify: `apps/api/app/core/exceptions.py`

- [ ] **Step 1: Add schema objects**

Add `team_file_status`, `team_file_action`, and `team_file_target_type` enums. Add `public.team_files` with columns from the design spec: `id`, `name`, `path`, `parent_path`, `is_directory`, `object_key`, `size_bytes`, `content_type`, `extension`, `status`, `uploaded_by`, `created_by`, `updated_by`, `deleted_by`, `created_at`, `updated_at`, `deleted_at`, `purge_after`. Add `public.file_activity_logs` with `id`, `actor_id`, `file_id`, `action`, `target_type`, `old_path`, `new_path`, `metadata`, `created_at`.

Use these indexes:

```sql
create index if not exists idx_team_files_parent_status_name
  on public.team_files(parent_path, status, name);
create index if not exists idx_team_files_status_purge_after
  on public.team_files(status, purge_after);
create index if not exists idx_team_files_lower_name
  on public.team_files(lower(name));
create index if not exists idx_file_activity_logs_file_created_at
  on public.file_activity_logs(file_id, created_at desc);
create index if not exists idx_file_activity_logs_actor_created_at
  on public.file_activity_logs(actor_id, created_at desc);
```

Add `trg_team_files_set_updated_at`, enable RLS on both new tables, and add both tables to the MVP table summary.

- [ ] **Step 2: Document schema, API, and permissions**

Update `docs/database-schema.md` with `team_files` and `file_activity_logs`. Update `docs/api-contract.md` with the `/files` endpoints from the spec. Update `docs/permissions.md` with: active `fe`, `be`, and `lead` can browse/search/create folders/upload/download/preview; only `lead` can rename/move/delete/restore/purge; deleted files are retained for 7 days.

- [ ] **Step 3: Add MinIO dependency and config**

Append `minio` to `apps/api/requirements.txt`.

Append to `apps/api/.env.example`:

```txt
MINIO_ENDPOINT=
MINIO_REGION=us-east-1
MINIO_BUCKET=team-files
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_SECURE=true
MINIO_PUBLIC_ENDPOINT=
```

Add to `Settings` in `apps/api/app/core/config.py`:

```python
    minio_endpoint: str | None = None
    minio_region: str = "us-east-1"
    minio_bucket: str = "team-files"
    minio_access_key: str | None = None
    minio_secret_key: str | None = None
    minio_secure: bool = True
    minio_public_endpoint: str | None = None
```

Add to `apps/api/app/core/exceptions.py`:

```python
class GoneError(DomainError):
    def __init__(self, message: str = "Resource is gone"):
        super().__init__(message)
```

- [ ] **Step 4: Verify and commit**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache pip install -r requirements.txt
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: install succeeds and existing tests pass.

Commit:

```bash
git add DB_SCHEMA_TEAM_REQUEST_HUB.sql docs/database-schema.md docs/api-contract.md docs/permissions.md apps/api/requirements.txt apps/api/.env.example apps/api/app/core/config.py apps/api/app/core/exceptions.py
git commit -m "feat: add team files schema"
```

---

### Task 2: Backend Schemas, Repositories, And Storage Adapter

**Files:**
- Create: `apps/api/app/schemas/files.py`
- Create: `apps/api/app/repositories/file_repository.py`
- Create: `apps/api/app/repositories/file_activity_repository.py`
- Create: `apps/api/app/services/minio_storage.py`

- [ ] **Step 1: Confirm schema requirements before coding**

Use the approved spec field names exactly. Backend JSON must use snake_case names matching the database columns: `parent_path`, `is_directory`, `size_bytes`, `content_type`, `created_at`, `updated_at`, `deleted_at`, and `purge_after`.

- [ ] **Step 2: Create `apps/api/app/schemas/files.py`**

Define these Pydantic models and aliases exactly:

```python
FileStatus = Literal["pending_upload", "active", "deleted", "purged"]
FileAction = Literal["create_folder", "upload", "complete_upload", "rename", "move", "delete", "restore", "purge", "download", "preview"]
TargetType = Literal["file", "folder"]
TeamFileOut
FileActivityOut
CreateFolderRequest
UploadUrlRequest
UploadUrlResponse
CompleteUploadRequest
RenameFileRequest
MoveFileRequest
PresignedUrlResponse
PurgeExpiredResponse
```

`UploadUrlRequest.size_bytes` and `CompleteUploadRequest.size_bytes` must be `Field(ge=1, le=209_715_200)`.

- [ ] **Step 3: Create repositories**

Create `file_activity_repository.py` with `create_activity(data: dict) -> dict | None` and `list_activity(file_id: str | None = None, limit: int = 50) -> list[dict]`.

Create `file_repository.py` with:

```python
TABLE = "team_files"
COLUMNS = "id,name,path,parent_path,is_directory,object_key,size_bytes,content_type,extension,status,uploaded_by,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at,purge_after"
```

Functions:

```python
list_children(parent_path: str, include_deleted: bool = False) -> list[dict]
search_by_name(query_text: str, include_deleted: bool = False, limit: int = 50) -> list[dict]
get_file_or_404(file_id: str) -> dict
get_by_path(path: str) -> dict | None
create_file(data: dict) -> dict
update_file(file_id: str, data: dict) -> dict
update_descendants(path_prefix: str, data: dict) -> list[dict]
list_deleted_ready_for_purge() -> list[dict]
```

Use existing repository exception style: `NotFoundError`, `ConflictError`, `DomainError` from `app.core.exceptions`.

- [ ] **Step 4: Create MinIO adapter**

Create `apps/api/app/services/minio_storage.py` with:

```python
from datetime import timedelta

from minio import Minio
from minio.commonconfig import CopySource

from app.core.config import get_settings
from app.core.exceptions import BadRequestError, DomainError

DEFAULT_PRESIGNED_EXPIRY_SECONDS = 300


def _get_client() -> Minio:
    settings = get_settings()
    if not settings.minio_endpoint or not settings.minio_access_key or not settings.minio_secret_key:
        raise BadRequestError("MinIO is not configured")

    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
        region=settings.minio_region,
    )


def _bucket_name() -> str:
    return get_settings().minio_bucket


def presigned_put_url(object_key: str, expires_seconds: int = DEFAULT_PRESIGNED_EXPIRY_SECONDS) -> str:
    return _get_client().presigned_put_object(
        _bucket_name(),
        object_key,
        expires=timedelta(seconds=expires_seconds),
    )


def presigned_get_url(object_key: str, expires_seconds: int = DEFAULT_PRESIGNED_EXPIRY_SECONDS) -> str:
    return _get_client().presigned_get_object(
        _bucket_name(),
        object_key,
        expires=timedelta(seconds=expires_seconds),
    )


def copy_object(source_key: str, destination_key: str) -> None:
    try:
        _get_client().copy_object(
            _bucket_name(),
            destination_key,
            CopySource(_bucket_name(), source_key),
        )
    except Exception as exc:
        raise DomainError("MinIO copy failed") from exc


def delete_object(object_key: str) -> None:
    try:
        _get_client().remove_object(_bucket_name(), object_key)
    except Exception as exc:
        raise DomainError("MinIO delete failed") from exc
```


- [ ] **Step 5: Commit backend foundation**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

Commit the foundation files only:

```bash
git add apps/api/app/schemas/files.py apps/api/app/repositories/file_repository.py apps/api/app/repositories/file_activity_repository.py apps/api/app/services/minio_storage.py
git commit -m "feat: add file storage foundation"
```

---

### Task 3: Backend File Service Workflows

**Files:**
- Create: `apps/api/app/services/file_service.py`
- Create: `apps/api/tests/test_file_service_validation.py`
- Create: `apps/api/tests/test_file_service_permissions.py`
- Create: `apps/api/tests/test_file_service_workflow.py`

- [ ] **Step 1: Write failing validation, permission, and workflow tests**

Create `apps/api/tests/test_file_service_validation.py` with tests for `normalize_path`, `validate_name`, `build_child_path`, `get_extension`, and `is_preview_supported`. Include cases rejecting `..`, `//`, `a/b`, null bytes, `<`, `>`, `|`, and SVG preview.

Create `test_file_service_permissions.py` covering:

```python
non-lead rename_file raises ForbiddenError
non-lead move_file raises ForbiddenError
non-lead soft_delete_file raises ForbiddenError
non-lead restore_file raises ForbiddenError
non-lead purge_expired raises ForbiddenError
lead rename_file updates path and logs activity
```

Create `test_file_service_workflow.py` covering:

```python
create_folder creates active folder and logs create_folder
create_upload_url creates pending_upload file and returns PUT URL
complete_upload changes pending_upload to active
create_preview_url rejects unsupported SVG/HTML types
soft_delete_file sets status deleted and purge_after 7 days
restore_file rejects purged item with GoneError
purge_expired deletes MinIO object, marks purged, clears object_key, logs purge
```

Run:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_file_service_validation tests.test_file_service_permissions tests.test_file_service_workflow
```

Expected: FAIL because `file_service.py` is not implemented.

- [ ] **Step 2: Implement validation helpers**

Create `apps/api/app/services/file_service.py` with constants:

```python
MAX_FILE_SIZE_BYTES = 209_715_200
PRESIGNED_EXPIRY_SECONDS = 300
PURGE_AFTER_DAYS = 7
SAFE_NAME_RE = re.compile(r"^[^/\\\x00<>:\"|?*]+$")
PREVIEW_TYPES = {("image/png", "png"), ("image/jpeg", "jpg"), ("image/jpeg", "jpeg"), ("image/gif", "gif"), ("image/webp", "webp"), ("application/pdf", "pdf")}
```

Implement:

```python
is_lead(current_user)
ensure_lead(current_user)
normalize_path(path)
validate_name(name)
build_child_path(parent_path, name)
get_extension(name)
is_preview_supported(content_type, extension)
ensure_available_path(path)
activity(actor_id, file, action, old_path=None, new_path=None, metadata=None)
```

`normalize_path` must reject traversal, double slash, null bytes, and return `/` for empty/root input. `ensure_lead` must raise `ForbiddenError("Only leads can manage existing files")`.

- [ ] **Step 3: Implement workflow methods**

Add:

```python
create_folder(payload, current_user) -> dict
create_upload_url(payload, current_user) -> dict
complete_upload(file_id, payload, current_user) -> dict
list_files(path="/", include_deleted=False) -> list[dict]
search_files(q, include_deleted=False) -> list[dict]
rename_file(file_id, payload, current_user) -> dict
move_file(file_id, payload, current_user) -> dict
soft_delete_file(file_id, current_user) -> dict
restore_file(file_id, current_user) -> dict
create_download_url(file_id, current_user) -> dict
create_preview_url(file_id, current_user) -> dict
purge_expired(current_user) -> dict
list_activity(file_id=None, limit=50) -> list[dict]
```

Rules:

- `create_upload_url` creates `pending_upload`, generated object key `team-files/{uuid}-{name}`, calls `minio_storage.presigned_put_url`, logs `upload`.
- `complete_upload` only accepts `pending_upload`, sets `active`, logs `complete_upload`.
- `rename_file`, `move_file`, `soft_delete_file`, `restore_file`, `purge_expired` call `ensure_lead`.
- `soft_delete_file` sets `deleted_at`, `deleted_by`, `purge_after = now + 7 days`, and updates descendants for folders.
- `restore_file` rejects `purged` with `GoneError("File has been purged")` and rejects active path conflicts.
- `create_preview_url` only permits supported image/PDF types and logs `preview`.
- `purge_expired` deletes MinIO objects, updates rows to `status="purged"` and `object_key=None`, logs `purge`.

- [ ] **Step 4: Verify and commit service workflows**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_file_service_validation tests.test_file_service_permissions tests.test_file_service_workflow
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

Commit:

```bash
git add apps/api/app/services/file_service.py apps/api/tests/test_file_service_validation.py apps/api/tests/test_file_service_permissions.py apps/api/tests/test_file_service_workflow.py
git commit -m "feat: add file service workflows"
```

---

### Task 4: Backend Routes

**Files:**
- Create: `apps/api/app/routes/files.py`
- Modify: `apps/api/app/main.py`

- [ ] **Step 1: Create files router**

Create `apps/api/app/routes/files.py` with these route signatures:

```python
@router.get("", response_model=list[TeamFileOut])
async def list_files(path: str = "/", include_deleted: bool = False, current_user: CurrentUser = Depends(active_user))

@router.get("/search", response_model=list[TeamFileOut])
async def search_files(q: str, include_deleted: bool = False, current_user: CurrentUser = Depends(active_user))

@router.post("/folders", response_model=TeamFileOut, status_code=status.HTTP_201_CREATED)
async def create_folder(payload: CreateFolderRequest, current_user: CurrentUser = Depends(active_user))

@router.post("/upload-url", response_model=UploadUrlResponse, status_code=status.HTTP_201_CREATED)
async def create_upload_url(payload: UploadUrlRequest, current_user: CurrentUser = Depends(active_user))

@router.post("/{file_id}/complete-upload", response_model=TeamFileOut)
async def complete_upload(file_id: str, payload: CompleteUploadRequest, current_user: CurrentUser = Depends(active_user))

@router.post("/{file_id}/download-url", response_model=PresignedUrlResponse)
async def download_url(file_id: str, current_user: CurrentUser = Depends(active_user))

@router.post("/{file_id}/preview-url", response_model=PresignedUrlResponse)
async def preview_url(file_id: str, current_user: CurrentUser = Depends(active_user))

@router.patch("/{file_id}/rename", response_model=TeamFileOut)
async def rename_file(file_id: str, payload: RenameFileRequest, current_user: CurrentUser = Depends(active_user))

@router.patch("/{file_id}/move", response_model=TeamFileOut)
async def move_file(file_id: str, payload: MoveFileRequest, current_user: CurrentUser = Depends(active_user))

@router.post("/{file_id}/delete", response_model=TeamFileOut)
async def delete_file(file_id: str, current_user: CurrentUser = Depends(active_user))

@router.post("/{file_id}/restore", response_model=TeamFileOut)
async def restore_file(file_id: str, current_user: CurrentUser = Depends(active_user))

@router.post("/purge-expired", response_model=PurgeExpiredResponse)
async def purge_expired(current_user: CurrentUser = Depends(active_user))

@router.get("/activity", response_model=list[FileActivityOut])
async def list_activity(file_id: str | None = None, limit: int = 50, current_user: CurrentUser = Depends(active_user))
```

The router must call `require_active_current_user` through a local `active_user` dependency, matching existing route patterns.

- [ ] **Step 2: Wire router and 410 handler**

Modify `apps/api/app/main.py` to import `GoneError`, add a 410 exception handler, import `files`, and include:

```python
app.include_router(files.router, prefix="/files", tags=["files"])
```

- [ ] **Step 3: Verify and commit routes**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

Commit:

```bash
git add apps/api/app/routes/files.py apps/api/app/main.py
git commit -m "feat: add file API routes"
```

---

### Task 5: Frontend Data Layer

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/lib/api/query-keys.ts`
- Create: `apps/web/src/lib/api/files.ts`
- Create: `apps/web/src/hooks/use-files.ts`

- [ ] **Step 1: Install UI dependency**

Run from `apps/web`:

```bash
npm install @cubone/react-file-manager
```

Expected: `package.json` and `package-lock.json` update.

- [ ] **Step 2: Add frontend types**

Append `TeamFileStatus`, `TeamFileAction`, `TeamFile`, and `FileActivityLog` to `apps/web/src/types/index.ts`. Field names must match backend JSON: `parent_path`, `is_directory`, `size_bytes`, `content_type`, `created_at`, `updated_at`, `deleted_at`, `purge_after`.

- [ ] **Step 3: Add query keys**

Add to `queryKeys`:

```ts
files: {
  all: ["files"] as const,
  list: (path: string, includeDeleted: boolean) => ["files", "list", { path, includeDeleted }] as const,
  search: (query: string, includeDeleted: boolean) => ["files", "search", { query, includeDeleted }] as const,
  activity: (fileId?: string) => ["files", "activity", fileId ?? "all"] as const,
},
```

- [ ] **Step 4: Create `apps/web/src/lib/api/files.ts`**

Export functions for every backend endpoint:

```ts
listFiles(path: string, includeDeleted?: boolean)
searchFiles(query: string, includeDeleted?: boolean)
createFolder(payload)
createUploadUrl(payload)
completeUpload(fileId, payload)
getDownloadUrl(fileId)
getPreviewUrl(fileId)
renameFile(fileId, payload)
moveFile(fileId, payload)
deleteFile(fileId)
restoreFile(fileId)
purgeExpiredFiles()
listFileActivity(fileId?, limit?)
```

Use `apiFetch` for all calls. Use `URLSearchParams` for query strings.

- [ ] **Step 5: Create `apps/web/src/hooks/use-files.ts`**

Export:

```ts
useFiles(path: string, includeDeleted?: boolean)
useFileSearch(query: string, includeDeleted?: boolean)
useFileActivity(fileId?: string)
useFileMutations()
```

`useFileMutations()` must invalidate `queryKeys.files.all` after create folder, complete upload, rename, move, delete, restore, and purge.

- [ ] **Step 6: Verify and commit frontend data layer**

Run from `apps/web`:

```bash
npm run lint
```

Expected: PASS.

Commit:

```bash
git add apps/web/package.json apps/web/package-lock.json apps/web/src/types/index.ts apps/web/src/lib/api/query-keys.ts apps/web/src/lib/api/files.ts apps/web/src/hooks/use-files.ts
git commit -m "feat: add file explorer data layer"
```

---

### Task 6: Frontend Explorer UI And Navigation

**Files:**
- Create: `apps/web/src/components/files/team-file-explorer.tsx`
- Create: `apps/web/src/app/(dashboard)/files/page.tsx`
- Modify: `apps/web/src/components/app/app-shell.tsx`

- [ ] **Step 1: Create explorer component**

Create a client component that:

- imports `FileManager` and `@cubone/react-file-manager/dist/style.css`.
- maps backend `TeamFile` to `{ id, name, isDirectory, path, updatedAt, size }`.
- keeps `currentPath`, `search`, and lead-only `includeDeleted` in local state.
- uses `useFiles`, `useFileSearch`, `useFileMutations`, and `useCurrentUser`.
- uses a custom upload button because presigned URLs are per file.
- upload flow: `createUploadUrl` -> `fetch(upload_url, { method: "PUT", body: file })` -> `completeUpload`.
- `onFileOpen`: directories update `currentPath`; supported image/PDF files request preview URL; other files request download URL.
- sets `permissions={{ create: true, upload: false, download: true, copy: false, move: isLead, rename: isLead, delete: isLead }}`.

Use text labels `Files`, `Search files`, `Trash`, and `Upload` for MVP. Keep styling within existing neutral dashboard tokens.

- [ ] **Step 2: Create route page**

Create `apps/web/src/app/(dashboard)/files/page.tsx`:

```tsx
import { TeamFileExplorer } from "@/components/files/team-file-explorer";

export default function FilesPage() {
  return <TeamFileExplorer />;
}
```

- [ ] **Step 3: Add sidebar navigation**

Modify `apps/web/src/components/app/app-shell.tsx`:

- import `FolderOpen` from `lucide-react`.
- add `"files"` to `NavLabelKey`.
- add `{ href: "/files", labelKey: "files", icon: FolderOpen }` to `navItems`.
- add `"/files": "files"` to `titleByKey`.

Add `files` to the existing `nav` object in `apps/web/src/i18n/messages/en.json` and `apps/web/src/i18n/messages/vi.json`.

- [ ] **Step 4: Verify and commit frontend UI**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected: PASS.

Commit:

```bash
git add apps/web/src/components/files/team-file-explorer.tsx apps/web/src/app/(dashboard)/files/page.tsx apps/web/src/components/app/app-shell.tsx apps/web/src/i18n/messages/en.json apps/web/src/i18n/messages/vi.json
git commit -m "feat: add team files explorer UI"
```

---

### Task 7: Final Verification And Scope Review

**Files:**
- No new files expected.

- [ ] **Step 1: Run backend checks**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: PASS.

- [ ] **Step 2: Run frontend checks**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected: PASS.

- [ ] **Step 3: Run GitNexus change detection**

Run MCP tool:

```txt
gitnexus_detect_changes({ scope: "all", repo: "Team-Request-Hub" })
```

Expected: changed symbols and affected flows are limited to Team Files, app shell navigation, config/docs/schema, and no unrelated request workflow behavior.

- [ ] **Step 4: Inspect final git state**

Run:

```bash
git status --short
git log --oneline -10
```

Expected: only intended feature changes remain uncommitted, or all task commits are present. Existing unrelated dirty files from before this plan must not be reverted or included unless they were intentionally edited for this feature.

---

## Self-Review

- Spec coverage: schema, MinIO config, presigned upload/download, audit logs, permissions, soft delete/purge, search, image/PDF preview, frontend explorer, docs, and verification are covered by Tasks 1-7.
- Placeholder scan: no unresolved placeholder markers or ellipsis implementation placeholders remain. Locale file paths are explicit.
- Type consistency: backend uses `TeamFileOut`, `UploadUrlRequest`, `UploadUrlResponse`, `PresignedUrlResponse`, `PurgeExpiredResponse`; frontend mirrors `TeamFile`, `FileActivityLog`, and API response shapes.
