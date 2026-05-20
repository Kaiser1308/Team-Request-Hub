# Team Request Hub Alignment Design

## Purpose

Align the existing frontend boilerplate with `FE_SETUP_TEAM_REQUEST_HUB.md`. The product is now Team Request Hub, an internal tool for small cross-team requests that need clear tracking. It is no longer API Request Management Tool-specific.

## Scope

- Use `FE_SETUP_TEAM_REQUEST_HUB.md` as the current setup source of truth.
- Keep the app FE-only: Next.js handles pages, Supabase handles Auth/session/realtime, and FastAPI owns business logic.
- Remove old setup artifacts that conflict with the new brief: `/catalog` and frontend notification adapters.
- Add the requested placeholder routes: `/assigned`, `/done`, and `/all`.
- Update middleware protected routes to match the Team Request Hub pages.
- Update metadata and placeholder copy to Team Request Hub.
- Update FE types to use `InternalRequest` instead of `Request` and include priority, tags, nullable assignment/reply fields, and cancellation notification type.
- Update `AGENTS.md` so future agents follow the new brief and constraints.

## Non-Goals

- Do not implement real request business logic.
- Do not create `src/app/api/` or Next.js Route Handlers.
- Do not query Supabase DB directly from FE.
- Do not create `lib/supabase/server.ts`.
- Do not add real notification provider adapters or FE notification secrets.
- Do not install additional packages.

## Security Notes

- Client code only uses `NEXT_PUBLIC_*` values.
- Auth enforcement remains fail-closed for protected dashboard routes by redirecting unauthenticated users to `/login`.
- API calls require an active Supabase access token and fail with `Unauthorized` if no token is present.

## Verification

- Run `npm run lint`.
- Run `npm run build`.
- Confirm there is no `src/app/api/`, no `src/lib/supabase/server.ts`, no `src/app/(dashboard)/catalog`, and no `src/lib/notifications`.
