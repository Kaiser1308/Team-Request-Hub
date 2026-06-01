'use client';

import { animate } from 'animejs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from "next-intl";
import { AttachmentUpload } from '@/components/requests/attachment-upload';
import { Button } from '@/components/ui/button';
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_SCALE,
} from '@/lib/animation/constants';
import { useRequestActions } from '@/hooks/use-request-actions';
import { useRequestFileUpload } from '@/hooks/use-request-attachments';

export function DoneDialog({ requestId }: { requestId: string }) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const actions = useRequestActions();
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reply, setReply] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLFormElement | null>(null);
  const attachmentHook = useRequestFileUpload("done_reply");

  const openDialog = useCallback(() => {
    setIsClosing(false);
    setIsMounted(true);
  }, []);

  const closeDialog = useCallback(async () => {
    if (isClosing) {
      return;
    }

    const overlay = overlayRef.current;
    const panel = panelRef.current;
    setIsClosing(true);

    if (overlay) {
      animate(overlay, {
        opacity: [1, 0],
        duration: MOTION_DURATION.dialogOut,
        ease: MOTION_EASE.exit,
        autoplay: true,
      });
    }

    if (panel) {
      animate(panel, {
        y: [0, MOTION_OFFSET.small],
        opacity: [1, 0],
        scale: MOTION_SCALE.dialogOut,
        duration: MOTION_DURATION.dialogOut,
        ease: MOTION_EASE.exit,
        autoplay: true,
      });
    }

    window.setTimeout(() => {
      setIsMounted(false);
      setIsClosing(false);
    }, MOTION_DURATION.dialogOut);
  }, [isClosing]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);

    if (!reply.trim()) {
      setValidationError(t("actions.replyRequired"));
      return;
    }

    try {
      const attachmentIds = await attachmentHook.uploadAll();
      await actions.markDone.mutateAsync({
        requestId,
        payload: { reply: reply.trim(), attachment_ids: attachmentIds },
      });
      setReply('');
      await closeDialog();
    } catch {
      // The mutation error is rendered below.
    }
  }

  useEffect(() => {
    if (!isMounted || isClosing) {
      return;
    }

    const overlay = overlayRef.current;
    const panel = panelRef.current;

    if (overlay) {
      animate(overlay, {
        opacity: [0, 1],
        duration: MOTION_DURATION.dialogIn,
        ease: MOTION_EASE.entrance,
        autoplay: true,
      });
    }

    if (panel) {
      animate(panel, {
        y: [MOTION_OFFSET.panel, 0],
        opacity: [0, 1],
        scale: MOTION_SCALE.dialogIn,
        duration: MOTION_DURATION.dialogIn,
        ease: MOTION_EASE.entrance,
        autoplay: true,
      });
    }
  }, [isMounted, isClosing]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !actions.markDone.isPending) {
        void closeDialog();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMounted, actions.markDone.isPending, closeDialog]);

  if (!isMounted) {
    return (
      <Button type='button' onClick={openDialog}>
        {t("actions.markDone")}
      </Button>
    );
  }

  return (
    <div
      ref={overlayRef}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={(event) => {
        if (event.target === event.currentTarget && !actions.markDone.isPending) {
          void closeDialog();
        }
      }}
    >
      <form
        ref={panelRef}
        onSubmit={handleSubmit}
        role='dialog'
        aria-modal='true'
        aria-labelledby='done-dialog-title'
        className='w-full max-w-lg rounded-lg border border-[#e5e7eb] bg-white p-4'
      >
        <h3 id="done-dialog-title" className="text-base font-semibold text-[#111827]">
          {t("actions.markDoneTitle")}
        </h3>
        <p className="mt-1 text-sm text-[#6b7280]">{t("actions.completionReplyRequired")}</p>

        <label className="mt-3 grid gap-2 text-sm font-medium text-[#111827]">
          {t("actions.doneReply")}
          <textarea
            className='min-h-24 rounded-md border border-[#e5e7eb] px-3 py-2 text-sm font-normal'
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={t("actions.doneReplyPlaceholder")}
            required
          />
        </label>

        <label className="mt-3 grid gap-2 text-sm font-medium text-[#111827]">
          {t("actions.attachments")}
          <AttachmentUpload hook={attachmentHook} />
        </label>

        {validationError || actions.markDone.error ? (
          <p className='mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {validationError ??
              (actions.markDone.error instanceof Error
                ? actions.markDone.error.message
                : t("actions.markDoneError"))}
          </p>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Button type="submit" disabled={actions.markDone.isPending || isClosing}>
            {actions.markDone.isPending ? t("actions.submitting") : t("actions.submitReply")}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={actions.markDone.isPending || isClosing}
            onClick={() => void closeDialog()}
          >
            {tCommon("close")}
          </Button>
        </div>
      </form>
    </div>
  );
}
