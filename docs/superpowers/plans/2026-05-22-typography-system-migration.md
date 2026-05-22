# Incremental Typography Token Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize frontend text styling into reusable typography tokens inspired by `DESIGN.md`, without making the internal tool feel cramped or marketing-like.

**Architecture:** This is a frontend-only visual refactor. Add compact typography utilities in `apps/web/src/app/globals.css`, remove decorative fonts from the root layout, then migrate only shared/high-impact components first: page headers, buttons, badges, request cards, and request detail. Body text keeps comfortable default tracking for Vietnamese readability; negative tracking is applied lightly only to headings, links, buttons, badges, and compact metadata.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict mode, Tailwind CSS v4, shadcn/ui conventions.

---

## Required Context

Read before editing:

```txt
AGENTS.md
apps/web/AGENTS.md
DESIGN.md
apps/web/src/app/globals.css
apps/web/src/app/layout.tsx
apps/web/src/components/shared/page-header.tsx
apps/web/src/components/ui/button.tsx
apps/web/src/components/requests/request-card.tsx
apps/web/src/components/requests/request-detail.tsx
```

Before editing any function, component, or exported symbol, run GitNexus impact analysis as required by `AGENTS.md`. If the risk is HIGH or CRITICAL, stop and report the blast radius before changing code.

---

## Scope

In scope:

```txt
- Centralize text styling into named Tailwind utilities.
- Keep current compact internal-tool scale.
- Keep Inter as the only app font.
- Remove Orbitron and Rajdhani from app layout.
- Apply light negative tracking only where it improves precision.
- Migrate shared/high-impact components first.
- Update docs/frontend-ui-framework.md to match the new typography direction.
```

Out of scope:

```txt
- Full Apple marketing-site typography scale.
- 56px hero typography across authenticated pages.
- Negative tracking on all body copy.
- Full migration of every text class in apps/web/src in this phase.
- Backend changes, API changes, Supabase changes.
```

---

## Design Decisions

### Keep From DESIGN.md

```txt
- Named typography roles instead of ad hoc class combinations.
- Restrained weights: 400, 500, 600; 700 only when already justified.
- Tight heading rhythm.
- Single sans font stack.
- Apple-like precision on headings, buttons, links, badges, metadata.
```

### Adapt For This Product

```txt
- Body text stays at normal tracking to preserve Vietnamese readability.
- Page titles stay around 24px, not Apple-style 56px.
- Section headings stay around 18-20px.
- Request cards remain compact and scan-friendly.
- Decorative wide-tracking auth screens are not generalized into global tokens.
```

### Typography Tokens

Use these token utilities in this phase:

```txt
Token              Size  Weight  Line Height  Tracking   Use
------------------ ----- ------- ------------ ---------- --------------------------
text-page-title    24px  600     1.2          -0.01em    h1 page titles
text-section-title 18px  600     1.25         -0.008em   h2/dialog titles
text-card-title    16px  600     1.3          -0.006em   card/request titles
text-body          14px  400     1.5          0          body text, descriptions
text-body-medium   14px  500     1.45         0          labels, emphasized body
text-caption       12px  400     1.35         0          secondary metadata
text-caption-strong 12px 500     1.35         -0.004em   badges, compact labels
text-button        14px  500     1.25         -0.004em   normal buttons
text-button-sm     12px  500     1.25         -0.004em   small buttons
text-link          14px  500     1.45         -0.004em   inline/action links
text-stat-value    20px  600     1.2          -0.008em   dashboard stat values
text-stat-label    11px  500     1.3          0          dashboard stat labels
```

---

## File Map

Modify:

```txt
apps/web/src/app/globals.css
apps/web/src/app/layout.tsx
apps/web/src/components/shared/page-header.tsx
apps/web/src/components/ui/button.tsx
apps/web/src/components/requests/request-status-badge.tsx
apps/web/src/components/requests/request-priority-badge.tsx
apps/web/src/components/requests/request-card.tsx
apps/web/src/components/requests/request-detail.tsx
apps/web/src/app/(dashboard)/dashboard/page.tsx
```

Do not create a `Text` component in this phase. Tailwind token utilities are enough and keep the change smaller.

---

### Task 1: Add Typography Token Utilities

**Files:**

- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for `globals.css` or report that GitNexus cannot resolve CSS files as symbols. Continue only if there is no HIGH/CRITICAL warning.

- [ ] **Step 2: Add typography utilities**

Add this after the existing `@layer base` block in `apps/web/src/app/globals.css`:

