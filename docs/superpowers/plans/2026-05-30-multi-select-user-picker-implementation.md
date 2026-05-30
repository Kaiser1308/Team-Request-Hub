# Multi-Select User Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable multi-select combobox component with search, replacing the native checkbox assignee picker in request-form.

**Architecture:** Generic `MultiSelect<T>` component built on shadcn Command + Popover, with a domain-specific `UserMultiSelect` wrapper for user selection by name/email.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, cmdk, Radix Popover

---

## File Structure

| File | Responsibility |
|------|---------------|
| `apps/web/src/components/ui/command.tsx` | shadcn Command component (CLI-generated) |
| `apps/web/src/components/ui/popover.tsx` | shadcn Popover component (CLI-generated) |
| `apps/web/src/components/ui/badge.tsx` | shadcn Badge component (CLI-generated) |
| `apps/web/src/components/ui/multi-select.tsx` | Generic MultiSelect combobox |
| `apps/web/src/components/requests/user-multi-select.tsx` | User-specific MultiSelect wrapper |
| `apps/web/src/components/requests/request-form.tsx` | Updated to use UserMultiSelect |

---

### Task 1: Install shadcn dependencies

**Files:**
- Modify: `apps/web/package.json` (via CLI)
- Create: `apps/web/src/components/ui/command.tsx` (via CLI)
- Create: `apps/web/src/components/ui/popover.tsx` (via CLI)
- Create: `apps/web/src/components/ui/badge.tsx` (via CLI)

- [ ] **Step 1: Install command, popover, and badge components**

Run from `apps/web`:

```bash
npx shadcn@latest add command popover badge
```

Expected: Creates `command.tsx`, `popover.tsx`, `badge.tsx` in `src/components/ui/` and adds `cmdk` to `package.json`.

