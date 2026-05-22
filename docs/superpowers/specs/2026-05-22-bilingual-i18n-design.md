# Bilingual I18n Design

## Purpose

Team Request Hub should support both Vietnamese and English in the frontend UI. Vietnamese is the default language because the app is intended for internal use by a Vietnamese-speaking team, while English remains available for users who prefer it.

## Scope

This design covers the first bilingual phase for `apps/web` only.

Included:

- Frontend UI text: navigation, page titles, buttons, labels, helper text, table headers, dialog text, filter options, empty states, loading states, and frontend-generated errors.
- Enum display labels for roles, request statuses, request priorities, notification labels, and request actions.
- A language switcher in the authenticated app shell.
- Locale persistence across reloads.

Excluded from this phase:

- Changing backend API contracts.
- Translating backend-owned raw error messages.
- Translating user-generated content such as request titles, descriptions, done replies, names, or comments.
- Locale-specific URLs such as `/vi/dashboard` or `/en/dashboard`.

## User Experience

The app keeps the current route structure. Users continue to visit routes such as `/dashboard`, `/requests`, and `/admin/users` without a locale prefix.

Vietnamese is selected by default on first visit. A compact language switcher appears in the app topbar, near the current user controls. The switcher offers `Tiếng Việt` and `English`. When a user changes language, the current page updates in place and the choice persists for future reloads.

The app should set the document language to the active locale where practical so assistive technology can interpret the page correctly.

## Recommended Approach

Use `next-intl` with cookie-backed locale selection and no localized routing.

Reasons:

- It fits the Next.js App Router stack already used by `apps/web`.
- It works cleanly with client components, which make up much of the current UI.
- It avoids route churn and reduces risk around Supabase auth middleware and callback routes.
- It supports interpolation and structured message namespaces without building custom translation plumbing.

## Alternatives Considered

### Raw `i18next` / `react-i18next`

This is flexible and familiar, but it would require more custom integration for App Router, providers, SSR behavior, and hydration. It is not the smallest safe change for this app.

### Custom Dictionary Helper

This has the fewest dependencies, but it would likely grow ad hoc support for interpolation, namespaces, missing keys, and client/server usage. That increases maintenance risk as the UI grows.

## Architecture

Add frontend-only i18n files under `apps/web/src`:

```txt
src/i18n/
  config.ts
  messages/
    en.json
    vi.json
```

The config defines supported locales:

```txt
default locale: vi
supported locales: vi, en
cookie name: trh-locale
```

The root layout wraps the app in the `next-intl` provider using messages for the active locale. Client components use the translation hook instead of hard-coded UI strings.

Messages are grouped by namespace:

```txt
common
nav
auth
dashboard
requests
notifications
admin
errors
```

Keep API data values unchanged. For example, request status remains `in_progress` in API payloads and is translated only at render time.

## Components

Add a small `LanguageSwitcher` component under `src/components/app/`. It should:

- Show the current locale.
- Let users switch between Vietnamese and English.
- Persist the selected locale in the `trh-locale` cookie.
- Refresh or re-render the current page after locale change without navigating to a different route.

Update existing UI components incrementally but completely for the first phase:

- `AppShell` navigation and topbar labels.
- Auth screens and auth buttons.
- Dashboard labels and summary cards.
- Request list, cards, filters, form, detail view, timelines, badges, and action dialogs.
- Notification list labels and states.
- Admin users page and role table.
- Shared loading, empty, error, and page header components.

## Error Handling

Frontend-generated errors should use translated messages from the `errors` namespace.

Backend error payloads should remain unchanged in this phase. If a backend response contains a specific message, the frontend can continue to display it as-is. This avoids inaccurate translation of technical or workflow-specific errors until the backend exposes stable error codes.

Missing translation keys should be treated as development issues. During implementation, lint/build should catch TypeScript issues, and manual review should check for visible fallback keys.

## Testing And Verification

Run available frontend checks from `apps/web`:

```bash
npm run lint
npm run build
```

Manual verification should cover:

- First visit defaults to Vietnamese.
- Switching to English updates visible UI text.
- Reload preserves the selected language.
- Existing routes still work without locale prefixes.
- Supabase login and auth callback continue to work.
- Dashboard, request list, request detail, new request, notifications, and admin users pages render translated labels.
- API values are not mutated when rendering translated labels.

## Implementation Notes

The implementation should avoid broad unrelated refactors. Convert hard-coded strings where they are rendered, add small helper functions only for repeated enum label translation, and keep business logic unchanged.

Do not add frontend business rules, Supabase database queries, or backend notification/provider logic as part of this work.
