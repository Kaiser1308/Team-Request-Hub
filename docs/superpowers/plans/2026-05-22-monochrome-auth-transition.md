# Monochrome Auth Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the welcome and goodbye auth transition screens to a minimalist black-and-white gradient while preserving the existing shatter animation and auth behavior.

**Architecture:** This is a focused frontend presentation change in the existing client components. The auth/session, prefetch, disabled-account, sign-out, and redirect workflows remain in place; only copy, typography classes, background classes, and shatter colors are updated.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, anime.js.

---

## Files

- Modify: `apps/web/src/components/auth/welcome-screen.tsx` for welcome copy and monochrome styling.
- Modify: `apps/web/src/components/auth/goodbye-screen.tsx` for goodbye copy and monochrome styling.
- Reference: `docs/frontend-ui-framework.md` for restrained app UI direction.

### Task 1: Safety Analysis

- [ ] Run GitNexus impact analysis for `WelcomeScreen`.

Run: GitNexus `impact` with `target: "WelcomeScreen"`, `file_path: "apps/web/src/components/auth/welcome-screen.tsx"`, `kind: "Function"`, `direction: "upstream"`.

Expected: Low or medium risk with direct route usage from `apps/web/src/app/auth/welcome/page.tsx`.

- [ ] Run GitNexus impact analysis for `GoodbyeScreen`.

Run: GitNexus `impact` with `target: "GoodbyeScreen"`, `file_path: "apps/web/src/components/auth/goodbye-screen.tsx"`, `kind: "Function"`, `direction: "upstream"`.

Expected: Low or medium risk with direct route usage from `apps/web/src/app/auth/goodbye/page.tsx`.

### Task 2: Restyle Welcome Screen

- [ ] Update status copy in `welcome-screen.tsx`.

Change these strings:

```tsx
const [statusText, setStatusText] = useState('Preparing your workspace...');
setStatusText('Account access is currently disabled.');
setStatusText('Loading dashboard...');
setStatusText('Preparing your workspace...');
setStatusText('Ready. Redirecting...');
```

- [ ] Update title and label copy.

Use:

```tsx
const title = isDisabledAccount ? 'Account disabled' : 'Welcome back';
```

Use label text:

```tsx
{isDisabledAccount ? 'Account locked' : 'Signed in'}
```

- [ ] Replace cyber visual classes with monochrome visual classes.

Use Tailwind classes that remove Orbitron/Rajdhani, blue grid, blue neon, and excessive tracking. Keep `data-screen-shard`, `data-shatter-root`, and `data-welcome-content` attributes unchanged so existing animations still target the same elements.

### Task 3: Restyle Goodbye Screen

- [ ] Update status copy in `goodbye-screen.tsx`.

Change these strings:

```tsx
const [statusText, setStatusText] = useState('Ending your session...');
setStatusText('Closing workspace...');
setStatusText('Signing out...');
setStatusText('See you next time.');
```

- [ ] Update title and label copy.

Use label `Signed out` and title `Goodbye`.

- [ ] Replace cyber visual classes with matching monochrome classes.

Keep `data-shatter-root` and `data-goodbye-content` attributes unchanged so existing fade/shatter exit still works.

### Task 4: Verify

- [ ] Run frontend lint.

Run from `apps/web`: `npm run lint`

Expected: exits with code 0.

- [ ] Run frontend build if env values are available.

Run from `apps/web`: `npm run build`

Expected: exits with code 0, or reports missing environment variables if local env is incomplete.

- [ ] Run GitNexus change detection before any commit.

Run: GitNexus `detect_changes` with `scope: "all"`.

Expected: changed symbols are limited to `WelcomeScreen`, `GoodbyeScreen`, and the docs added for this task.

## Self-Review

- Spec coverage: covered visual direction, copy, animation preservation, auth behavior preservation, and verification.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: component names and file paths match the current codebase.
