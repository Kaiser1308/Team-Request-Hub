"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
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
  const activeUsersQuery = useActiveUsers();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("medium");
  const [assignedTo, setAssignedTo] = useState("");
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

    try {
      await actions.create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority,
        tags: splitCommaList(tags),
        reference_links: splitLineList(referenceLinks),
        assigned_to: assignedTo || null,
      });
      router.push("/requests");
    } catch {}
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
        Assignee
        <select
          className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm font-normal"
          value={assignedTo}
          onChange={(event) => setAssignedTo(event.target.value)}
          disabled={activeUsersQuery.isLoading}
        >
          <option value="">Leave in pool</option>
          {(activeUsersQuery.data ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {formatUserLabel(user)}
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-[#6b7280]">
          Choose an active teammate or leave this request available in the pool.
        </span>
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
