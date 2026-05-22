'use client';

import { animate } from 'animejs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from "next-intl";
import { Button } from '@/components/ui/button';
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_SCALE,
} from '@/lib/animation/constants';
import { useRequestActions } from '@/hooks/use-request-actions';

export function CancelDialog({ requestId }: { requestId: string }) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const actions = useRequestActions();
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [reason, setReason] = useState('');
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLFormElement | null>(null);

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

    try {
      await actions.cancel.mutateAsync({
        requestId,
        payload: { reason: reason.trim() || null },
      });
      setReason('');
      await closeDialog();
    } catch {
      // The parent action error state is rendered by RequestActions.
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
      if (event.key === 'Escape' && !actions.cancel.isPending) {
        void closeDialog();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMounted, actions.cancel.isPending, closeDialog]);

  if (!isMounted) {
    return (
      <Button type='button' variant='outline' onClick={openDialog}>
        {t("actions.cancelRequest")}
      </Button>
    );
  }

  return (
    <div
      ref={overlayRef}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={(event) => {
        if (event.target === event.currentTarget && !actions.cancel.isPending) {
          void closeDialog();
        }
      }}
    >
      <form
        ref={panelRef}
        onSubmit={handleSubmit}
        role='dialog'
        aria-modal='true'
        aria-labelledby='cancel-dialog-title'
        className='w-full max-w-lg rounded-lg border border-red-200 bg-red-50 p-4'
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
            className='min-h-20 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-normal text-[#111827]'
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("actions.cancelReasonPlaceholder")}
            disabled={actions.cancel.isPending}
          />
        </label>
        {actions.cancel.error ? (
          <p className='mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700'>
            {actions.cancel.error instanceof Error
              ? actions.cancel.error.message
              : t("actions.cancelError")}
          </p>
        ) : null}
        <div className="mt-3 flex gap-2">
          <Button type="submit" disabled={actions.cancel.isPending || isClosing}>
            {actions.cancel.isPending ? t("actions.cancelling") : t("actions.confirmCancel")}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={actions.cancel.isPending || isClosing}
            onClick={() => void closeDialog()}
          >
            {tCommon("close")}
          </Button>
        </div>
      </form>
    </div>
  );
}
