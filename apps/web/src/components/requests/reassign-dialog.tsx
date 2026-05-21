"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
import { useRequestActions } from "@/hooks/use-request-actions";

export function ReassignDialog({ requestId }: { requestId: string }) {
  const actions = useRequestActions();
  const activeUsersQuery = useActiveUsers();
  const [isOpen, setIsOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    try {
      await actions.reassign.mutateAsync({
        requestId,
        payload: {
          assigned_to: assignedTo,
          reason: reason.trim() || null,
        },
      });
      setAssignedTo("");
      setReason("");
      setIsOpen(false);
    } catch {}
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
          Assignee
          <select
            className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
            disabled={activeUsersQuery.isLoading}
            required
          >
            <option value="">Select teammate</option>
            {(activeUsersQuery.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {formatUserLabel(user)}
              </option>
            ))}
          </select>
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
