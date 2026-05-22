# Phase 5 Request Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the core request workflow UI: users can self-assign, acknowledge, start, mark done with a reply, cancel, reassign where allowed, and inspect request detail history.

**Architecture:** Request workflow UI stays in `src/components/requests`; pages compose hooks and components; mutations use `useRequestActions` from Phase 3 and invalidate request/notification queries. Backend remains the source of truth for permissions; frontend only hides unavailable actions for usability.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui Button, TanStack Query v5, FastAPI request workflow endpoints through `apiFetch`.

---

## Required Context

Read these before coding:

```txt
AGENTS.md
apps/web/AGENTS.md
apps/web/README.md
docs/frontend-ui-framework.md
docs/api-contract.md
docs/permissions.md
docs/superpowers/plans/2026-05-20-phase-4-request-list-create-ui-detail.md
docs/superpowers/plans/2026-05-20-team-request-hub-mvp-phased-build.md
```

Use `ui-frameware/request_detail_team_request_hub/` as the visual reference for
the request detail page. Do not copy static HTML, Tailwind CDN setup, Material
Symbols, external images, hard-coded demo data, or decorative effects.

## Phase Scope

In scope:

```txt
- Fix Phase 4 carryover issues that block request actions:
  - request detail route must exist because request cards link to it
  - create form submit should catch mutation errors
- Build request detail page.
- Render request metadata, assignment history, and status logs.
- Add self-assign, acknowledge, start, cancel, done-with-reply, and reassign controls.
- Show action-level loading and error states.
- Wire actions into request cards and request detail.
- Verify lint and build.
```

Out of scope:

```txt
- Notifications UI.
- Admin users/role management UI.
- Dashboard analytics/cards.
- Backend changes unless frontend discovers an API contract mismatch.
- Complex modal library setup. Inline confirmation panels/dialog-like forms are acceptable for MVP.
```

Known current state:

```txt
- Phase 3 request hooks exist: useRequest, useRequests, useRequestAssignmentHistory, useRequestStatusLogs.
- Phase 3 action hook exists: useRequestActions.
- Phase 4 request cards link to /requests/{requestId}.
- apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx does not exist yet.
- Phase 4 RequestForm calls actions.create.mutateAsync and redirects, but should catch errors to avoid unhandled rejection.
- npm run lint and npm run build passed after restoring native optional dependencies.
```

Risks:

```txt
- Runtime workflow tests need a logged-in user with the right role and requests in Supabase.
- Reassign needs a target user id. This phase can use a typed user-id field for MVP; a richer user picker belongs in Phase 6 after user management UI exists.
- Backend may reject actions even if the frontend shows a button. Display backend errors without trying to duplicate all permissions.
```

---

## Files

Create:

```txt
apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx
apps/web/src/components/requests/request-detail.tsx
apps/web/src/components/requests/request-timeline.tsx
apps/web/src/components/requests/request-actions.tsx
apps/web/src/components/requests/done-dialog.tsx
apps/web/src/components/requests/cancel-dialog.tsx
apps/web/src/components/requests/reassign-dialog.tsx
```

Modify:

```txt
apps/web/src/components/requests/request-card.tsx
apps/web/src/components/requests/request-form.tsx
```

Do not modify:

```txt
apps/api/*
apps/web/src/lib/api/*
apps/web/src/hooks/* unless an existing type mismatch blocks action usage
apps/web/src/app/(auth)/*
apps/web/src/components/admin/*
apps/web/src/components/notifications/*
```

---

## Task 1: Fix Phase 4 Carryover And Add Detail Route Shell

**Files:**

- Modify: `apps/web/src/components/requests/request-form.tsx`
- Create: `apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx`

- [ ] **Step 1: Add try/catch to create form submit**

Modify `apps/web/src/components/requests/request-form.tsx` so `handleSubmit`
matches this implementation:

```tsx
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

    try {
      await actions.create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority,
        tags: splitCommaList(tags),
        reference_links: splitLineList(referenceLinks),
        assigned_to: null,
      });

      router.push("/requests");
    } catch {
      // The mutation error is rendered from actions.create.error below.
    }
  }
```

