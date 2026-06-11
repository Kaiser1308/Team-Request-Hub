# Design: Standalone Documentation Portal

## Overview
Currently, the documentation portal is located at `apps/web/src/app/(dashboard)/docs/[[...path]]/page.tsx` and inherits the main dashboard layout shell (`AppShell`), which includes the dashboard sidebar and header. 

We want to move the documentation portal to a standalone page that is openable via a new tab from the dashboard navbar, completely bypassing the dashboard AppShell, but maintaining a premium look with its own header and a link to go back to the dashboard.

## Proposed Changes

### 1. Route Path Separation
We will move the Catch-All docs directory out of the `(dashboard)` route group:
- From: `apps/web/src/app/(dashboard)/docs`
- To: `apps/web/src/app/docs`

Since this moves it out of `(dashboard)`, it will no longer use `(dashboard)/layout.tsx` (which contains `AppShell`). Instead, it will inherit the root layout `src/app/layout.tsx`.

### 2. Standalone Docs Layout
We will create a layout file at `apps/web/src/app/docs/layout.tsx` to wrap the documentation pages. It will ensure that next-intl messages and react-query context are available (though they are already provided in the root layout, having a layout file makes it clean for styling/metadata purposes).

### 3. Dedicated Docs Header
We will update `apps/web/src/app/docs/[[...path]]/page.tsx` to include a standalone header component. This header will display:
- **Logo/Title**: `Team Request Hub — Docs`
- **Action Button**: A "Go to Dashboard" button linking back to `/dashboard`.

We will also adjust the height of the main content and sidebar within `page.tsx` to fit perfectly under the new standalone header.

### 4. Dashboard Navbar Link Target
In `apps/web/src/components/app/app-shell.tsx`, we will update the docs navigation link:
- If `item.href === "/docs"`, render the link with `target="_blank"` and `rel="noopener noreferrer"`.
- Keep the current link styling and active state checking.

## Verification Plan
1. Click the "Documentation" link in the dashboard navbar.
2. Verify it opens `/docs` in a new tab.
3. Verify that the opened docs page does not render the dashboard's side navigation or main header.
4. Verify that the docs page has a custom top header with the project title and a "Go to Dashboard" button.
5. Verify that the documentation tree and content load correctly.
6. Verify that clicking "Go to Dashboard" redirects the user to `/dashboard`.
