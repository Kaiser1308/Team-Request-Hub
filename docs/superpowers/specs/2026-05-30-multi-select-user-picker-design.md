# Multi-Select User Picker Design

## Overview

A reusable multi-select combobox component for picking users (or any items) with search. Replaces the current native checkbox assignee selection in `request-form.tsx`.

## Approach

shadcn Command + Popover pattern — the standard shadcn/ui combobox approach using `cmdk` for command palette search and Radix Popover for dropdown positioning.

## Component Architecture

### Generic: `MultiSelect<T>`

**File:** `src/components/ui/multi-select.tsx`

A generic, reusable multi-select combobox that doesn't know about domain concepts like "users."

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `options` | `T[]` | Available options |
| `selected` | `T[]` | Currently selected options |
| `onSelect` | `(item: T) => void` | Called when an option is selected |
| `onRemove` | `(item: T) => void` | Called when a selected item is removed |
| `renderOption` | `(item: T) => ReactNode` | How to render each dropdown option |
| `renderBadge` | `(item: T) => ReactNode` | How to render each selected badge |
| `isSelected` | `(item: T) => boolean` | Check if an item is selected |
| `getKey` | `(item: T) => string` | Unique key for each item |
| `filterFn` | `(item: T, query: string) => boolean` | Custom search filter |
| `placeholder` | `string` | Trigger placeholder text |
| `searchPlaceholder` | `string` | Search input placeholder |
| `emptyMessage` | `string` | Message when no results found |
| `className` | `string` | Additional CSS classes |

**Behavior:**

- Click trigger → open Popover with Command input auto-focused
- Type → realtime filter via `filterFn`
- Select item → call `onSelect`, keep Popover open for further selection
- Click badge × → call `onRemove`
- Click outside → close Popover
- Selected items excluded from dropdown options
- Keyboard: Enter to select highlighted item, Escape to close

### Domain: `UserMultiSelect`

**File:** `src/components/requests/user-multi-select.tsx`

A wrapper that configures `MultiSelect` for user selection with name/email search.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `users` | `UserSummary[]` | Available users |
| `selectedIds` | `string[]` | Currently selected user IDs |
| `onChange` | `(ids: string[]) => void` | Called when selection changes |
| `placeholder` | `string` | Optional placeholder override |
| `className` | `string` | Additional CSS classes |

**Search:** Filters by `user.name` (if present) and `user.email`, case-insensitive.

**Badge render:** Shows user name (or email if no name) with × button.

**Option render:** Shows name + email on separate lines. If no name, just email.

## Styling

Follows `docs/frontend-ui-framework.md` tokens:

- **Trigger:** `h-10`, border `#e5e7eb`, radius `8px`, text `text-sm`, font `Inter`
- **Badges:** shadcn Badge `secondary` variant (muted background `#f3f4f6`), `text-xs`
- **Dropdown:** surface `#ffffff`, shadow `shadow-md`, radius `8px`, max height with scroll
- **Hover/Focus:** `bg-accent` for hover, `ring-2 ring-[#2563eb]` for focus ring
- **Empty state:** `text-muted` text centered

## Dependencies to Install

```bash
npx shadcn@latest add command popover badge
```

This adds:
- `cmdk` package (command palette)
- `@radix-ui/react-popover` (already in node_modules via radix-ui)
- Badge component

## Integration

### request-form.tsx

Replace the current checkbox fieldset with:

```tsx
<UserMultiSelect
  users={activeUsers}
  selectedIds={assigneeIds}
  onChange={setAssigneeIds}
/>
```

The `assigneeIds` state and `toggleAssignee` function remain the same — `UserMultiSelect` handles the toggle logic internally via `onChange`.

### Other usages

Any component can use the generic `MultiSelect<T>` for non-user multi-select scenarios.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/ui/multi-select.tsx` | Create — generic MultiSelect component |
| `src/components/ui/badge.tsx` | Create — shadcn Badge (via CLI) |
| `src/components/ui/command.tsx` | Create — shadcn Command (via CLI) |
| `src/components/ui/popover.tsx` | Create — shadcn Popover (via CLI) |
| `src/components/requests/user-multi-select.tsx` | Create — user picker wrapper |
| `src/components/requests/request-form.tsx` | Modify — replace checkboxes with UserMultiSelect |

## Out of Scope

- Async user loading (users are passed as props)
- Form library integration (stays with useState for now)
- Other entity pickers (only user picker in this iteration)
