# File Preview Pane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a split-view Files experience where selecting Markdown, HTML, image, or PDF files renders an in-page preview panel instead of opening a new tab.

**Architecture:** Keep the existing authenticated Files API boundary. Extend backend preview type validation, then add a focused frontend preview component that receives a selected `TeamFile`, obtains short-lived preview/download URLs through the existing API hooks, and renders each supported file type in a constrained panel.

**Tech Stack:** FastAPI service functions with `unittest`; Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, TanStack Query mutations, `@cubone/react-file-manager`, and a Markdown renderer dependency such as `react-markdown` with `remark-gfm`.

---

## Scope And References

Read these before implementing:

- `docs/superpowers/specs/2026-05-26-file-preview-pane-design.md`
- `docs/frontend-ui-framework.md`
- `docs/api-contract.md`
- `apps/web/README.md`
- `apps/api/tests/test_file_service_validation.py`
- `apps/api/app/services/file_service.py`
- `apps/web/src/components/files/team-file-explorer.tsx`
- `apps/web/src/hooks/use-files.ts`
- `apps/web/src/lib/api/files.ts`

Before modifying any function, class, or method, run the required GitNexus impact analysis from `AGENTS.md`. At minimum:

```bash
rtk gitnexus impact is_preview_supported --direction upstream
rtk gitnexus impact create_preview_url --direction upstream
```

If GitNexus reports HIGH or CRITICAL risk, stop and report the blast radius before editing.

## File Structure

- Modify `apps/api/tests/test_file_service_validation.py`: add failing coverage for Markdown/HTML preview detection and generic content-type handling.
- Modify `apps/api/app/services/file_service.py`: extend preview whitelist while keeping SVG unsupported.
- Modify `docs/api-contract.md`: document preview support for images, PDF, Markdown, and HTML.
- Modify `apps/web/package.json` and `apps/web/package-lock.json`: add Markdown rendering dependencies if not already present.
- Create `apps/web/src/components/files/file-preview-panel.tsx`: owns preview URL fetching, Markdown text fetching/rendering, sandboxed HTML iframe, PDF/image embeds, unsupported metadata, loading, and error states.
- Modify `apps/web/src/components/files/team-file-explorer.tsx`: store selected file, render split layout, pass file to preview panel, and keep folder navigation behavior.

## Task 1: Backend Preview Type Support

**Files:**

- Modify: `apps/api/tests/test_file_service_validation.py`
- Modify: `apps/api/app/services/file_service.py`

- [ ] **Step 1: Run impact analysis**

Run:

```bash
rtk gitnexus impact is_preview_supported --direction upstream
rtk gitnexus impact create_preview_url --direction upstream
```

Expected: report direct callers and affected flows. Continue only if risk is not HIGH or CRITICAL.

- [ ] **Step 2: Write failing backend tests**

Add these tests to `IsPreviewSupportedTests` in `apps/api/tests/test_file_service_validation.py`:

```python
    def test_markdown_supported_by_extension_with_generic_type(self):
        self.assertTrue(is_preview_supported("text/plain", "md"))
        self.assertTrue(is_preview_supported("application/octet-stream", "markdown"))
        self.assertTrue(is_preview_supported(None, "md"))

    def test_html_supported_by_extension_with_generic_type(self):
        self.assertTrue(is_preview_supported("text/html", "html"))
        self.assertTrue(is_preview_supported("text/plain", "htm"))
        self.assertTrue(is_preview_supported(None, "html"))

    def test_supported_extensions_are_case_insensitive(self):
        self.assertTrue(is_preview_supported("text/plain", "MD"))
        self.assertTrue(is_preview_supported("text/plain", "HTML"))
```

- [ ] **Step 3: Run tests and verify failure**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_file_service_validation.IsPreviewSupportedTests
```

Expected: new Markdown/HTML tests fail because `md`, `markdown`, `html`, and `htm` are not supported yet.

- [ ] **Step 4: Implement preview type support**

In `apps/api/app/services/file_service.py`, replace the current `PREVIEW_TYPES` and `is_preview_supported` implementation with an extension-first design:

```python
PREVIEW_TYPES = {
    ("image/png", "png"), ("image/jpeg", "jpg"), ("image/jpeg", "jpeg"),
    ("image/gif", "gif"), ("image/webp", "webp"), ("application/pdf", "pdf"),
    ("text/markdown", "md"), ("text/markdown", "markdown"),
    ("text/html", "html"), ("text/html", "htm"),
}
PREVIEW_EXTENSIONS = {ext for _, ext in PREVIEW_TYPES}


