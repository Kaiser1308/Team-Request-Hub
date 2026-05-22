"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
import { useRequestActions } from "@/hooks/use-request-actions";

export function ReassignDialog({ requestId }: { requestId: string }) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const actions = useRequestActions();
  const activeUsersQuery = useActiveUsers();
  const [isOpen, setIsOpen] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!assignedTo) {
      setValidationError(t("actions.selectTeammateError"));
      return;
    }

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !actions.reassign.isPending) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, actions.reassign.isPending]);

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        {t("actions.reassign")}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reassign-dialog-title"
        className="w-full max-w-lg rounded-lg border border-[#e5e7eb] bg-white p-4"
      >
        <h3
          id="reassign-dialog-title"
          className="text-base font-semibold text-[#111827]"
        >
          {t("actions.reassignTitle")}
        </h3>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-[#111827]">
            {t("actions.assignee")}
            <select
              className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm"
              value={assignedTo}
              onChange={(event) => setAssignedTo(event.target.value)}
              disabled={activeUsersQuery.isLoading || actions.reassign.isPending}
              required
            >
              <option value="">{t("actions.selectTeammate")}</option>
              {(activeUsersQuery.data ?? []).map((user) => (
                <option key={user.id} value={user.id}>
                  {formatUserLabel(user)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-[#111827]">
            {t("actions.reason")}
            <textarea
              className="min-h-20 rounded-md border border-[#e5e7eb] px-3 py-2 text-sm font-normal"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("actions.optionalReason")}
              disabled={actions.reassign.isPending}
            />
          </label>
        </div>

        {validationError || actions.reassign.error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError ??
              (actions.reassign.error instanceof Error
                ? actions.reassign.error.message
                : t("actions.reassignError"))}
          </p>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Button type="submit" disabled={actions.reassign.isPending}>
            {actions.reassign.isPending ? t("actions.reassigning") : t("actions.confirmReassign")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={actions.reassign.isPending}
            onClick={() => setIsOpen(false)}
          >
            {tCommon("close")}
          </Button>
        </div>
      </form>
    </div>
  );
}
