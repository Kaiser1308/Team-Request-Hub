# Team Request Hub Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the existing Next.js frontend boilerplate with `FE_SETUP_TEAM_REQUEST_HUB.md`.

**Architecture:** Keep the frontend as a page-only Next.js App Router app. Supabase is used for Auth/session/realtime only, FastAPI remains the business logic backend, and placeholder pages define the MVP navigation surface.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase SSR/client, TanStack Query v5.

---

## File Structure

- Modify: `AGENTS.md` to make Team Request Hub and `FE_SETUP_TEAM_REQUEST_HUB.md` the active source of truth.
- Modify: `src/app/layout.tsx` to update app metadata.
- Modify: `src/app/(auth)/login/page.tsx` to update placeholder copy.
- Modify: `src/app/(dashboard)/dashboard/page.tsx` and existing placeholder pages for new wording.
- Create: `src/app/(dashboard)/assigned/page.tsx`.
- Create: `src/app/(dashboard)/done/page.tsx`.
- Create: `src/app/(dashboard)/all/page.tsx`.
- Modify: `src/lib/supabase/middleware.ts` to protect the current dashboard route set.
- Modify: `src/lib/api/client.ts` to fail closed when no Supabase access token exists.
- Modify: `src/types/index.ts` to match Team Request Hub types.
- Delete: `src/app/(dashboard)/catalog/page.tsx`.
- Delete: `src/lib/notifications/index.ts` and adapter files.

## Tasks

### Task 1: Source Of Truth And App Identity

- [ ] Update `AGENTS.md` wording from API Request Management Tool to Team Request Hub and remove notification adapter guidance.
- [ ] Update `src/app/layout.tsx` metadata title and description.
- [ ] Update login/dashboard placeholder copy to Team Request Hub wording.

### Task 2: Routes And Middleware

- [ ] Add placeholder pages for `/assigned`, `/done`, and `/all`.
- [ ] Remove `/catalog` placeholder page.
- [ ] Update `protectedRoutes` in `src/lib/supabase/middleware.ts` to include `/assigned`, `/done`, and `/all`, and remove `/catalog`.

### Task 3: API And Types

- [ ] Update `src/lib/api/client.ts` so missing access tokens throw `Unauthorized` before fetch.
- [ ] Replace `interface Request` with `interface InternalRequest` in `src/types/index.ts`.
- [ ] Add `RequestPriority`, `tags`, nullable fields, `cancelled` notification type, and reassignment reason fields.

### Task 4: Remove Conflicting FE Notification Adapter

- [ ] Delete `src/lib/notifications/index.ts`.
- [ ] Delete `src/lib/notifications/adapters/console.ts`.
- [ ] Delete `src/lib/notifications/adapters/discord.ts`.
- [ ] Delete `src/lib/notifications/adapters/telegram.ts`.

### Task 5: Verification

- [ ] Run `npm run lint`; expected result: command exits successfully.
- [ ] Run `npm run build`; expected result: command exits successfully.
- [ ] Confirm prohibited paths are absent: `src/app/api`, `src/lib/supabase/server.ts`, `src/app/(dashboard)/catalog`, `src/lib/notifications`.
