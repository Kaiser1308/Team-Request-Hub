# Team Files Explorer Design

## Summary

Add a shared team file explorer to Team Request Hub. The feature is a common file repository for all active members, independent from request workflow. Every active member can browse, search, upload files, create folders, preview supported files, and download files. Only `lead` users can rename, move, delete, restore, and purge files or folders.

The storage backend is an externally hosted MinIO service. FastAPI remains the authority for authentication, authorization, metadata, audit logging, and presigned URL generation. The frontend never receives MinIO credentials.

## Goals

- Provide a dashboard file explorer that behaves like a shared file manager.
- Store file bytes in self-hosted MinIO through presigned upload/download URLs.
- Store file/folder metadata and audit logs in Supabase Postgres.
- Use `@cubone/react-file-manager` as the initial explorer UI shell.
- Enforce role permissions in the backend service layer.
- Support soft delete with a 7-day purge window.
- Support basic search by file/folder name.
- Support safe preview for common images and PDFs.

## Non-Goals

- Per-request attachments.
- Per-folder or per-file ACLs.
- Public share links.
- Version history.
- Multipart/resumable uploads for files larger than 200MB.
- Office document conversion or rich text/HTML/SVG preview.
- Building MinIO into this repository's Docker Compose setup.

## Architecture

The feature follows the existing runtime boundary:

```txt
Browser / Next.js
  -> FastAPI /files APIs with Supabase Bearer JWT
  -> Supabase PostgreSQL metadata + audit logs
  -> External MinIO service via presigned URLs
```

Backend modules follow the existing `routes -> services -> repositories -> Supabase` pattern:

```txt
apps/api/app/routes/files.py
apps/api/app/services/file_service.py
apps/api/app/services/minio_storage.py
apps/api/app/repositories/file_repository.py
apps/api/app/repositories/file_activity_repository.py
apps/api/app/schemas/files.py
```

Frontend modules follow the existing dashboard and API-client pattern:

```txt
apps/web/src/app/(dashboard)/files/page.tsx
apps/web/src/components/files/team-file-explorer.tsx
apps/web/src/hooks/use-files.ts
apps/web/src/lib/api/files.ts
```

## Data Model

Add `team_files` for file/folder metadata:

```txt
id uuid primary key
name text not null
path text not null unique
parent_path text not null
is_directory boolean not null
object_key text null
size_bytes bigint not null default 0
content_type text null
extension text null
status text not null check in pending_upload | active | deleted | purged
uploaded_by uuid null references users(id)
created_by uuid not null references users(id)
updated_by uuid null references users(id)
deleted_by uuid null references users(id)
created_at timestamptz not null
updated_at timestamptz not null
deleted_at timestamptz null
purge_after timestamptz null
```

Add `file_activity_logs` for audit history:

```txt
id uuid primary key
actor_id uuid not null references users(id)
file_id uuid null references team_files(id)
action text not null check in create_folder | upload | complete_upload | rename | move | delete | restore | purge | download | preview
target_type text not null check in file | folder
old_path text null
new_path text null
metadata jsonb not null default '{}'
created_at timestamptz not null
```

Recommended indexes:

```txt
team_files(parent_path, status, name)
team_files(status, purge_after)
team_files(lower(name))
file_activity_logs(file_id, created_at desc)
file_activity_logs(actor_id, created_at desc)
```

RLS must be enabled on both tables as defense in depth. The frontend does not query these tables directly; FastAPI uses the service-role backend client.

## Storage Model

MinIO is configured as an external service via backend-only environment variables:

```txt
MINIO_ENDPOINT
MINIO_REGION
MINIO_BUCKET
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_SECURE
MINIO_PUBLIC_ENDPOINT optional
```

The database path is the user-visible explorer path. The MinIO `object_key` is generated and owned by the backend. Filenames are preserved in metadata for display but are not trusted as raw storage keys.

Folders are virtual prefixes. Folder records are stored in `team_files`; MinIO only stores file objects.

## API Contract

All endpoints require an authenticated, active user unless otherwise noted.

```txt
GET    /files?path=/Design
GET    /files/search?q=logo
POST   /files/folders
POST   /files/upload-url
POST   /files/{file_id}/complete-upload
POST   /files/{file_id}/download-url
POST   /files/{file_id}/preview-url
PATCH  /files/{file_id}/rename
PATCH  /files/{file_id}/move
POST   /files/{file_id}/delete
POST   /files/{file_id}/restore
POST   /files/purge-expired
GET    /files/activity?file_id=...
```

Permissions:

```txt
active fe/be/lead: list, search, create folder, request upload URL, complete upload, download, preview
lead only: rename, move, delete, restore, purge
```

`POST /files/purge-expired` should be implemented as a service endpoint first. It can be triggered manually by a lead in MVP or wired later to a scheduler/internal job token.

