"use client";

import { animate, stagger } from "animejs";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { CancelDialog } from "@/components/requests/cancel-dialog";
import { DoneDialog } from "@/components/requests/done-dialog";
import { ReassignDialog } from "@/components/requests/reassign-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useRequestActions } from "@/hooks/use-request-actions";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_STAGGER,
} from "@/lib/animation/constants";
import type { InternalRequest } from "@/types";

function getReadableError(error: unknown): string | null {
  if (error instanceof ApiError && error.detail.trim()) {
    return error.detail;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return null;
}

export function RequestActions({ request }: { request: InternalRequest }) {
  const t = useTranslations("requests");
  const { data: currentUser } = useCurrentUser();
  const actions = useRequestActions();
  const actionRowRef = useRef<HTMLDivElement | null>(null);
  const isLead = currentUser?.role === "lead";
  const isCreator = currentUser?.id === request.created_by;
  const isAssignee = currentUser?.id === request.assigned_to;
  const isWorker = currentUser?.role === "be" || currentUser?.role === "fe" || isLead;
  const isClosed = request.status === "done" || request.status === "cancelled";
  const shouldRender = Boolean(currentUser) && !isClosed;
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
  const canReassign = !isClosed && (isLead || isCreator || isAssignee);

  useEffect(() => {
    if (!shouldRender) {
      return;
    }

    const container = actionRowRef.current;
    if (!container) {
      return;
    }

    const targets = Array.from(container.querySelectorAll<HTMLElement>("button"));
    if (!targets.length) {
      return;
    }

    const animation = animate(targets, {
      y: [MOTION_OFFSET.tiny, 0],
      opacity: [0, 1],
      duration: MOTION_DURATION.page,
      delay: stagger(MOTION_STAGGER.compact, { from: "first" }),
      ease: MOTION_EASE.entrance,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, [request.id, request.status, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const actionError =
    getReadableError(actions.selfAssign.error) ??
    getReadableError(actions.updateStatus.error) ??
    getReadableError(actions.cancel.error) ??
    getReadableError(actions.markDone.error) ??
    getReadableError(actions.reassign.error);

  return (
    <div className="mt-5 space-y-3">
      <div ref={actionRowRef} className="flex flex-wrap gap-2">
        {canSelfAssign ? (
          <Button
            type="button"
            disabled={actions.selfAssign.isPending}
            onClick={() => actions.selfAssign.mutate(request.id)}
          >
            {actions.selfAssign.isPending ? t("actions.assigning") : t("actions.selfAssign")}
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
            {t("actions.acknowledge")}
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
            {t("actions.start")}
          </Button>
        ) : null}

        {canDone ? <DoneDialog requestId={request.id} /> : null}
        {canReassign ? <ReassignDialog requestId={request.id} /> : null}
        {canCancel ? <CancelDialog requestId={request.id} /> : null}
      </div>

      {actionError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
