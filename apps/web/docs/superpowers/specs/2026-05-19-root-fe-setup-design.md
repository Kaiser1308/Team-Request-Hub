# Root FE Setup Design

## Goal

Set up the frontend project in the repository root using the stack from `tasks.md`, but keep scope limited to technology installation and folder architecture.

## Scope

- Create a Next.js 15 App Router app in the repo root.
- Use TypeScript, Tailwind CSS, `src/` directory, and `@/*` import alias.
- Install Supabase client packages, TanStack Query v5, React Query Devtools, and shadcn/ui with the Slate theme.
- Add shadcn/ui components listed in `tasks.md`.
- Create the requested folder structure under `src/`.
- Add lightweight placeholder files only where needed so imports and builds do not fail.

## Non-Goals

- No business logic implementation.
- No real request flow, dashboard data, catalog logic, or notification provider integration.
- No Next.js Route Handlers and no `src/app/api/` directory.
- No direct Supabase DB queries from the frontend.
- No packages outside the list in `tasks.md` unless required by the selected scaffolding tool.

## Architecture

The app will keep all frontend code in `src/`:

- `src/app/(auth)/login` for the login route placeholder.
- `src/app/(dashboard)` for protected dashboard route placeholders.
- `src/lib/supabase` for browser client and middleware session refresh helpers.
- `src/lib/api` for the FastAPI fetch wrapper skeleton.
- `src/lib/notifications` for the adapter abstraction and placeholder adapters.
- `src/providers` for TanStack Query provider setup.
- `src/types` for shared domain types.
- `src/components/ui` for shadcn-generated components.
- `src/components/shared` for future shared app components.

## Verification

Run `npm run lint` and, if dependencies install successfully, `npm run build` from the repository root.
