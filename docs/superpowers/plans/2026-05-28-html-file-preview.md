# HTML File Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable `.html` and `.htm` files to preview inside the existing team file explorer preview panel.

**Architecture:** The backend already supports authenticated HTML text preview through `GET /files/{file_id}/preview-content`. The frontend will extend the existing `FilePreviewPanel` classification and text-content loading path, then render HTML inside a sandboxed iframe using `srcDoc`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, existing `getPreviewContent` API client, existing file explorer components.

---

## File Structure

- Modify: `apps/web/src/components/files/file-preview-panel.tsx`
  - Responsibility: decide file preview type, load preview data, and render the selected file in the preview panel.
- No backend changes required.
- No new dependencies required.

## Task 1: Add HTML Classification And Loading

**Files:**
- Modify: `apps/web/src/components/files/file-preview-panel.tsx`

- [ ] **Step 1: Run impact analysis before editing**

Run GitNexus impact for the component symbol:

```txt
gitnexus_impact({
  target: "FilePreviewPanel",
  direction: "upstream",
  file_path: "apps/web/src/components/files/file-preview-panel.tsx",
  kind: "Function",
  repo: "Team-Request-Hub"
})
```

Expected: low blast radius, with `TeamFileExplorer` as the direct caller. If risk is HIGH or CRITICAL, stop and report before editing.

- [ ] **Step 2: Update preview kind and extension classification**

In `apps/web/src/components/files/file-preview-panel.tsx`, change the preview type and classifier to include HTML:

```tsx
type PreviewKind = "image" | "pdf" | "markdown" | "html" | "unsupported";

function getPreviewKind(file: TeamFile): PreviewKind {
  const extension = extensionOf(file);
  if (file.content_type?.startsWith("image/") && extension !== "svg") return "image";
  if (file.content_type === "application/pdf" || extension === "pdf") return "pdf";
  if (extension === "md" || extension === "markdown") return "markdown";
  if (extension === "html" || extension === "htm") return "html";
  return "unsupported";
}
```

- [ ] **Step 3: Reuse text preview fetch for HTML**

In `loadPreview`, change the Markdown-only branch to handle both text preview kinds:

```tsx
if (kind === "markdown" || kind === "html") {
  if (file.size_bytes > MAX_TEXT_PREVIEW_BYTES) {
    throw new Error("File is too large to preview in the browser.");
  }
  if (!getPreviewContent) {
    throw new Error("Preview service is temporarily unavailable. Please refresh the page.");
  }
  const content = await getPreviewContent(file.id);
  if (!cancelled) {
    setTextContent(content);
    setIsLoading(false);
  }
  return;
}
```

- [ ] **Step 4: Render HTML in a sandboxed iframe**

After the existing PDF render block and before the Markdown render block, add:

```tsx
{!isLoading && !error && kind === "html" && textContent ? (
  <iframe
    title={file.name}
    sandbox=""
    srcDoc={textContent}
    className="h-[70vh] w-full rounded-md border border-[#e5e7eb] bg-white"
  />
) : null}
```

- [ ] **Step 5: Confirm no unsafe HTML injection was added**

Search the edited file for unsafe DOM injection:

```txt
dangerouslySetInnerHTML
```

Expected: no matches in `apps/web/src/components/files/file-preview-panel.tsx`.

- [ ] **Step 6: Run frontend lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command completes successfully with no lint errors.

- [ ] **Step 7: Run frontend build**

Run from `apps/web`:

```bash
npm run build
```

Expected: command completes successfully and Next.js production build passes.

- [ ] **Step 8: Detect changed execution flows before any commit**

Run GitNexus change detection:

```txt
gitnexus_detect_changes({
  scope: "all",
  repo: "Team-Request-Hub"
})
```

Expected: changed symbols are limited to the spec/plan docs and `FilePreviewPanel`. Affected flow should be the file preview UI path.

- [ ] **Step 9: Optional commit if requested by the user**

Only commit if the user explicitly asks. If committing, inspect status, diff, and recent log first, then stage only intended files:

```bash
git status --short
git diff -- docs/superpowers/specs/2026-05-28-html-file-preview-design.md docs/superpowers/plans/2026-05-28-html-file-preview.md apps/web/src/components/files/file-preview-panel.tsx
git log --oneline -10
git add docs/superpowers/specs/2026-05-28-html-file-preview-design.md docs/superpowers/plans/2026-05-28-html-file-preview.md apps/web/src/components/files/file-preview-panel.tsx
git commit -m "feat(web): add html file preview"
```

Expected: commit succeeds with only intended files included.
