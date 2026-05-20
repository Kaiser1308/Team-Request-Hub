# Phase 2 Auth UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the login placeholder with a working Google OAuth login button, add a current-user API client and React Query hook, and add a logout button — so that the auth flow is real end-to-end and the dashboard layout can access the current user.

**Architecture:** Frontend uses Supabase browser client for OAuth (Google provider only). After login, the middleware session is valid, and `apiFetch` in `src/lib/api/client.ts` sends the Bearer JWT to the FastAPI backend. The backend `/users/me` endpoint returns the current user with role. The FE uses a TanStack Query hook to load this once and share it across components.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui Button component (already exists at `src/components/ui/button.tsx`), TanStack Query v5, Supabase SSR/browser clients (already wired at `src/lib/supabase/`).

**Design Reference:** `ui-frameware/` contains Figma-exported HTML mockups for the full app. Phase 2 only uses the login screen design. The design system ("Cinematic Precision", Apple-inspired) is documented in `ui-frameware/cinematic_precision/DESIGN.md` with a custom color palette, typography scale, and component styles. The login screen mockup is in `ui-frameware/login_team_request_hub/`.

**Design-to-Code Mapping for Phase 2:**

The Figma login screen has:
- Centered card layout with cinematic ambient background (blur orbs)
- Brand icon (Material Symbols `hub` in a black rounded square)
- Title "Team Request Hub" in display-lg font, subtitle in text-secondary
- Google button: full-width, blue background (`#0372e4`), white Google SVG icon, rounded-xl
- "Enterprise SSO" divider line
- Footer copyright text
- Decorative side panel (desktop only, hidden on mobile) — skip for MVP, too heavy

For Phase 2 we adapt this design into the Next.js/shadcn architecture:
- Keep the layout structure (centered card, brand area, Google button)
- Use Tailwind classes that match the Figma colors where possible (map to CSS variables later in Phase 3)
- The Google SVG icon from the Figma is embedded inline (no external dependency)
- Skip the ambient blur orbs and decorative image panel for now (can be refined later)
- The logout button uses the same design language: outline variant, rounded

---

## Phase Scope

In scope:

```txt
- Create Google login button component using Supabase OAuth.
- Replace login page placeholder with the real component styled per Figma login design.
- Create users API client (getCurrentUser, listUsers, updateUserRole).
- Create useCurrentUser hook.
- Create logout button component.
- Verify lint and build pass.
```

Out of scope:

```txt
- Backend changes.
- Dashboard layout/app shell changes (Phase 3).
- Request list, request form, request actions (Phase 4+).
- Notification UI (Phase 6).
- Real Supabase project configuration (Phase 7).
- Any page content beyond login/logout and current-user loading.
- Decorative image panel and ambient background effects (nice-to-have, not MVP).
- Full design system CSS variable setup (Phase 3 covers the app shell).
```

Known current state:

```txt
- apps/web/src/app/(auth)/login/page.tsx is a placeholder ("Google OAuth placeholder").
- apps/web/src/lib/supabase/client.ts exists and exports createBrowserClient.
- apps/web/src/lib/api/client.ts exists and exports apiFetch with Bearer JWT.
- apps/web/src/components/ui/button.tsx exists (shadcn/ui Button with asChild support).
- apps/web/src/providers/query-provider.tsx exists and wraps the app.
- apps/web/src/middleware.ts redirects unauthenticated users to /login.
- apps/web/src/types/index.ts has Role, User types.
- Backend has GET /users/me returning CurrentUser.
- Backend has PATCH /users/{user_id}/role returning UserOut.
- Backend has GET /users returning list[UserOut].
- ui-frameware/login_team_request_hub/code.html has the Figma login design reference.
- ui-frameware/cinematic_precision/DESIGN.md has the design system spec.
```

Risk:

```txt
- `npm run build` needs NEXT_PUBLIC_* env vars or it will fail at build time.
  Mitigation: create a .env.local with placeholder values for build verification,
  or set the vars inline. The vars are only needed at build time for the client
  code that references process.env.NEXT_PUBLIC_*.
- Google OAuth requires a real Supabase project with Google provider configured.
  This phase only verifies lint + build; actual browser login smoke test is Phase 7.
- The login page is a server component today; the Google button must be a client
  component ("use client") because it calls Supabase auth. The page itself can
  stay as a server component that renders the client button.
- The Figma design uses custom colors (surface-alt, text-primary, text-secondary,
  secondary-container, etc.) that are not yet defined as Tailwind theme variables.
  For Phase 2, we use inline Tailwind values that approximate the Figma colors.
  Phase 3 will set up the full theme when building the app shell.
```

---

## Files

Create:

```txt
apps/web/src/components/auth/google-login-button.tsx
apps/web/src/components/auth/logout-button.tsx
apps/web/src/lib/api/users.ts
apps/web/src/hooks/use-current-user.ts
```