- [ ] **Step 2: Verify installation**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/command.tsx apps/web/src/components/ui/popover.tsx apps/web/src/components/ui/badge.tsx apps/web/package.json apps/web/package-lock.json
git commit -m "feat(ui): add shadcn command, popover, badge components"
```

---

### Task 2: Create generic MultiSelect component

**Files:**
- Create: `apps/web/src/components/ui/multi-select.tsx`

- [ ] **Step 1: Create MultiSelect component**

Create `apps/web/src/components/ui/multi-select.tsx`:

```tsx
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MultiSelectProps<T> {
  options: T[];
  selected: T[];
  onSelect: (item: T) => void;
  onRemove: (item: T) => void;
  renderOption: (item: T) => React.ReactNode;
  renderBadge: (item: T) => React.ReactNode;
  isSelected: (item: T) => boolean;
  getKey: (item: T) => string;
  filterFn: (item: T, query: string) => boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect<T>({
  options,
  selected,
  onSelect,
  onRemove,
  renderOption,
  renderBadge,
  isSelected,
  getKey,
  filterFn,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  disabled = false,
}: MultiSelectProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredOptions = React.useMemo(
    () => options.filter((item) => filterFn(item, search)),
    [options, search, filterFn],
  );

  function handleSelect(item: T) {
    onSelect(item);
    setSearch("");
  }

  function handleRemove(e: React.MouseEvent, item: T) {
    e.preventDefault();
    e.stopPropagation();
    onRemove(item);
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((item) => (
            <Badge
              key={getKey(item)}
              variant="secondary"
              className="text-xs gap-1 pr-1"
            >
              {renderBadge(item)}
              <button
                type="button"
                className="ml-0.5 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onMouseDown={(e) => handleRemove(e, item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleRemove(e as unknown as React.MouseEvent, item);
                  }
                }}
                disabled={disabled}
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10 font-normal"
            disabled={disabled}
          >
            <span className="truncate text-muted-foreground">
              {selected.length > 0
                ? `${selected.length} selected`
                : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {filteredOptions.map((item) => (
                  <CommandItem
                    key={getKey(item)}
                    value={getKey(item)}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected(item) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {renderOption(item)}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/multi-select.tsx
git commit -m "feat(ui): add generic MultiSelect combobox component"
```

---

### Task 3: Create UserMultiSelect wrapper

**Files:**
- Create: `apps/web/src/components/requests/user-multi-select.tsx`

- [ ] **Step 1: Create UserMultiSelect component**

Create `apps/web/src/components/requests/user-multi-select.tsx`:

```tsx
"use client";

import * as React from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import type { UserSummary } from "@/types";

interface UserMultiSelectProps {
  users: UserSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function formatUserLabel(user: UserSummary): string {
  if (user.name && user.email) return `${user.name} (${user.email})`;
  return user.name ?? user.email ?? user.id;
}

export function UserMultiSelect({
  users,
  selectedIds,
  onChange,
  placeholder = "Select assignees...",
  className,
  disabled = false,
}: UserMultiSelectProps) {
  const selectedUsers = React.useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [users, selectedIds],
  );

  const handleSelect = React.useCallback(
    (user: UserSummary) => {
      if (!selectedIds.includes(user.id)) {
        onChange([...selectedIds, user.id]);
      }
    },
    [selectedIds, onChange],
  );

  const handleRemove = React.useCallback(
    (user: UserSummary) => {
      onChange(selectedIds.filter((id) => id !== user.id));
    },
    [selectedIds, onChange],
  );

  const isSelected = React.useCallback(
    (user: UserSummary) => selectedIds.includes(user.id),
    [selectedIds],
  );

  const getKey = React.useCallback((user: UserSummary) => user.id, []);

  const filterFn = React.useCallback(
    (user: UserSummary, query: string) => {
      const q = query.toLowerCase();
      return (
        (user.name?.toLowerCase().includes(q) ?? false) ||
        (user.email?.toLowerCase().includes(q) ?? false)
      );
    },
    [],
  );

  const renderOption = React.useCallback((user: UserSummary) => (
    <div className="flex flex-col">
      {user.name && <span className="text-sm">{user.name}</span>}
      {user.email && (
        <span className="text-xs text-muted-foreground">{user.email}</span>
      )}
    </div>
  ), []);

  const renderBadge = React.useCallback(
    (user: UserSummary) => <span>{user.name ?? user.email ?? user.id}</span>,
    [],
  );

  return (
    <MultiSelect
      options={users}
      selected={selectedUsers}
      onSelect={handleSelect}
      onRemove={handleRemove}
      renderOption={renderOption}
      renderBadge={renderBadge}
      isSelected={isSelected}
      getKey={getKey}
      filterFn={filterFn}
      placeholder={placeholder}
      searchPlaceholder="Search by name or email..."
      emptyMessage="No users found."
      className={className}
      disabled={disabled}
    />
  );
}
```

- [ ] **Step 2: Verify build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/requests/user-multi-select.tsx
git commit -m "feat(requests): add UserMultiSelect picker component"
```

---

### Task 4: Integrate UserMultiSelect into request-form

**Files:**
- Modify: `apps/web/src/components/requests/request-form.tsx`

- [ ] **Step 1: Update request-form.tsx**

In `apps/web/src/components/requests/request-form.tsx`:

1. Add import for `UserMultiSelect`
2. Remove import for `formatUserLabel` (no longer needed in this file)
3. Replace the `<fieldset>` assignee section (lines 147-174) with `<UserMultiSelect>`
4. Remove the `toggleAssignee` function (lines 79-85) — no longer needed

The import section should become:

```tsx
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { translatePriority } from "@/components/requests/translated-labels";
import { useActiveUsers } from "@/hooks/use-users";
import { useRequestActions } from "@/hooks/use-request-actions";
import { UserMultiSelect } from "@/components/requests/user-multi-select";
import type { RequestPriority } from "@/types";
```

Remove the `toggleAssignee` function entirely.

Replace the fieldset block (lines 147-174) with:

```tsx
      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        {t("form.assignee")}
        <UserMultiSelect
          users={activeUsersQuery.data ?? []}
          selectedIds={assigneeIds}
          onChange={setAssigneeIds}
          disabled={activeUsersQuery.isLoading}
        />
        <span className="text-xs font-normal text-[#6b7280]">
          {t("form.assigneeHelp")}
        </span>
      </label>
```

- [ ] **Step 2: Verify build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/requests/request-form.tsx
git commit -m "feat(requests): replace checkbox assignee picker with UserMultiSelect"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full build**

Run from `apps/web`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 2: Run lint**

Run from `apps/web`:

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 3: Commit any fixes if needed**

If lint/build had issues and were fixed:

```bash
git add -A
git commit -m "fix: address lint/build issues in multi-select components"
```
