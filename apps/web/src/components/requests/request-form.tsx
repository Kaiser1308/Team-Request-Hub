"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AttachmentUpload } from "@/components/requests/attachment-upload";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { UserMultiSelect } from "@/components/requests/user-multi-select";
import { translatePriority } from "@/components/requests/translated-labels";
import { useActiveUsers } from "@/hooks/use-users";
import { useRequestActions } from "@/hooks/use-request-actions";
import { useRequestFileUpload } from "@/hooks/use-request-attachments";
import type { RequestPriority } from "@/types";

const priorities: RequestPriority[] = ["low", "medium", "high", "urgent"];

function splitCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const attachmentHook = useRequestFileUpload("request");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTitleError(null);
    setDescriptionError(null);

    if (!title.trim()) {
      setTitleError(t("form.titleRequired"));
      return;
    }

    if (!description.trim()) {
      setDescriptionError(t("form.descriptionRequired"));
      return;
    }

    try {
      const attachmentIds = await attachmentHook.uploadAll();
      await actions.create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        priority,
        tags: splitCommaList(""),
        reference_links: splitLineList(""),
        assigned_to: assigneeIds[0] || null,
        assignee_ids: assigneeIds,
        attachment_ids: attachmentIds,
      });
      router.push("/requests");
    } catch {}
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="app-surface grid gap-5 rounded-lg p-4 sm:p-5"
    >
      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        {t("form.title")}
        <input
          className="app-field h-10 w-full rounded-md px-3 text-sm font-normal transition placeholder:text-[#9ca3af]"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          maxLength={160}
          aria-invalid={Boolean(titleError)}
          aria-describedby={titleError ? "request-title-error" : undefined}
        />
        {titleError ? (
          <span id="request-title-error" className="text-xs font-normal text-red-700">
            {titleError}
          </span>
        ) : null}
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        {t("form.description")}
        <textarea
          className="app-field min-h-32 w-full rounded-md px-3 py-2 text-sm font-normal transition placeholder:text-[#9ca3af] sm:min-h-36"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          aria-invalid={Boolean(descriptionError)}
          aria-describedby={descriptionError ? "request-description-error" : undefined}
        />
        {descriptionError ? (
          <span
            id="request-description-error"
            className="text-xs font-normal text-red-700"
          >
            {descriptionError}
          </span>
        ) : null}
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        {t("form.priority")}
        <AppSelect
          value={priority}
          onChange={(v) => setPriority(v)}
          options={priorities.map((item) => ({
            value: item,
            label: translatePriority(t, item),
          }))}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        {t("form.assignee")}
        <UserMultiSelect
          users={activeUsersQuery.data ?? []}
          selectedIds={assigneeIds}
          onChange={setAssigneeIds}
          disabled={activeUsersQuery.isLoading}
        />
        <span className="text-xs font-normal text-[#615d59]">
          {t("form.assigneeHelp")}
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium text-[#111827]">
        {t("form.attachments")}
        <AttachmentUpload hook={attachmentHook} />
      </label>

      {actions.create.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {normalizeError(actions.create.error, t("form.createError"))}
        </p>
      ) : null}

      <div className="grid gap-3 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-10 w-full sm:w-auto"
            onClick={() => router.push("/requests")}
        >
          {tCommon("cancel")}
        </Button>
        <Button
          type="submit"
          className="min-h-10 w-full sm:w-auto"
          disabled={actions.create.isPending || attachmentHook.isUploading}
        >
          {actions.create.isPending || attachmentHook.isUploading
            ? t("form.creating")
            : t("form.create")}
        </Button>
      </div>
    </form>
  );
}