Modify:

```txt
apps/web/src/app/(auth)/login/page.tsx
```

Do not modify:

```txt
apps/api/*
apps/web/src/app/(dashboard)/*
apps/web/src/middleware.ts
apps/web/src/lib/supabase/*
apps/web/src/lib/api/client.ts
apps/web/src/providers/*
DB_SCHEMA_TEAM_REQUEST_HUB.sql
```

---

## Task 1: Create Users API Client

**Files:**

- Create: `apps/web/src/lib/api/users.ts`

- [ ] **Step 1: Create the users API client**

Create `apps/web/src/lib/api/users.ts`:

```ts
import { apiFetch } from "@/lib/api/client";
import type { Role, User } from "@/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
  role: Role;
}

export interface UserRoleUpdate {
  role: Role;
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/users/me");
}

export function listUsers() {
  return apiFetch<User[]>("/users");
}

export function updateUserRole(userId: string, payload: UserRoleUpdate) {
  return apiFetch<User>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Run lint**

Run:

```bash
cd apps/web
npm run lint
```

Expected: exit 0, no errors.

---

## Task 2: Create Current User Hook

**Files:**

- Create: `apps/web/src/hooks/use-current-user.ts`

- [ ] **Step 1: Create the hook**

Create `apps/web/src/hooks/use-current-user.ts`:

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/api/users";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
  });
}
```

- [ ] **Step 2: Run lint**

Run:

```bash
cd apps/web
npm run lint
```

Expected: exit 0.

---

## Task 3: Create Google Login Button

**Files:**

