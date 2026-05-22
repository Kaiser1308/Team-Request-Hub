'use client';

import { animate } from 'animejs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from "next-intl";
import { formatUserLabel } from '@/components/requests/user-display';
import { Button } from '@/components/ui/button';
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_SCALE,
} from '@/lib/animation/constants';
import { useActiveUsers } from '@/hooks/use-users';
import { useRequestActions } from '@/hooks/use-request-actions';

export function ReassignDialog({ requestId }: { requestId: string }) {
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const actions = useRequestActions();
  const activeUsersQuery = useActiveUsers();
  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [assignedTo, setAssignedTo] = useState('');
  const [reason, setReason] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
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
      setAssignedTo('');
      setReason('');
      await closeDialog();
    } catch {}
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
      if (event.key === 'Escape' && !actions.reassign.isPending) {
        void closeDialog();
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMounted, actions.reassign.isPending, closeDialog]);

  if (!isMounted) {
    return (
      <Button type='button' variant='outline' onClick={openDialog}>
        {t("actions.reassign")}
      </Button>
    );
  }

  return (
    <div
      ref={overlayRef}
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4'
      onClick={(event) => {
        if (event.target === event.currentTarget && !actions.reassign.isPending) {
          void closeDialog();
        }
      }}
    >
      <form
        ref={panelRef}
        onSubmit={handleSubmit}
        role='dialog'
        aria-modal='true'
        aria-labelledby='reassign-dialog-title'
        className='w-full max-w-lg rounded-lg border border-[#e5e7eb] bg-white p-4'
      >
        <h3
          id='reassign-dialog-title'
          className='text-base font-semibold text-[#111827]'
        >
          {t("actions.reassignTitle")}
        </h3>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-[#111827]">
            {t("actions.assignee")}
            <select
              className='h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm'
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
              className='min-h-20 rounded-md border border-[#e5e7eb] px-3 py-2 text-sm font-normal'
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t("actions.optionalReason")}
              disabled={actions.reassign.isPending}
            />
          </label>
        </div>

        {validationError || actions.reassign.error ? (
          <p className='mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {validationError ??
              (actions.reassign.error instanceof Error
                ? actions.reassign.error.message
                : t("actions.reassignError"))}
          </p>
        ) : null}

        <div className="mt-3 flex gap-2">
          <Button type="submit" disabled={actions.reassign.isPending || isClosing}>
            {actions.reassign.isPending ? t("actions.reassigning") : t("actions.confirmReassign")}
          </Button>
          <Button
            type='button'
            variant='outline'
            disabled={actions.reassign.isPending || isClosing}
            onClick={() => void closeDialog()}
          >
            {tCommon("close")}
          </Button>
        </div>
      </form>
    </div>
  );
}
