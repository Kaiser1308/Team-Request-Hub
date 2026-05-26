# File Preview Pane Design

Date: 2026-05-26

## Goal

Add an in-page preview experience to the Files area so team members can browse
shared onboarding and project documents without leaving the app.

The primary use case is storing readable documentation for new team members.
Markdown and HTML files should open as rendered documents, not source text.

## User Experience

The `/files` page uses a split layout on desktop:

- Left pane: folder navigation, search, upload controls, and file list.
- Right pane: selected file preview.

When a user selects a folder, the app navigates into that folder. When a user
selects a file, the right preview pane updates without opening a new browser
tab.

On mobile, the page can collapse into a list-first flow. Selecting a file opens
the preview view with a back action to return to the file list.

## Supported Preview Types

Preview should support:

- Images: `png`, `jpg`, `jpeg`, `gif`, `webp`.
- PDF: `pdf`.
- Markdown: `md`, `markdown`.
- HTML: `html`, `htm`.

Unsupported files should show a compact metadata panel with file name, type,
size, updated timestamp, and a Download action.

## Markdown Rendering

For Markdown files, the frontend requests a presigned preview URL, fetches the
text content, and renders it as readable documentation in the preview pane.

The renderer should support common documentation syntax:

- Headings.
- Paragraphs.
- Ordered and unordered lists.
- Links.
- Inline code.
- Code blocks.
- Blockquotes.
- Tables if the chosen renderer supports them without extra complexity.

The rendered document should follow the existing Team Request Hub visual system:
neutral surfaces, readable typography, compact spacing, and no decorative
marketing treatment.

## HTML Rendering

For HTML files, the frontend requests a presigned preview URL and renders the
document in a sandboxed iframe.

The preview should display the HTML as a real page so onboarding documents can
include layout and styling. The app must not inject uploaded HTML directly into
the React DOM.

The iframe should use a restrictive sandbox. Scripts should remain disabled by
default. If a future requirement needs interactive HTML docs, that should be a
separate explicit security decision.

## Backend Changes

The existing `POST /files/{file_id}/preview-url` endpoint remains the preview
entry point.

Backend preview validation should extend the supported preview type list to
include Markdown and HTML extensions. Validation should work even when uploaded
files have generic browser content types such as `text/plain`, missing content
types, or `application/octet-stream`, as long as the extension is supported.

The API contract should be updated from image/PDF-only preview support to
image/PDF/Markdown/HTML support.

## Frontend Changes

The Files page should stop opening previewable files in a new tab by default.
Instead, file selection stores the selected file in local component state and
renders the appropriate preview panel.

Preview panel states:

- Empty: no file selected.
- Loading: preview URL or text content is loading.
- Rendered: selected file preview is visible.
- Unsupported: metadata and Download action.
- Error: readable error with retry and Download action when possible.

Large text files should not freeze the browser. If a Markdown or HTML file is
too large for comfortable in-browser preview, the panel should show a
file-too-large message and offer Download.

## Security

The frontend must not expose service-role keys or bypass the backend.

Presigned URLs remain short-lived and are obtained through the authenticated
backend API.

Uploaded HTML must run only inside a sandboxed iframe and must not execute
scripts by default.

Markdown rendering should avoid enabling raw HTML unless it is sanitized. The
default should be rendered Markdown, not trusted arbitrary HTML.

## Testing

Backend:

- Unit coverage for preview type detection with `md`, `markdown`, `html`, and
  `htm`.
- Regression coverage that existing image/PDF previews still pass.
- Unsupported extensions still return a preview-not-supported error.

Frontend:

- `npm run lint`.
- `npm run build`.
- Browser verification of the Files page with Markdown, HTML, image/PDF, and an
  unsupported file type.

## Out Of Scope

- Full document versioning.
- Collaborative editing.
- HTML script execution.
- Public/shareable preview links.
- Server-side Markdown or HTML sanitization beyond preview type validation.
