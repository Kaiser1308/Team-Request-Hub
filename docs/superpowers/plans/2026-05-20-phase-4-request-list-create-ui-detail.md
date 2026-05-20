# Phase 4 Request List And Create UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the request list experience and create-request form so users can view backend request views and create new internal requests from the frontend.

**Architecture:** Keep pages thin. Request UI components live in `src/components/requests`; pages pass a request view into reusable components; hooks from Phase 3 own TanStack Query and FastAPI calls. This phase renders data and submits create requests only; workflow action buttons remain Phase 5.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui Button, TanStack Query v5, FastAPI request endpoints through `apiFetch`.

---

## Required Context

Read these before coding:

```txt
AGENTS.md
apps/web/AGENTS.md
apps/web/README.md
docs/frontend-ui-framework.md
docs/api-contract.md
docs/superpowers/plans/2026-05-20-phase-3-frontend-data-layer-app-shell-detail.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

Use `ui-frameware/` only as visual reference:

```txt
ui-frameware/assigned_to_me_team_request_hub/
ui-frameware/created_by_me_team_request_hub/
ui-frameware/pool_team_request_hub/
ui-frameware/create_new_request_team_request_hub/
```

Do not copy static HTML, Tailwind CDN setup, Material Symbols, external images,
hard-coded demo data, or decorative effects.

## Phase Scope

In scope:

```txt
- Create reusable request status and priority badges.
- Create reusable request card and request list components.
- Add lightweight status and priority filtering in the list component.
- Wire assigned, created, pool, done, and all request pages to backend views.
- Create request form with required validation.
- Submit create request through useRequestActions().create.
- Redirect successful create to /requests.
- Verify lint and build.
```

Out of scope:

```txt
- Self-assign, acknowledge, start, done, cancel, and reassign UI actions.
- Request detail page.
- Assignment history and status timeline UI.
- Notifications UI.
- Admin users UI.
- Backend changes.
- Advanced search, pagination, sorting, or server-side filters.
```

Known current state:

```txt
- Phase 3 files exist: query keys, requests API client, request hooks, request actions hook, and AppShell.
- Dashboard list pages are placeholders.
- apps/web/src/components/requests/ does not exist yet.
- The backend exposes GET /requests?view=assigned|created|pool|done|all and POST /requests.
- The frontend build currently passes after Phase 2/3 changes.
```

Risks:

```txt
- Runtime list pages need a logged-in Supabase session and backend server running.
- Empty lists are normal on a fresh Supabase project.
- The create form uses assigned_to: null in this phase; assigning/reassigning is Phase 5.
- Backend may reject role-forbidden views such as all for non-lead users; show a readable error state.
```

---

## Files

Create:

```txt
apps/web/src/components/requests/request-status-badge.tsx
apps/web/src/components/requests/request-priority-badge.tsx
apps/web/src/components/requests/request-card.tsx
apps/web/src/components/requests/request-list.tsx
apps/web/src/components/requests/request-form.tsx
```

Modify:

```txt
apps/web/src/app/(dashboard)/assigned/page.tsx
apps/web/src/app/(dashboard)/requests/page.tsx
apps/web/src/app/(dashboard)/pool/page.tsx
apps/web/src/app/(dashboard)/done/page.tsx
apps/web/src/app/(dashboard)/all/page.tsx
apps/web/src/app/(dashboard)/requests/new/page.tsx
```

Do not modify:

```txt
apps/api/*
apps/web/src/hooks/*
apps/web/src/lib/api/*
apps/web/src/app/(auth)/*
apps/web/src/components/app/app-shell.tsx unless Phase 3 left a route issue
```

---

## Task 1: Add Request Badges And Card

**Files:**

- Create: `apps/web/src/components/requests/request-status-badge.tsx`
- Create: `apps/web/src/components/requests/request-priority-badge.tsx`
- Create: `apps/web/src/components/requests/request-card.tsx`

- [ ] **Step 1: Create request status badge**

Create `apps/web/src/components/requests/request-status-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/types";

const statusLabel: Record<RequestStatus, string> = {
  pending: "Pending",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

const statusClassName: Record<RequestStatus, string> = {
  pending: "border-[#e5e7eb] bg-[#f3f4f6] text-[#4b5563]",
  acknowledged: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-blue-300 bg-blue-100 text-blue-800",
  done: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        statusClassName[status],
      )}
    >
      {statusLabel[status]}
    </span>
  );
}
```

- [ ] **Step 2: Create request priority badge**

Create `apps/web/src/components/requests/request-priority-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";
import type { RequestPriority } from "@/types";

const priorityLabel: Record<RequestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const priorityClassName: Record<RequestPriority, string> = {
  low: "border-[#e5e7eb] bg-white text-[#6b7280]",
  medium: "border-[#e5e7eb] bg-[#f3f4f6] text-[#4b5563]",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

export function RequestPriorityBadge({
  priority,
}: {
  priority: RequestPriority;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        priorityClassName[priority],
      )}
    >
      {priorityLabel[priority]}
    </span>
  );
}
```

- [ ] **Step 3: Create request card**

Create `apps/web/src/components/requests/request-card.tsx`:

```tsx
import Link from "next/link";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import type { InternalRequest } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RequestCard({ request }: { request: InternalRequest }) {
  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/requests/${request.id}`}
            className="text-base font-semibold text-[#111827] hover:underline"
          >
            {request.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#4b5563]">
            {request.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <RequestStatusBadge status={request.status} />
          <RequestPriorityBadge priority={request.priority} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
        <span>Created {formatDate(request.created_at)}</span>
        {request.assigned_to ? <span>Assigned</span> : <span>Unassigned</span>}
        {request.done_at ? <span>Done {formatDate(request.done_at)}</span> : null}
      </div>

      {request.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {request.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-[#f3f4f6] px-2 py-1 text-xs text-[#4b5563]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 4: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

---

## Task 2: Add Request List With Filters And States

**Files:**

- Create: `apps/web/src/components/requests/request-list.tsx`

- [ ] **Step 1: Create request list component**

Create `apps/web/src/components/requests/request-list.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { RequestCard } from "@/components/requests/request-card";
import { Button } from "@/components/ui/button";
import { useRequests } from "@/hooks/use-requests";
import type { RequestView } from "@/lib/api/requests";
import type { RequestPriority, RequestStatus } from "@/types";

const statusOptions: Array<"all" | RequestStatus> = [
  "all",
  "pending",
  "acknowledged",
  "in_progress",
  "done",
  "cancelled",
];

const priorityOptions: Array<"all" | RequestPriority> = [
  "all",
  "low",
  "medium",
  "high",
  "urgent",
];

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RequestList({
  view,
  emptyMessage,
}: {
  view: RequestView;
  emptyMessage: string;
}) {
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const [priority, setPriority] = useState<"all" | RequestPriority>("all");
  const { data, isLoading, isError, error, refetch, isFetching } =
    useRequests(view);

  const filteredRequests = useMemo(() => {
    return (data ?? []).filter((request) => {
      const statusMatches = status === "all" || request.status === status;
      const priorityMatches =
        priority === "all" || request.priority === priority;
      return statusMatches && priorityMatches;
    });
  }, [data, priority, status]);

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-lg border border-[#e5e7eb] bg-white"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {error instanceof Error ? error.message : "Could not load requests."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#e5e7eb] bg-white p-3 sm:flex-row">
        <label className="grid gap-1 text-sm text-[#4b5563]">
          Status
          <select
            className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827]"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | RequestStatus)
            }
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {label(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm text-[#4b5563]">
          Priority
          <select
            className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827]"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as "all" | RequestPriority)
            }
          >
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {label(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!filteredRequests.length ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
          {data?.length ? "No requests match the selected filters." : emptyMessage}
        </div>
      ) : (
        <div className="grid gap-3" aria-busy={isFetching}>
          {filteredRequests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

---

## Task 3: Wire Request List Pages

**Files:**

- Modify: `apps/web/src/app/(dashboard)/assigned/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/pool/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/done/page.tsx`
- Modify: `apps/web/src/app/(dashboard)/all/page.tsx`

- [ ] **Step 1: Wire assigned page**

Replace `apps/web/src/app/(dashboard)/assigned/page.tsx` with:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function AssignedPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Assigned to me</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Requests currently assigned to you.
        </p>
      </div>
      <RequestList
        view="assigned"
        emptyMessage="No requests are assigned to you."
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire created requests page**

Replace `apps/web/src/app/(dashboard)/requests/page.tsx` with:

```tsx
import Link from "next/link";
import { RequestList } from "@/components/requests/request-list";
import { Button } from "@/components/ui/button";

export default function RequestsPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Created by me</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Requests you opened for the team.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </div>
      <RequestList view="created" emptyMessage="You have not created requests yet." />
    </div>
  );
}
```

- [ ] **Step 3: Wire pool page**

Replace `apps/web/src/app/(dashboard)/pool/page.tsx` with:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function PoolPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pool</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Unassigned requests available for backend owners and leads.
        </p>
      </div>
      <RequestList view="pool" emptyMessage="The request pool is empty." />
    </div>
  );
}
```

- [ ] **Step 4: Wire done page**

Replace `apps/web/src/app/(dashboard)/done/page.tsx` with:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function DonePage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Done</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Completed requests relevant to your work.
        </p>
      </div>
      <RequestList view="done" emptyMessage="No completed requests yet." />
    </div>
  );
}
```

- [ ] **Step 5: Wire all requests page**

Replace `apps/web/src/app/(dashboard)/all/page.tsx` with:

```tsx
import { RequestList } from "@/components/requests/request-list";

export default function AllRequestsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">All requests</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Lead-only view of every request in the workspace.
        </p>
      </div>
      <RequestList view="all" emptyMessage="No requests exist yet." />
    </div>
  );
}
```

- [ ] **Step 6: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

---

## Task 4: Add Create Request Form

**Files:**

- Create: `apps/web/src/components/requests/request-form.tsx`
- Modify: `apps/web/src/app/(dashboard)/requests/new/page.tsx`

- [ ] **Step 1: Create request form**

Create `apps/web/src/components/requests/request-form.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/use-request-actions";
import type { RequestPriority } from "@/types";

const priorities: RequestPriority[] = ["low", "medium", "high", "urgent"];

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLineList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RequestForm() {
  const router = useRouter();
  const actions = useRequestActions();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("medium");
  const [tags, setTags] = useState("");
  const [referenceLinks, setReferenceLinks] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError("Title is required.");
      return;
    }

    if (!description.trim()) {
      setValidationError("Description is required.");
      return;
    }

    await actions.create.mutateAsync({
      title: title.trim(),
      description: description.trim(),
      priority,
      tags: splitCommaList(tags),
      reference_links: splitLineList(referenceLinks),
      assigned_to: null,
    });

    router.push("/requests");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-3xl gap-5 rounded-lg border border-[#e5e7eb] bg-white p-5"
    >
      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        Title
        <input
          className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm font-normal"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={160}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        Description
        <textarea
          className="min-h-36 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-normal"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        Priority
        <select
          className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm font-normal"
          value={priority}
          onChange={(event) =>
            setPriority(event.target.value as RequestPriority)
          }
        >
          {priorities.map((item) => (
            <option key={item} value={item}>
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        Tags
        <input
          className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm font-normal"
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="api, backend, urgent"
        />
        <span className="text-xs font-normal text-[#6b7280]">
          Separate tags with commas.
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        Reference links
        <textarea
          className="min-h-24 rounded-md border border-[#e5e7eb] bg-white px-3 py-2 text-sm font-normal"
          value={referenceLinks}
          onChange={(event) => setReferenceLinks(event.target.value)}
          placeholder="One URL per line"
        />
      </label>

      {validationError || actions.create.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {validationError ??
            (actions.create.error instanceof Error
              ? actions.create.error.message
              : "Could not create the request.")}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/requests")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={actions.create.isPending}>
          {actions.create.isPending ? "Creating..." : "Create request"}
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Use form on new request page**

Replace `apps/web/src/app/(dashboard)/requests/new/page.tsx` with:

```tsx
import { RequestForm } from "@/components/requests/request-form";

export default function NewRequestPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Create request</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Send a clear internal request to the team.
        </p>
      </div>
      <RequestForm />
    </div>
  );
}
```

- [ ] **Step 3: Run frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

---

## Task 5: Final Verification And Handoff Report

**Files:**

- Modify: none unless verification exposes a real bug.

- [ ] **Step 1: Run full frontend verification**

Run from `apps/web`:

```bash
npm run lint
npm run build
```

Expected:

```txt
eslint exits 0
next build exits 0
```

- [ ] **Step 2: Backend verification policy**

If no backend files changed, skip backend tests and report:

```txt
Backend verification skipped because Phase 4 is frontend-only and no backend files changed.
```

If any backend file changed unexpectedly, stop and explain why before continuing.
Then run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

- [ ] **Step 3: Report changed files and remaining risk**

Final report must include:

```txt
- Files created.
- Files modified.
- npm run lint result.
- npm run build result.
- Whether backend verification was skipped or run.
- Remaining runtime risks, especially that list/create flows require logged-in Supabase session, running backend, and populated database.
```

## Done Criteria

Phase 4 is complete when:

```txt
- Status badge and priority badge components exist.
- RequestCard renders title, description, status, priority, timestamps, tags, and detail link.
- RequestList renders loading, error, empty, filter, and list states.
- Assigned, created, pool, done, and all pages use RequestList with the correct view.
- Create request page uses RequestForm.
- RequestForm validates title and description.
- RequestForm calls useRequestActions().create and redirects to /requests on success.
- No Phase 5 workflow action UI is implemented.
- npm run lint passes from apps/web.
- npm run build passes from apps/web.
```
