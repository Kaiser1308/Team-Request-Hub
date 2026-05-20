# AGENTS.md

## Current State
- Repo root is now the Next.js frontend app for Team Request Hub.
- There is no active generated app worktree. Do app work in the repo root unless the user explicitly asks for a separate worktree.
- This repository is FE-only. The FastAPI backend is expected to live in a separate repository.

## Source Of Truth
- `FE_SETUP_TEAM_REQUEST_HUB.md` is the current user-provided setup brief for Team Request Hub.
- `tasks.md` is the earlier setup brief and is superseded where it conflicts with `FE_SETUP_TEAM_REQUEST_HUB.md`.
- `docs/superpowers/specs/2026-05-19-team-request-hub-alignment-design.md` and `docs/superpowers/plans/2026-05-19-team-request-hub-alignment.md` describe the current Team Request Hub alignment scope.
- Trust executable files in the repo root over prose if they disagree.

## App Stack
- Current app stack: Next.js 15 App Router, TypeScript, Tailwind CSS, Supabase, TanStack Query v5, shadcn/ui with Slate theme.
- Route groups are `src/app/(auth)` for login and `src/app/(dashboard)` for protected pages.
- Supabase clients live under `src/lib/supabase/`; FE uses Supabase only for Auth/session handling and Realtime listeners.
- FE calls the separate FastAPI backend through `src/lib/api/client.ts` using `NEXT_PUBLIC_API_URL`.

## Commands
- Run app commands from the repo root.
- Verified scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.
- Package manager is npm; the repo has `package-lock.json` and no pnpm/yarn/bun lockfile.

## Gotchas
- Do not create `src/app/api/` or Next.js Route Handlers; business logic belongs in the separate FastAPI backend.
- Do not query Supabase DB directly from the FE. FE uses Supabase for Auth/session handling and Realtime only.
- Do not create `src/lib/supabase/server.ts` in this FE setup.
- Do not create notification provider adapters or provider secrets in FE; real notifications belong in the FastAPI backend.
- `.env.local` is for local values and should stay uncommitted; `.env.example` documents required public keys.
- The generated README may reference generic Next.js starter instructions; this project uses `src/app/page.tsx` and route groups under `src/app/`.