- [ ] **Step 2: Create request detail route**

Create the directory and file:

```txt
apps/web/src/app/(dashboard)/requests/[requestId]/page.tsx
```

Use this content:

```tsx
import { RequestDetail } from "@/components/requests/request-detail";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <RequestDetail requestId={requestId} />;
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

## Task 2: Build Request Detail And Timeline

**Files:**

- Create: `apps/web/src/components/requests/request-detail.tsx`
- Create: `apps/web/src/components/requests/request-timeline.tsx`

- [ ] **Step 1: Create timeline component**

Create `apps/web/src/components/requests/request-timeline.tsx`:

```tsx
import type { AssignmentHistory, RequestStatusLog } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RequestTimeline({
  assignmentHistory,
  statusLogs,
}: {
  assignmentHistory: AssignmentHistory[];
  statusLogs: RequestStatusLog[];
}) {
  const events = [
    ...assignmentHistory.map((item) => ({
      id: `assignment-${item.id}`,
      created_at: item.created_at,
      title: "Assignment changed",
      detail: item.reason ?? `Assigned to ${item.to_user_id}`,
    })),
    ...statusLogs.map((item) => ({
      id: `status-${item.id}`,
      created_at: item.created_at,
      title: "Status changed",
      detail: `${item.from_status ?? "new"} -> ${item.to_status}`,
    })),
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );

  if (!events.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">
        No timeline events yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <h2 className="text-base font-semibold">Timeline</h2>
      <div className="mt-4 grid gap-4">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-[#e5e7eb] pl-4">
            <p className="text-sm font-medium text-[#111827]">{event.title}</p>
            <p className="mt-1 text-sm text-[#4b5563]">{event.detail}</p>
            <p className="mt-1 text-xs text-[#6b7280]">
              {formatDate(event.created_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create request detail component**

Create `apps/web/src/components/requests/request-detail.tsx`:

```tsx
"use client";

import Link from "next/link";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { Button } from "@/components/ui/button";
import {
  useRequest,
  useRequestAssignmentHistory,
  useRequestStatusLogs,
} from "@/hooks/use-requests";

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RequestDetail({ requestId }: { requestId: string }) {
  const requestQuery = useRequest(requestId);
  const assignmentHistoryQuery = useRequestAssignmentHistory(requestId);
  const statusLogsQuery = useRequestStatusLogs(requestId);

  if (requestQuery.isLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-40 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />
        <div className="h-56 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />
      </div>
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {requestQuery.error instanceof Error
            ? requestQuery.error.message
            : "Could not load this request."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void requestQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const request = requestQuery.data;

  return (
    <div className="space-y-5">
      <Button asChild variant="outline">
        <Link href="/requests">Back to requests</Link>
      </Button>

      <section className="rounded-lg border border-[#e5e7eb] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-[#111827]">
              {request.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              {request.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RequestStatusBadge status={request.status} />
            <RequestPriorityBadge priority={request.priority} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-[#4b5563] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-[#6b7280]">Created</p>
            <p>{formatDate(request.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Assigned</p>
            <p>{request.assigned_to ?? "Unassigned"}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Started</p>
            <p>{formatDate(request.started_at)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Done</p>
            <p>{formatDate(request.done_at)}</p>
          </div>
        </div>

        {request.reply ? (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">Done reply</p>
            <p className="mt-1 text-sm text-green-700">{request.reply}</p>
          </div>
        ) : null}

        <RequestActions request={request} />
      </section>

      <RequestTimeline
        assignmentHistory={assignmentHistoryQuery.data ?? []}
        statusLogs={statusLogsQuery.data ?? []}
      />
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

## Task 3: Add Request Action Controls

**Files:**

- Create: `apps/web/src/components/requests/request-actions.tsx`
- Modify: `apps/web/src/components/requests/request-card.tsx`

- [ ] **Step 1: Create request actions component**

Create `apps/web/src/components/requests/request-actions.tsx`:

```tsx
"use client";

import { CancelDialog } from "@/components/requests/cancel-dialog";
import { DoneDialog } from "@/components/requests/done-dialog";
import { ReassignDialog } from "@/components/requests/reassign-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRequestActions } from "@/hooks/use-request-actions";
import type { InternalRequest } from "@/types";

export function RequestActions({ request }: { request: InternalRequest }) {
  const { data: currentUser } = useCurrentUser();
  const actions = useRequestActions();
  const isLead = currentUser?.role === "lead";
  const isCreator = currentUser?.id === request.created_by;
  const isAssignee = currentUser?.id === request.assigned_to;
  const isWorker = currentUser?.role === "be" || isLead;
  const isClosed = request.status === "done" || request.status === "cancelled";
  const canSelfAssign =
    !isClosed && isWorker && !request.assigned_to && request.status === "pending";
  const canAcknowledge =
    !isClosed &&
    (isAssignee || isLead) &&
    Boolean(request.assigned_to) &&
    request.status === "pending";
  const canStart =
    !isClosed && (isAssignee || isLead) && request.status === "acknowledged";
  const canDone =
    !isClosed && (isAssignee || isLead) && request.status === "in_progress";
  const canCancel = !isClosed && (isCreator || isLead);
  const canReassign = !isClosed && isLead;

  if (!currentUser || isClosed) {
    return null;
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        {canSelfAssign ? (
          <Button
            type="button"
            disabled={actions.selfAssign.isPending}
            onClick={() => actions.selfAssign.mutate(request.id)}
          >
            {actions.selfAssign.isPending ? "Assigning..." : "Self assign"}
          </Button>
        ) : null}

        {canAcknowledge ? (
          <Button
            type="button"
            disabled={actions.updateStatus.isPending}
            onClick={() =>
              actions.updateStatus.mutate({
                requestId: request.id,
                payload: { status: "acknowledged" },
              })
            }
          >
            Acknowledge
          </Button>
        ) : null}

        {canStart ? (
          <Button
            type="button"
            disabled={actions.updateStatus.isPending}
            onClick={() =>
              actions.updateStatus.mutate({
                requestId: request.id,
                payload: { status: "in_progress" },
              })
            }
          >
            Start
          </Button>
        ) : null}

        {canDone ? <DoneDialog requestId={request.id} /> : null}
        {canReassign ? <ReassignDialog requestId={request.id} /> : null}
        {canCancel ? <CancelDialog requestId={request.id} /> : null}
      </div>

      {actions.selfAssign.error ||
      actions.updateStatus.error ||
      actions.cancel.error ||
      actions.markDone.error ||
      actions.reassign.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Could not complete the request action. Check your role and the current request status.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Render actions in request card**

Modify `apps/web/src/components/requests/request-card.tsx`:

Add this import:

```tsx
import { RequestActions } from "@/components/requests/request-actions";
```

Add this before the closing `</article>`:

```tsx
      <RequestActions request={request} />
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

## Task 4: Add Done, Cancel, And Reassign Dialogs

**Files:**

- Create: `apps/web/src/components/requests/done-dialog.tsx`
- Create: `apps/web/src/components/requests/cancel-dialog.tsx`
- Create: `apps/web/src/components/requests/reassign-dialog.tsx`

- [ ] **Step 1: Create done dialog**

Create `apps/web/src/components/requests/done-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/use-request-actions";

export function DoneDialog({ requestId }: { requestId: string }) {
  const actions = useRequestActions();
  const [isOpen, setIsOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!reply.trim()) {
      setValidationError("Reply is required.");
      return;
    }

    try {
      await actions.markDone.mutateAsync({
        requestId,
        payload: { reply: reply.trim() },
      });
      setReply("");
      setIsOpen(false);
    } catch {
      // The mutation error is rendered below.
    }
  }

  if (!isOpen) {
    return (
      <Button type="button" onClick={() => setIsOpen(true)}>
        Mark done
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="basis-full rounded-lg border border-[#e5e7eb] bg-white p-4"
    >
      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        Done reply
        <textarea
          className="min-h-24 rounded-md border border-[#e5e7eb] px-3 py-2 text-sm font-normal"
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="Describe what was completed"
          required
        />
      </label>

      {validationError || actions.markDone.error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {validationError ??
            (actions.markDone.error instanceof Error
              ? actions.markDone.error.message
              : "Could not mark this request done.")}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={actions.markDone.isPending}>
          {actions.markDone.isPending ? "Submitting..." : "Submit reply"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Create cancel dialog**

Create `apps/web/src/components/requests/cancel-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/use-request-actions";

export function CancelDialog({ requestId }: { requestId: string }) {
  const actions = useRequestActions();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await actions.cancel.mutateAsync({
        requestId,
        payload: { reason: reason.trim() || null },
      });
      setReason("");
      setIsOpen(false);
    } catch {
      // The parent action error state is rendered by RequestActions.
    }
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        Cancel request
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="basis-full rounded-lg border border-red-200 bg-red-50 p-4"
    >
      <label className="grid gap-2 text-sm font-medium text-red-900">
        Cancel reason
        <textarea
          className="min-h-20 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-normal text-[#111827]"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Optional reason"
        />
      </label>
      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={actions.cancel.isPending}>
          {actions.cancel.isPending ? "Cancelling..." : "Confirm cancel"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
          Keep request
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Create reassign dialog**

Create `apps/web/src/components/requests/reassign-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/use-request-actions";

export function ReassignDialog({ requestId }: { requestId: string }) {
  const actions = useRequestActions();
  const [isOpen, setIsOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!assignedTo.trim()) {
      setValidationError("Assignee user id is required.");
      return;
    }

    try {
      await actions.reassign.mutateAsync({
        requestId,
        payload: {
          assigned_to: assignedTo.trim(),
          reason: reason.trim() || null,
        },
      });
      setAssignedTo("");
      setReason("");
      setIsOpen(false);
    } catch {
      // The parent action error state is rendered by RequestActions.
    }
  }

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        Reassign
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="basis-full rounded-lg border border-[#e5e7eb] bg-white p-4"
    >
      <div className="grid gap-3">
        <label className="grid gap-2 text-sm font-medium text-[#111827]">
          Assignee user id
          <input
            className="h-10 rounded-md border border-[#e5e7eb] px-3 text-sm font-normal"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[#111827]">
          Reason
          <textarea
            className="min-h-20 rounded-md border border-[#e5e7eb] px-3 py-2 text-sm font-normal"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Optional reason"
          />
        </label>
      </div>

      {validationError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {validationError}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button type="submit" disabled={actions.reassign.isPending}>
          {actions.reassign.isPending ? "Reassigning..." : "Confirm reassign"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
          Close
        </Button>
      </div>
    </form>
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
Backend verification skipped because Phase 5 is frontend-only and no backend files changed.
```

If any backend file changed unexpectedly, stop and explain why before
continuing. Then run from `apps/api`:

```bash
uv --cache-dir .uv-cache run python -m unittest discover tests
uv --cache-dir .uv-cache run python -m compileall app tests
```

- [ ] **Step 3: Optional runtime smoke test**

If the user has the backend and frontend dev servers running and can complete
Google login, manually smoke test:

```txt
- create a request
- see it in Created by me
- as be/lead, self-assign a pool request
- acknowledge
- start
- mark done with reply
- cancel an open request
```

If runtime smoke is not run, report that it was not run and why.

- [ ] **Step 4: Report changed files and remaining risk**

Final report must include:

```txt
- Files created.
- Files modified.
- npm run lint result.
- npm run build result.
- Whether backend verification was skipped or run.
- Whether runtime smoke was run.
- Remaining risks, especially that reassign uses raw user id until Phase 6 adds user management/user picker.
```

## Done Criteria

Phase 5 is complete when:

```txt
- /requests/[requestId] exists and renders request detail.
- Request detail renders title, description, status, priority, metadata, reply, and timeline.
- Request cards no longer link to a missing route.
- RequestForm catches create mutation errors.
- RequestActions renders role/status-aware controls.
- Self assign calls actions.selfAssign.
- Acknowledge and Start call actions.updateStatus with the correct target status.
- DoneDialog requires a reply and calls actions.markDone.
- CancelDialog calls actions.cancel.
- ReassignDialog calls actions.reassign for lead users.
- Action errors render as readable UI.
- npm run lint passes from apps/web.
- npm run build passes from apps/web.
```