## Main Flows

Upload:

```txt
1. Frontend calls POST /files/upload-url with parent path, filename, size, and content type.
2. Backend validates active user, path, name, file size <= 200MB, and conflict rules.
3. Backend creates a pending_upload team_files row and returns a short-lived presigned PUT URL.
4. Browser uploads directly to MinIO.
5. Frontend calls POST /files/{id}/complete-upload.
6. Backend marks the row active and records upload/complete audit logs.
```

Download and preview:

```txt
1. Frontend calls POST /files/{id}/download-url or preview-url.
2. Backend verifies the file is active and the current user is active.
3. Backend returns a short-lived presigned GET URL.
4. Frontend opens or embeds the URL depending on file type.
```

Delete:

```txt
1. Lead calls POST /files/{id}/delete.
2. Backend sets status=deleted, deleted_at, deleted_by, and purge_after=deleted_at + 7 days.
3. For folders, backend applies the same state to descendant rows by path prefix.
4. Backend records audit logs.
5. MinIO objects remain until purge.
```

Purge:

```txt
1. Service selects deleted rows with purge_after <= now().
2. Files with object_key are deleted from MinIO.
3. Metadata is retained with status=purged, object_key cleared, and purge audit logs recorded.
```

## Frontend UX

Add a `Files` item to the dashboard sidebar and render the explorer at `/(dashboard)/files`.

Use `@cubone/react-file-manager` as the initial UI shell:

```txt
files prop <- GET /files or GET /files/search
permissions prop <- derived from current user role
onCreateFolder -> POST /files/folders
onDownload -> POST /files/{id}/download-url
onFileOpen -> navigate folder or preview/download file
onRename -> PATCH /files/{id}/rename
onPaste/onCut -> PATCH /files/{id}/move
onDelete -> POST /files/{id}/delete
onRefresh -> refetch
```

Because presigned upload requires a per-file URL, the implementation may need to hide the library's default upload and provide a custom upload button using the same backend API. The backend contract should not depend on the UI library.

MVP UI capabilities:

- Breadcrumb and folder navigation.
- List/grid browsing.
- Search by file/folder name.
- Upload files up to 200MB.
- Create folders.
- Preview common images and PDFs.
- Download all files.
- Lead-only actions for rename, move, delete, restore, and purge.
- Lead-only trash view or toggle for deleted items within the 7-day restore window.
- Shared loading, empty, and error states.

## Security

- Do not expose MinIO credentials to frontend code.
- Generate short-lived presigned URLs server-side only.
- Validate path and filename on every write action. Reject `..`, absolute paths, double slashes, null/control characters, and unsafe names.
- Enforce file size limit before generating upload URLs.
- Enforce permissions in `file_service.py`; frontend permissions are only usability hints.
- Do not preview SVG, HTML, rich text, or Office files in MVP.
- Use attachment-style download behavior for non-preview files.
- Return 404 for missing/deleted files where appropriate to avoid leaking object existence.
- Keep RLS enabled on new public tables, even though the backend uses service-role access.
- Log upload, complete_upload, create_folder, rename, move, delete, restore, purge, download, and preview actions. MVP writes download and preview logs for every request; sampling can be added later only if audit volume becomes a performance issue.

## Error Handling

Expected API errors:

```txt
400 invalid path, filename, content type, or size
401 missing/invalid auth
403 inactive user or insufficient role
404 file/folder not found or not active
409 path already exists or move/restore conflict
410 deleted item is past restore window
502 MinIO operation failed
```

Frontend should show actionable messages and refetch current folder after successful mutations.

## Testing

Backend unittest coverage:

- Path validation rejects traversal and unsafe names.
- `fe`/`be` users cannot rename, move, delete, restore, or purge.
- Active users can list, search, create folder, request upload URL, complete upload, download, and preview.
- Upload completion only works for pending uploads.
- Delete sets `deleted_at`, `deleted_by`, `purge_after`, and audit logs.
- Folder delete affects descendants.
- Restore handles path conflicts.
- Purge deletes eligible MinIO objects and records audit logs.

Frontend verification:

- `npm run lint` from `apps/web`.
- `npm run build` from `apps/web`.
- Permission props hide lead-only actions for non-leads.
- Upload adapter handles presigned upload success and failure.
- Preview requests are only made for supported preview types.

Backend verification:

- `uv --cache-dir .uv-cache run python -m unittest discover tests` from `apps/api`.
- Import/start check with `uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000` when required env values are available.

## Implementation Notes

- Purged metadata rows are retained with `status=purged` to preserve audit references and prevent path history loss.
- Download and preview audit logs are always written in MVP.
- The frontend should first try the `@cubone/react-file-manager` upload callbacks. If they cannot support per-file presigned URLs cleanly, hide the library upload control and use a custom upload button without changing backend APIs.
