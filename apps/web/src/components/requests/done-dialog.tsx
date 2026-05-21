"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !actions.markDone.isPending) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, actions.markDone.isPending]);

  if (!isOpen) {
    return (
      <Button type="button" onClick={() => setIsOpen(true)}>
        Mark done
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="done-dialog-title"
        className="w-full max-w-lg rounded-lg border border-[#e5e7eb] bg-white p-4"
      >
        <h3 id="done-dialog-title" className="text-base font-semibold text-[#111827]">
          Mark request done
        </h3>
        <p className="mt-1 text-sm text-[#6b7280]">A completion reply is required.</p>

        <label className="mt-3 grid gap-2 text-sm font-medium text-[#111827]">
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
          <Button
            type="button"
            variant="outline"
            disabled={actions.markDone.isPending}
            onClick={() => setIsOpen(false)}
          >
            Close
          </Button>
        </div>
      </form>
    </div>
  );
}
