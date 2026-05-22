# Monochrome Auth Transition Design

## Goal

Change the welcome and goodbye transition screens from a blue cyber/technology style to a modern minimalist black-and-white gradient style while preserving the existing shatter exit effect.

## Scope

- Update `apps/web/src/components/auth/welcome-screen.tsx` visual treatment only.
- Update `apps/web/src/components/auth/goodbye-screen.tsx` visual treatment only.
- Keep existing authentication, prefetch, redirect, disabled-account, and sign-out logic unchanged.
- Keep the existing anime.js character reveal and shatter/fade exit flow.

## Visual Direction

Use a monochrome gradient system:

- Full-screen background: deep black, charcoal, and soft white/gray radial gradients.
- Card: compact modern panel with subtle white border, dark translucent surface, restrained shadow, and `rounded-xl` shape.
- Typography: app default sans stack, no Orbitron/Rajdhani, no excessive letter spacing.
- Accent colors: white, slate, zinc, and neutral gray only.
- Shatter pieces: translucent white/gray gradients instead of blue neon.

## Screen Copy

Welcome screen:

- Label: `Signed in` or `Account locked` for disabled accounts.
- Title: `Welcome back` or `Account disabled` for disabled accounts.
- Name line: keep current personalized greeting behavior.
- Status text: use less technical language such as `Preparing your workspace...`, `Loading dashboard...`, and `Ready. Redirecting...`.

Goodbye screen:

- Label: `Signed out`.
- Title: `Goodbye`.
- Name line: keep current personalized goodbye behavior.
- Status text: use less technical language such as `Ending your session...`, `Signing out...`, and `See you next time.`.

## Security And Behavior

No sensitive authentication behavior changes. The frontend still uses Supabase only for auth/session handling and backend APIs for profile data. No new redirects, query parsing, local storage, cookies, secrets, or user-controlled HTML rendering are introduced.

## Verification

- Run `npm run lint` from `apps/web`.
- Run `npm run build` from `apps/web` if environment variables are available.
- Manually verify login transition, disabled-account copy, logout transition, and redirect timing.
