# Team Request Hub Web

Next.js frontend for Team Request Hub.

## Stack

```txt
Next.js 15 App Router
React 19
TypeScript strict mode
Tailwind CSS v4
shadcn/ui
TanStack Query v5
Supabase SSR/browser clients
```

## Commands

Run from `apps/web`:

```bash
npm install
npm run dev
npm run lint
npm run build
npm run start
```

## Environment

Required public env keys are documented in `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=
```

## Frontend Architecture

```txt
src/app/
  (auth)/login/          login route placeholder
  (dashboard)/           protected app routes
  page.tsx               redirects to /dashboard

src/lib/
  api/client.ts          FastAPI client with Supabase Bearer JWT
  supabase/client.ts     browser Supabase client
  supabase/middleware.ts session refresh and route protection

src/providers/
  query-provider.tsx     TanStack Query provider

src/types/
  index.ts               shared FE domain types

src/components/
  ui/                    shadcn/ui components
```

## UI Framework

Read the project UI framework before implementing frontend screens:

```txt
../../docs/frontend-ui-framework.md
```

The static files in `../../ui-frameware/` are visual reference only. Do not copy
their HTML, Tailwind CDN setup, Material Symbols, inline scripts, external
images, or hard-coded demo data. Rebuild screens as React components with
Tailwind v4, shadcn/ui, lucide icons, TanStack Query hooks, and `apiFetch`.

## Auth Boundary

Supabase is used in the frontend for Auth/session handling only.

```txt
Browser signs in with Supabase Auth
Supabase stores session cookies
Middleware redirects unauthenticated users to /login
apiFetch gets the Supabase access token
apiFetch calls FastAPI with Authorization: Bearer <token>
```

Business logic, permission checks, notifications, assignment history, status
logs, and service-role database access belong in `apps/api`.

## Current State

The frontend is still a skeleton:

```txt
- /login is a placeholder and does not yet call Google OAuth.
- Dashboard/request pages are placeholders.
- apiFetch is ready to call the backend once UI flows are implemented.
- Middleware already protects dashboard routes.
```

Do not create `src/app/api/` route handlers for product business logic. Call the
FastAPI backend through `src/lib/api/client.ts`.
