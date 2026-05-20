# AGENTS.md

## Scope
- This file is scoped to `apps/web`; the repository root `AGENTS.md` has the cross-app instructions.
- Run frontend commands from `apps/web`, not from the repository root.
- Before planning or coding frontend work, read `../../docs/frontend-ui-framework.md`.
- For phase work, also read `../../docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md` and the phase-specific plan if one exists.

## Commands
- Package manager is npm; this app has `package-lock.json` and no pnpm/yarn/bun lockfile.
- Verified scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.

## App Stack
- Current app stack: Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase, TanStack Query v5, shadcn/ui with Slate theme.
- Route groups are `src/app/(auth)` for login and `src/app/(dashboard)` for protected pages.
- Supabase clients live under `src/lib/supabase/`; FE uses Supabase only for Auth/session handling and Realtime listeners.
- FE calls the FastAPI backend in `../api` through `src/lib/api/client.ts` using `NEXT_PUBLIC_API_URL`.

## UI Framework
- `../../ui-frameware/` is visual reference only: screenshots and static HTML for design intent.
- Do not copy `ui-frameware` HTML, Tailwind CDN config, Material Symbols, inline scripts, external images, hard-coded demo data, or decorative background effects into `apps/web`.
- Rebuild screens as React components using Tailwind v4, shadcn/ui, lucide icons, TanStack Query hooks, and `src/lib/api/client.ts`.
- Follow `../../docs/frontend-ui-framework.md` for route mapping, component boundaries, design tokens, role-based actions, loading/error/empty states, and API module names.

## Gotchas
- Do not create `src/app/api/` or Next.js Route Handlers; business logic belongs in `apps/api`.
- Do not query Supabase DB directly from the FE. FE uses Supabase for Auth/session handling and Realtime only.
- Do not create notification provider adapters or provider secrets in FE; real notifications belong in `apps/api`.
- `.env.local` is for local values and should stay uncommitted; `.env.example` documents required public keys.
- Trust `package.json`, `src/app`, `README.md`, the root `AGENTS.md`, and `../../docs/frontend-ui-framework.md` for repo-specific guidance.