```css
@layer utilities {
  .text-page-title {
    font-size: 1.5rem;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .text-section-title {
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.008em;
  }

  .text-card-title {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.3;
    letter-spacing: -0.006em;
  }

  .text-body {
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.5;
    letter-spacing: 0;
  }

  .text-body-medium {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.45;
    letter-spacing: 0;
  }

  .text-caption {
    font-size: 0.75rem;
    font-weight: 400;
    line-height: 1.35;
    letter-spacing: 0;
  }

  .text-caption-strong {
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.35;
    letter-spacing: -0.004em;
  }

  .text-button {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: -0.004em;
  }

  .text-button-sm {
    font-size: 0.75rem;
    font-weight: 500;
    line-height: 1.25;
    letter-spacing: -0.004em;
  }

  .text-link {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.45;
    letter-spacing: -0.004em;
  }

  .text-stat-value {
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.008em;
  }

  .text-stat-label {
    font-size: 0.6875rem;
    font-weight: 500;
    line-height: 1.3;
    letter-spacing: 0;
  }
}
```

- [ ] **Step 3: Keep body tracking comfortable**

Keep the existing body rule as:

```css
  body {
    @apply bg-background text-foreground;
    letter-spacing: 0;
  }
```

Do not change body letter-spacing in this phase.

- [ ] **Step 4: Verify CSS**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: add compact typography token utilities"
```

---

### Task 2: Remove Decorative Fonts

**Files:**

- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for `RootLayout`.

- [ ] **Step 2: Keep only Inter**

Replace the font import line with:

```tsx
import { Inter } from "next/font/google";
```

Delete the `orbitron` and `rajdhani` font definitions.

Change the body class from:

```tsx
<body className={`${inter.className} ${orbitron.variable} ${rajdhani.variable}`}>
```

to:

```tsx
<body className={`${inter.className} ${inter.variable}`}>
```

- [ ] **Step 3: Verify layout**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "refactor: keep Inter as the only app font"
```

---

### Task 3: Migrate Shared Header and Button

**Files:**

- Modify: `apps/web/src/components/shared/page-header.tsx`
- Modify: `apps/web/src/components/ui/button.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
PageHeader
Button
buttonVariants
```

- [ ] **Step 2: Update PageHeader**

Change title, description, and meta classes:

```tsx
<h1 className="text-page-title text-foreground">{title}</h1>
{description ? <p className="text-body text-muted-foreground">{description}</p> : null}
{meta ? <div className="text-caption text-muted-foreground">{meta}</div> : null}
```

- [ ] **Step 3: Update Button typography**

In `apps/web/src/components/ui/button.tsx`, replace typography fragments in `buttonVariants`:

```txt
Base: remove text-xs/relaxed font-medium tracking-normal; add text-button-sm
default size: replace text-sm/relaxed with text-button
xs size: replace text-[0.625rem] with text-button-sm
sm size: replace text-sm/relaxed with text-button
lg size: replace text-sm/relaxed with text-button
```

Do not change button colors, spacing, variants, focus styles, or behavior.

- [ ] **Step 4: Verify**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/page-header.tsx apps/web/src/components/ui/button.tsx
git commit -m "refactor: use typography tokens in header and button"
```

---

### Task 4: Migrate Badges and Request Cards

**Files:**

- Modify: `apps/web/src/components/requests/request-status-badge.tsx`
- Modify: `apps/web/src/components/requests/request-priority-badge.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
RequestStatusBadge
RequestPriorityBadge
RequestCard
```

- [ ] **Step 2: Update badges**

Replace badge typography classes:

```txt
text-xs font-medium -> text-caption-strong
text-xs font-semibold -> text-caption-strong
```

Keep badge colors and labels unchanged.

- [ ] **Step 3: Update RequestCard**

In `apps/web/src/components/requests/request-card.tsx`, use this mapping:

```txt
Title:       text-base font-semibold -> text-card-title
Metadata:    text-xs -> text-caption
Description: text-sm leading-5 -> text-body
Next action: text-xs -> text-caption
Detail link: text-xs font-medium -> text-link
```

Do not change layout, data, links, status logic, or action-label logic.

- [ ] **Step 4: Verify**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/requests/request-status-badge.tsx apps/web/src/components/requests/request-priority-badge.tsx apps/web/src/components/requests/request-card.tsx
git commit -m "refactor: use typography tokens in request cards"
```

---

### Task 5: Migrate Request Detail and Dashboard Stats

**Files:**