def is_preview_supported(content_type: str | None, extension: str | None) -> bool:
    normalized_extension = extension.lower() if extension else None
    if normalized_extension in PREVIEW_EXTENSIONS:
        return True
    if content_type:
        for ct, _ in PREVIEW_TYPES:
            if ct == content_type:
                return True
    return False
```

Keep SVG unsupported because `svg` is not in `PREVIEW_EXTENSIONS`.

- [ ] **Step 5: Run backend preview validation tests**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest tests.test_file_service_validation.IsPreviewSupportedTests
```

Expected: all `IsPreviewSupportedTests` pass.

- [ ] **Step 6: Run full backend test suite**

Run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
```

Expected: all backend tests pass.

- [ ] **Step 7: Commit backend support**

Run:

```bash
git add apps/api/tests/test_file_service_validation.py apps/api/app/services/file_service.py
git commit -m "feat: support document file previews"
```

## Task 2: API Documentation

**Files:**

- Modify: `docs/api-contract.md`

- [ ] **Step 1: Update preview API contract**

In `docs/api-contract.md`, update the Files section line that currently says preview is supported only for images and PDF. Replace it with:

```txt
`POST /files/{file_id}/preview-url` — get a presigned preview URL. Supported for images (png, jpg, jpeg, gif, webp), PDF, Markdown (md, markdown), and HTML (html, htm).
```

- [ ] **Step 2: Review docs diff**

Run:

```bash
git diff -- docs/api-contract.md
```

Expected: only preview support wording changed.

- [ ] **Step 3: Commit docs update**

Run:

```bash
git add docs/api-contract.md
git commit -m "docs: document file preview formats"
```

## Task 3: Markdown Dependency

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`

- [ ] **Step 1: Install renderer packages**

Run from `apps/web`:

```bash
npm install react-markdown remark-gfm
```

Expected: `package.json` and `package-lock.json` include `react-markdown` and `remark-gfm`.

- [ ] **Step 2: Confirm dependency diff**

Run:

```bash
git diff -- apps/web/package.json apps/web/package-lock.json
```

Expected: dependency-only changes for Markdown rendering packages.

- [ ] **Step 3: Commit dependency update**

Run:

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore: add markdown preview renderer"
```

## Task 4: File Preview Panel Component

**Files:**

- Create: `apps/web/src/components/files/file-preview-panel.tsx`

- [ ] **Step 1: Create the preview component**

Create `apps/web/src/components/files/file-preview-panel.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PresignedUrlResponse } from "@/lib/api/files";
import type { TeamFile } from "@/types";

const MAX_TEXT_PREVIEW_BYTES = 1_000_000;

type PreviewKind = "image" | "pdf" | "markdown" | "html" | "unsupported";

interface FilePreviewPanelProps {
  file: TeamFile | null;
  getPreviewUrl: (fileId: string) => Promise<PresignedUrlResponse>;
  getDownloadUrl: (fileId: string) => Promise<PresignedUrlResponse>;
}

function extensionOf(file: TeamFile) {
  return file.extension?.toLowerCase() ?? "";
}

