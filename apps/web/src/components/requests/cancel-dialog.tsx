"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRequestActions } from "@/hooks/use-request-actions";

export function CancelDialog({ requestId }: { requestId: string }) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !actions.cancel.isPending) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, actions.cancel.isPending]);

  if (!isOpen) {
    return (
      <Button type="button" variant="outline" onClick={() => setIsOpen(true)}>
        {t("actions.cancelRequest")}
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        className="w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-4"
      >
        <h3 id="cancel-dialog-title" className="text-base font-semibold text-red-900">
          {t("actions.cancelTitle")}
        </h3>
        <p className="mt-1 text-sm text-red-800">
          {t("actions.cancelDescription")}
        </p>
        <label className="mt-3 grid gap-2 text-sm font-medium text-red-900">
          {t("actions.cancelReason")}
          <textarea
            className="min-h-20 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-normal text-[#111827]"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("actions.cancelReasonPlaceholder")}
            disabled={actions.cancel.isPending}
          />
        </label>
        {actions.cancel.error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700">
            {actions.cancel.error instanceof Error
              ? actions.cancel.error.message
              : t("actions.cancelError")}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button type="submit" disabled={actions.cancel.isPending}>
            {actions.cancel.isPending ? t("actions.cancelling") : t("actions.confirmCancel")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={actions.cancel.isPending}
            onClick={() => setIsOpen(false)}
          >
            {tCommon("close")}
          </Button>
        </div>
      </form>
    </div>
  );
}