- Create: `apps/web/src/components/auth/google-login-button.tsx`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`

**Design reference:** `ui-frameware/login_team_request_hub/code.html` — the Google button is a full-width pill with blue background (#0372e4), white Google SVG icon on the left, and "Continue with Google" text. Loading state shows a spinner with "Authenticating...".

- [ ] **Step 1: Create the client login component**

Create `apps/web/src/components/auth/google-login-button.tsx`:

Style based on Figma mockup: full-width, h-[54px], rounded-xl, blue background, white text, Google SVG icon. The button is NOT a shadcn/ui Button because the Figma design uses a custom style that differs significantly from the shadcn variant system.

```tsx
"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GoogleLoginButton() {
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    setIsLoading(true);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/dashboard`,
      },
    });

    if (error) {
      setIsLoading(false);
      throw error;
    }
  }

  return (
    <button
      type="button"
      className="relative w-full h-[54px] flex items-center justify-center gap-3 bg-[#0372e4] text-white font-semibold text-sm rounded-xl hover:opacity-80 transition-all duration-200 active:scale-[0.98] disabled:opacity-70"
      onClick={handleLogin}
      disabled={isLoading}
    >
      {isLoading ? (
        <>
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Authenticating...
        </>
      ) : (
        <>
          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center p-0.5">
            <svg className="w-full h-full" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          </div>
          Continue with Google
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 2: Update login page to use the Figma-styled layout**

Replace the content of `apps/web/src/app/(auth)/login/page.tsx` with a layout that matches the Figma login design (centered card, brand area, subtitle, button, footer):

```tsx
import { GoogleLoginButton } from "@/components/auth/google-login-button";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-[560px] bg-white rounded-xl shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px] p-12 md:p-16 flex flex-col items-center text-center">
        <div className="mb-10">
          <div className="w-16 h-16 bg-black text-white rounded-xl flex items-center justify-center mb-8 mx-auto shadow-[rgba(0,0,0,0.22)_3px_5px_30px_0px]">
            <span className="text-[32px] font-light">⬡</span>
          </div>
          <h1 className="text-[32px] md:text-[56px] font-semibold text-[#1d1d1f] mb-4 tracking-tight leading-tight">
            Team Request Hub
          </h1>
          <p className="text-base text-[#86868b] max-w-sm mx-auto leading-relaxed">
            Internal request workflow for team coordination
          </p>
        </div>
        <div className="w-full space-y-6">
          <GoogleLoginButton />
          <div className="flex items-center gap-4 py-2">
            <div className="h-px flex-1 bg-[#cfc4c5]/30" />
            <span className="text-xs text-[#86868b] uppercase tracking-widest">
              Enterprise SSO
            </span>
            <div className="h-px flex-1 bg-[#cfc4c5]/30" />
          </div>
        </div>
      </div>
      <footer className="absolute bottom-8">
        <p className="text-sm text-[#86868b]">
          © 2026 Team Request Hub. All systems operational.
        </p>
      </footer>
    </main>
  );
}
```

Note: The page remains a server component. Only `GoogleLoginButton` is a client component. Colors use inline Tailwind values from the Figma design system — Phase 3 will extract these into CSS variables.

- [ ] **Step 3: Run lint**

Run:

```bash
cd apps/web
npm run lint
```

Expected: exit 0.

---

## Task 4: Create Logout Button

**Files:**

- Create: `apps/web/src/components/auth/logout-button.tsx`

**Design reference:** From the Figma dashboard mockup (`ui-frameware/dashboard_team_request_hub/`), the top nav bar is black with glass blur. The logout action is part of the user profile area. For Phase 2, we create a standalone logout button using the design language (outline style, rounded).

- [ ] **Step 1: Create the logout component**

Create `apps/web/src/components/auth/logout-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="px-4 py-2 border border-[#cfc4c5]/50 text-[#86868b] rounded-xl text-sm font-semibold hover:bg-[#f3f3f3] transition-colors"
      onClick={handleLogout}
    >
      Sign out
    </button>
  );
}
```

- [ ] **Step 2: Run lint**

Run:

```bash
cd apps/web
npm run lint
```

Expected: exit 0.

---

## Task 5: Run Full Frontend Verification

**Files:**

- Modify only if verification exposes issues.

- [ ] **Step 1: Create placeholder .env.local if it does not exist**

Check if `apps/web/.env.local` exists. If not, create it with placeholder values so `npm run build` can resolve the `NEXT_PUBLIC_*` env vars:

```bash
cd apps/web
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
```

Warning: if `.env.local` already exists with real values, do not overwrite it.

- [ ] **Step 2: Run lint**

Run:

```bash
cd apps/web
npm run lint
```

Expected: exit 0, no errors.

- [ ] **Step 3: Run build**

Run:

```bash
cd apps/web
npm run build
```

Expected: build completes with exit 0. The Next.js build compiles all routes and the output shows the route tree.

Note: The build may show warnings about unused variables or missing types. Fix only errors that cause build failure.

- [ ] **Step 4: Verify no backend files changed**

Run:

```bash
git diff --name-only -- apps/api/
```

Expected: no output (no backend changes).

---

## Done Criteria

Phase 2 is complete when:

```txt
- apps/web/src/components/auth/google-login-button.tsx exists.
- apps/web/src/components/auth/logout-button.tsx exists.
- apps/web/src/lib/api/users.ts exists.
- apps/web/src/hooks/use-current-user.ts exists.
- apps/web/src/app/(auth)/login/page.tsx renders GoogleLoginButton instead of placeholder.
- npm run lint passes.
- npm run build passes.
- No backend files (apps/api/*) were modified.
- No dashboard layout or page files were modified.
```

## Verification Commands

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Run from repo root to verify scope:

```bash
git diff --name-only -- apps/api/
```

Expected: no output.

## TDD Points

Phase 2 is a frontend UI phase. There is no FE test runner configured yet (see AGENTS.md "Verification Notes"). The TDD approach here is:

```txt
- Write component code.
- Run lint after each task to catch TypeScript and import errors.
- Run build at the end to verify full compilation.
- Manual browser verification is deferred to Phase 7.
```

## Commit Plan

Use one commit after all Phase 2 checks pass:

```bash
git add apps/web/src/components/auth/google-login-button.tsx \
  apps/web/src/components/auth/logout-button.tsx \
  apps/web/src/lib/api/users.ts \
  apps/web/src/hooks/use-current-user.ts \
  apps/web/src/app/\(auth\)/login/page.tsx
git commit -m "feat: add Google login UI, current user client, and logout"
```

If `.env.local` was created for build verification, do NOT commit it (it should already be in `.gitignore`).

## Self-Review

Spec coverage:

```txt
- Google login button maps to Phase 2 roadmap task.
- Current user API client and hook maps to Phase 2 roadmap task.
- Logout button maps to Phase 2 roadmap task.
- Login page replacement maps to Phase 2 roadmap task.
```

Placeholder scan:

```txt
- No unfinished placeholder markers.
- All tasks include exact files, commands, expected outputs, and code blocks.
```

Type consistency:

```txt
- CurrentUser interface in users.ts matches backend CurrentUser schema
  (id, email, name, avatar_url, role).
- UserRoleUpdate interface uses Role type from types/index.ts.
- useCurrentUser hook uses TanStack Query v5 API (useQuery with queryKey/queryFn).
- GoogleLoginButton uses Supabase signInWithOAuth with google provider.
- LogoutButton uses Supabase signOut and Next.js router.refresh.
```

Design fidelity:

```txt
- Login page layout matches ui-frameware/login_team_request_hub/code.html:
  centered card, brand icon, title, subtitle, Google button, SSO divider, footer.
- Google button uses the exact Google SVG from the Figma mockup.
- Colors use inline Tailwind hex values from the Figma design system
  (primary #000000, text-primary #1d1d1f, text-secondary #86868b,
  secondary-container #0372e4, surface-alt #f5f5f7, outline-variant #cfc4c5).
- Phase 3 will extract these into CSS variables when building the app shell.
- Logout button uses the same design language (outline style, rounded-xl).
```