function getPreviewKind(file: TeamFile): PreviewKind {
  const extension = extensionOf(file);
  if (file.content_type?.startsWith("image/") && extension !== "svg") return "image";
  if (file.content_type === "application/pdf" || extension === "pdf") return "pdf";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "html" || extension === "htm") return "html";
  return "unsupported";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilePreviewPanel({ file, getPreviewUrl, getDownloadUrl }: FilePreviewPanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const retryKey = useMemo(() => `${file?.id ?? "empty"}:${file?.updated_at ?? ""}`, [file]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setPreviewUrl(null);
      setDownloadUrl(null);
      setTextContent(null);
      setError(null);

      if (!file || file.is_directory) return;

      const kind = getPreviewKind(file);
      setIsLoading(true);

      try {
        const download = await getDownloadUrl(file.id);
        if (!cancelled) setDownloadUrl(download.url);

        if (kind === "unsupported") return;
        if ((kind === "markdown" || kind === "html") && file.size_bytes > MAX_TEXT_PREVIEW_BYTES) {
          throw new Error("File is too large to preview in the browser.");
        }

        const preview = await getPreviewUrl(file.id);
        if (cancelled) return;
        setPreviewUrl(preview.url);

        if (kind === "markdown" || kind === "html") {
          const response = await fetch(preview.url);
          if (!response.ok) throw new Error(`Preview request failed with ${response.status}`);
          const content = await response.text();
          if (!cancelled) setTextContent(content);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load preview.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [file, getDownloadUrl, getPreviewUrl, retryKey]);

  if (!file) {
    return (
      <aside className="flex min-h-[420px] items-center justify-center rounded-lg border border-[#e5e7eb] bg-white p-6 text-center">
        <div>
          <FileText className="mx-auto mb-3 h-8 w-8 text-[#9ca3af]" />
          <h2 className="text-section-title text-[#111827]">Select a file</h2>
          <p className="mt-1 text-caption text-[#6b7280]">Markdown, HTML, images, and PDFs preview here.</p>
        </div>
      </aside>
    );
  }

  const kind = getPreviewKind(file);

  return (
    <aside className="flex min-h-[520px] flex-col rounded-lg border border-[#e5e7eb] bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-[#e5e7eb] px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-section-title text-[#111827]">{file.name}</h2>
          <p className="text-caption text-[#6b7280]">{formatBytes(file.size_bytes)} · {file.extension || "file"}</p>
        </div>
        {downloadUrl ? (
          <Button asChild variant="outline" size="sm">
            <a href={downloadUrl} target="_blank" rel="noreferrer">
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          </Button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {isLoading ? <p className="text-caption text-[#6b7280]">Loading preview...</p> : null}

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <Button className="mt-3" size="sm" variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </div>
        ) : null}

        {!isLoading && !error && kind === "unsupported" ? (
          <div className="rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
            <h3 className="text-card-title text-[#111827]">Preview unavailable</h3>
            <p className="mt-1 text-caption text-[#6b7280]">This file type can be downloaded but not previewed.</p>
          </div>
        ) : null}

        {!isLoading && !error && kind === "image" && previewUrl ? (
          <img src={previewUrl} alt={file.name} className="max-h-[70vh] w-full object-contain" />
        ) : null}

        {!isLoading && !error && kind === "pdf" && previewUrl ? (
          <iframe title={file.name} src={previewUrl} className="h-[70vh] w-full rounded-md border border-[#e5e7eb]" />
        ) : null}

        {!isLoading && !error && kind === "markdown" && textContent ? (
          <div className="prose prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{textContent}</ReactMarkdown>
          </div>
        ) : null}

        {!isLoading && !error && kind === "html" && textContent ? (
          <iframe
            title={file.name}
            sandbox=""
            srcDoc={textContent}
            className="h-[70vh] w-full rounded-md border border-[#e5e7eb] bg-white"
          />
        ) : null}
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Run frontend lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: lint may fail if Tailwind typography classes require `@tailwindcss/typography` or if `img` triggers Next lint. If so, replace `prose` classes with local Tailwind element classes and replace `img` only if lint requires it.

- [ ] **Step 3: Commit preview component**

Run:

```bash
git add apps/web/src/components/files/file-preview-panel.tsx
git commit -m "feat: add file preview panel"
```

## Task 5: Integrate Preview Panel Into Files Page

**Files:**

- Modify: `apps/web/src/components/files/team-file-explorer.tsx`

- [ ] **Step 1: Run impact analysis**

Run:

```bash
rtk gitnexus impact TeamFileExplorer --direction upstream
```

Expected: report direct route/component callers. Continue only if risk is not HIGH or CRITICAL.

- [ ] **Step 2: Update imports**

In `apps/web/src/components/files/team-file-explorer.tsx`, add:

```tsx
import { FilePreviewPanel } from "@/components/files/file-preview-panel";
```

- [ ] **Step 3: Add selected file state**

Inside `TeamFileExplorer`, near the existing local state declarations, add:

```tsx
  const [selectedFile, setSelectedFile] = useState<TeamFile | null>(null);
```

- [ ] **Step 4: Replace open-file behavior**

Replace the existing `openFile` function with:

```tsx
  async function openFile(file: CuboneFile) {
    if (file.isDirectory) {
      return;
    }
    const sourceFile = (treeQuery.data ?? []).find((item) => item.id === file.id);
    if (sourceFile) {
      setSelectedFile(sourceFile);
      return;
    }
    const response = await mutations.downloadUrl.mutateAsync(file.id);
    window.open(response.url, "_blank", "noopener,noreferrer");
  }
```

Keep `onDownload` using the same function only if the desired behavior is preview-first. If explicit download should always download, add a separate `downloadFile` function:

```tsx
  async function downloadFile(file: CuboneFile) {
    if (file.isDirectory) return;
    const response = await mutations.downloadUrl.mutateAsync(file.id);
    window.open(response.url, "_blank", "noopener,noreferrer");
  }
```

Then wire `onDownload` to `downloadFile`.

- [ ] **Step 5: Change layout to split view**

Wrap the current file manager card and preview panel in this responsive grid:

```tsx
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,42%)]">
        <div
          ref={fileManagerRef}
          tabIndex={-1}
          className="relative min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-2 outline-none"
          onDrop={handleNativeDrop}
          onDragOver={handleNativeDragOver}
          onDragEnter={() => {
            dragCounterRef.current += 1;
            setIsDragOver(true);
          }}
          onDragLeave={() => {
            dragCounterRef.current -= 1;
            if (dragCounterRef.current === 0) setIsDragOver(false);
          }}
        >
          {/* existing drag overlay and FileManager stay here */}
        </div>

        <FilePreviewPanel
          file={selectedFile}
          getPreviewUrl={mutations.previewUrl.mutateAsync}
          getDownloadUrl={mutations.downloadUrl.mutateAsync}
        />
      </div>
```

- [ ] **Step 6: Clear preview when selected file leaves the loaded tree**

Add an effect after `treeQuery` data is available:

```tsx
  useEffect(() => {
    if (!selectedFile) return;
    const stillExists = (treeQuery.data ?? []).some((file) => file.id === selectedFile.id);
    if (!stillExists) setSelectedFile(null);
  }, [selectedFile, treeQuery.data]);
```

- [ ] **Step 7: Run frontend checks**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 8: Commit integration**

Run:

```bash
git add apps/web/src/components/files/team-file-explorer.tsx
git commit -m "feat: preview files in split view"
```

## Task 6: Browser Verification

**Files:**

- No source file changes expected unless verification finds a bug.

- [ ] **Step 1: Start the frontend dev server**

Run from `apps/web`:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Next.js dev server starts and prints a local URL.

- [ ] **Step 2: Verify the Files page manually**

Open the local app in the browser and verify:

- `/files` renders a left file list and right preview panel on desktop.
- Selecting a Markdown file renders formatted documentation.
- Selecting an HTML file renders in the preview iframe.
- Selecting an image or PDF renders in the panel.
- Selecting an unsupported file shows metadata and Download.
- Download action still opens a presigned URL.
- Narrow viewport remains usable.

- [ ] **Step 3: Fix any verification defects**

If a defect appears, make the smallest focused fix in the relevant file, rerun:

```bash
npm run lint
npm run build
```

Expected: both pass after the fix.

- [ ] **Step 4: Final backend/frontend verification**

Run:

```bash
cd apps/api
uv --cache-dir .uv-cache run python -m unittest discover tests
cd ..\web
npm run lint
npm run build
```

Expected: backend tests, frontend lint, and frontend build pass.

- [ ] **Step 5: Run GitNexus change detection before final commit or handoff**

Run from repo root:

```bash
rtk gitnexus detect-changes
```

Expected: changed symbols and flows match file preview support only.

## Self-Review

Spec coverage:

- Split view covered by Task 5.
- Markdown rendered preview covered by Tasks 3 and 4.
- HTML sandboxed iframe covered by Task 4.
- Backend preview whitelist covered by Task 1.
- API docs covered by Task 2.
- Loading, empty, unsupported, and error states covered by Task 4.
- Verification covered by Task 6.

Placeholder scan:

- The plan uses concrete file paths, commands, and code snippets for each task.

Type consistency:

- `TeamFile`, `PresignedUrlResponse`, and mutation signatures match `apps/web/src/types/index.ts`, `apps/web/src/lib/api/files.ts`, and `apps/web/src/hooks/use-files.ts`.
