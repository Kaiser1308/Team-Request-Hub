# AGENTS.md

## Repo Shape
- This is a two-app repo, not a configured workspace: `apps/web` is the Next.js frontend and `apps/api` is the FastAPI backend. There is no root `package.json`, workspace file, or root test runner.
- Root `docs/*.md` contain active project guidance. Read the relevant docs before planning or coding, especially `docs/architecture.md`, `docs/api-contract.md`, `docs/database-schema.md`, `docs/permissions.md`, and `docs/frontend-ui-framework.md`.
- `docker-compose.yml` is only a placeholder and defines no services.

## Planning And Handoff
- Product roadmap: `docs/superpowers/plans/2026-05-20-team-request-hub-product-roadmap.md`.
- Master implementation plan: `docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md`.
- Before executing any phase, create a phase-specific plan under `docs/superpowers/plans/YYYY-MM-DD-phase-N-<phase-name>-detail.md`.
- For frontend phases, read `docs/frontend-ui-framework.md` before creating the phase plan and before coding.

## Frontend (`apps/web`)
- Use npm from `apps/web`; `package-lock.json` is the only JS lockfile.
- Commands: `npm install`, `npm run dev`, `npm run lint`, `npm run build`, `npm run start`.
- Stack: Next.js 15 App Router, React 19, TypeScript strict mode, Tailwind CSS v4, shadcn/ui with Slate base color, TanStack Query v5, Supabase SSR/browser clients.
- Path alias is `@/* -> src/*`; routes live under `src/app`, including `(auth)` and `(dashboard)` route groups.
- Frontend Supabase usage is for Auth/session middleware only; call the backend through `src/lib/api/client.ts` with `NEXT_PUBLIC_API_URL` and a Bearer JWT. Do not put business logic, service-role keys, or notification providers in the frontend.
- Treat `ui-frameware/` as visual reference only. Do not copy its static HTML/CDN setup into the app; rebuild with React components according to `docs/frontend-ui-framework.md`.
- Required local env keys are documented in `apps/web/.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.

## Backend (`apps/api`)
- Use `uv` from `apps/api` so `pydantic-settings` loads the local `.env` file and dependencies stay isolated in `.venv`.
- Setup/run: `uv --cache-dir .uv-cache venv`, `uv --cache-dir .uv-cache pip install -r requirements.txt`, `uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000`.
- API entrypoint is `app/main.py`; routers are mounted at `/health`, `/users`, `/requests`, and `/notifications`.
- Supabase service-role access is backend-only via `app/db/supabase.py`; never expose `SUPABASE_SERVICE_ROLE_KEY` to `apps/web`.
- Auth verifies Supabase JWTs in `app/core/auth.py`, then loads the profile from the `users` table. Permission rules live in `app/core/permissions.py` and use roles `fe`, `be`, and `lead`.
- Backend architecture is `routes -> services -> repositories -> Supabase`; routes stay thin, services own workflow rules, repositories own table access.
- Request business rules are implemented in backend services, including assignment, status transitions, done replies, cancellation, notification records, assignment history, and status logs.
- New users default to role `fe`; only `lead` users can update roles through `PATCH /users/{user_id}/role`.
- Required backend env keys are in `apps/api/.env.example`; `CORS_ORIGINS` defaults to `http://localhost:3000`.

## Verification Notes
- No CI workflow, backend test runner, frontend test script, formatter script, or root typecheck command is configured yet.
- For frontend changes, use `npm run lint` and usually `npm run build` from `apps/web` as the available checks.
- For backend changes, run `uv --cache-dir .uv-cache run python -m unittest discover tests` and at minimum start/import-check with `uv --cache-dir .uv-cache run uvicorn app.main:app --reload --port 8000` from `apps/api` when env values are available.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Team-Request-Hub** (2479 symbols, 4131 relationships, 143 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Team-Request-Hub/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Team-Request-Hub/clusters` | All functional areas |
| `gitnexus://repo/Team-Request-Hub/processes` | All execution flows |
| `gitnexus://repo/Team-Request-Hub/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
