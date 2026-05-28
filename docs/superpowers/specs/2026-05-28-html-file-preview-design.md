# HTML File Preview Design

## Goal

Add in-app preview support for uploaded `.html` and `.htm` files in the team file explorer.

The project already supports Markdown previews through authenticated text content loading. HTML should reuse that path instead of opening an unauthenticated or less-controlled storage URL directly.

## Current Root Cause

The backend file preview contract and service already support HTML text preview:

- `GET /files/{file_id}/preview-content` supports `md`, `markdown`, `html`, and `htm`.
- `apps/api/app/services/file_service.py` treats `html` and `htm` as text preview extensions.

The frontend preview panel only classifies files as `image`, `pdf`, `markdown`, or `unsupported`. Because `.html` and `.htm` are not classified, they fall into the unsupported state and never call `getPreviewContent`.

## Approach

Extend `apps/web/src/components/files/file-preview-panel.tsx` only:

- Add `html` to the preview kind union.
- Classify `.html` and `.htm` extensions as `html`.
- Reuse the existing text preview loading path for both Markdown and HTML.
- Keep the current 1 MB browser preview limit for HTML.
- Render HTML with an iframe using `srcDoc={textContent}`.
- Keep the download action unchanged.

## Security

HTML is user-uploaded content, so it must not be injected into the React DOM.

The preview iframe will use an empty `sandbox` attribute. This intentionally disables scripts, form submission, popups, top navigation, and same-origin access. This may prevent some interactive HTML files from working, but it is the safer default for uploaded team files.

The implementation will not use `dangerouslySetInnerHTML` and will not fetch arbitrary external URLs from the server.

## User Experience

HTML previews appear in the same right-side preview panel as Markdown, images, and PDFs.

States remain consistent with the current panel:

- Loading while preview content is fetched.
- Retry button on fetch/render loading errors.
- Unsupported state for other file types.
- Download button when a download URL is available.

## Verification

Frontend verification:

- Run `npm run lint` from `apps/web`.
- Run `npm run build` from `apps/web`.

Manual verification target:

- Upload or select an `.html`/`.htm` file.
- Confirm the preview panel renders it in an iframe instead of showing unsupported.
- Confirm scripts inside uploaded HTML do not execute because the iframe is sandboxed.