- Modify: `apps/web/src/components/requests/request-detail.tsx`
- Modify: `apps/web/src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Run impact analysis**

Run GitNexus impact analysis for:

```txt
RequestDetail
DashboardPage
```

- [ ] **Step 2: Update RequestDetail**

Use this mapping:

```txt
Main h1:       text-2xl font-semibold -> text-page-title
Description:   text-sm leading-6 -> text-body
Field grid:    text-sm -> text-body
Field labels:  text-xs -> text-caption
Error text:    text-sm font-medium -> text-body-medium
Reply label:   text-sm font-medium -> text-body-medium
Actions h2:    text-sm font-semibold -> text-body-medium
```

Do not change hooks, request loading/error logic, links, or action rendering.

- [ ] **Step 3: Update DashboardPage**

Use this mapping where those classes appear:

```txt
Page h1:        text-2xl font-semibold -> text-page-title
Section h2:     text-base font-semibold -> text-section-title
Stat value:     text-xl font-semibold -> text-stat-value
Stat label:     text-[11px] font-medium tracking-normal -> text-stat-label
Body text:      text-sm -> text-body
Caption/meta:   text-xs -> text-caption
Body emphasis:  text-sm font-medium -> text-body-medium
```

Do not change dashboard data fetching, count calculation, route links, or conditional rendering.

- [ ] **Step 4: Verify**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/requests/request-detail.tsx apps/web/src/app/(dashboard)/dashboard/page.tsx
git commit -m "refactor: use typography tokens in detail and dashboard"
```

---

### Task 6: Update Frontend UI Documentation

**Files:**

- Modify: `docs/frontend-ui-framework.md`

- [ ] **Step 1: Update Typography guidance**

Replace the current typography block with:

```txt
Typography:

font family: Inter only, through next/font/google
strategy:    centralized typography utilities in apps/web/src/app/globals.css
body text:   keep letter-spacing 0 for Vietnamese readability
precision:   use light negative tracking only on headings, buttons, links, badges, and compact metadata

Token              Use
text-page-title    page h1 headings
text-section-title section/dialog headings
text-card-title    request/card titles
text-body          standard body copy
text-body-medium   labels and emphasized text
text-caption       timestamps and secondary metadata
text-caption-strong badges and compact labels
text-button        standard button labels
text-button-sm     small button labels
text-link          inline/action links
text-stat-value    dashboard stat values
text-stat-label    dashboard stat labels
```

Replace this line in the `Adjust` section:

```txt
- Use `letter-spacing: 0` for all text.
```

with:

```txt
- Keep `letter-spacing: 0` for body text; use light negative tracking only through typography tokens where it improves precision.
```

- [ ] **Step 2: Verify docs diff**

Review the diff and confirm it does not imply full Apple marketing typography for dashboard pages.

- [ ] **Step 3: Commit**

```bash
git add docs/frontend-ui-framework.md
git commit -m "docs: document incremental typography token rollout"
```

---

### Task 7: Final Verification

**Files:**

- No direct edits unless verification finds a regression from this plan.

- [ ] **Step 1: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: command exits 0.

- [ ] **Step 2: Run production build**

Run from `apps/web`:

```bash
npm run build
```

Expected: command exits 0. If the build fails due to missing environment variables, record the exact variable and compare it with `apps/web/.env.example` before changing code.

- [ ] **Step 3: Run GitNexus change detection**

Run `gitnexus_detect_changes()`.

Expected: changed symbols are limited to frontend layout, typography CSS, shared UI components, request display components, dashboard display, and docs.

- [ ] **Step 4: Visual smoke review**

Run from `apps/web`:

```bash
npm run dev
```

Check:

```txt
- Vietnamese body text does not look cramped.
- Page titles look slightly tighter and more deliberate.
- Buttons and links look consistent.
- Badges remain readable.
- Request cards remain compact and scan-friendly.
- No Orbitron/Rajdhani styling remains visible.
```

---

## Done Criteria

This phase is done when:

```txt
- globals.css contains the compact typography token utilities.
- body letter-spacing remains 0.
- Inter is the only loaded font in layout.tsx.
- PageHeader, Button, badges, RequestCard, RequestDetail, and DashboardPage use typography tokens.
- docs/frontend-ui-framework.md documents the new moderate typography strategy.
- npm run lint passes from apps/web.
- npm run build passes from apps/web or only fails for documented missing env values.
- GitNexus change detection reports only expected frontend/doc scope.
```

## Follow-Up Phase

After visual review, migrate the remaining components only if the first rollout feels right:

```txt
RequestForm, RequestList, RequestActions, RequestTimeline, dialogs, NotificationList,
UserRoleTable, TelegramSettings, DropdownMenu, AppShell, LanguageSwitcher, auth screens,
and remaining route wrappers.
```
