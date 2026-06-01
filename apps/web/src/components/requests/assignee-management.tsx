"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  formatUserLabel,
  formatUserSummaryLabel,
} from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
import { useRequestActions } from "@/hooks/use-request-actions";
import type { InternalRequest, UserSummary } from "@/types";

function isActiveStatus(status: InternalRequest["status"]) {
  return status === "acknowledged" || status === "in_progress";
}

export function AssigneeManagement({ request }: { request: InternalRequest }) {
  const t = useTranslations("requests");
  const activeUsersQuery = useActiveUsers();
  const actions = useRequestActions();
  const [selectedUserId, setSelectedUserId] = useState("");
  const [removeReasonByUser, setRemoveReasonByUser] = useState<
    Record<string, string>
  >({});
  const assignees = request.assignees ?? [];
  const assignedIds = new Set(assignees.map((assignee) => assignee.id));
  const availableUsers = (activeUsersQuery.data ?? []).filter(
    (user) => !assignedIds.has(user.id),
  );
  const requiresReason = isActiveStatus(request.status);

  async function addAssignee() {
    if (!selectedUserId) return;
    await actions.addAssignee.mutateAsync({
      requestId: request.id,
      payload: { user_id: selectedUserId },
    });
    setSelectedUserId("");
  }

  async function removeAssignee(assignee: UserSummary) {
    const reason = removeReasonByUser[assignee.id]?.trim() ?? "";
    await actions.removeAssignee.mutateAsync({
      requestId: request.id,
      userId: assignee.id,
      payload: { reason: reason || null },
    });
    setRemoveReasonByUser((current) => ({ ...current, [assignee.id]: "" }));
  }

  const isAdding = actions.addAssignee.isPending;

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          className="h-10 flex-1 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm"
          value={selectedUserId}
          onChange={(event) => setSelectedUserId(event.target.value)}
          disabled={activeUsersQuery.isLoading || isAdding}
        >
          <option value="">{t("actions.selectTeammate")}</option>
          {availableUsers.map((user) => (
            <option key={user.id} value={user.id}>
              {formatUserLabel(user)}
            </option>
          ))}
        </select>
        <Button
          type="button"
          onClick={() => void addAssignee()}
          disabled={!selectedUserId || isAdding}
        >
          {isAdding ? t("actions.adding") : t("actions.addAssignee")}
        </Button>
      </div>

      <div className="grid gap-2">
        {assignees.map((assignee) => (
          <AssigneeRow
            key={assignee.id}
            assignee={assignee}
            requiresReason={requiresReason}
            reason={removeReasonByUser[assignee.id] ?? ""}
            onReasonChange={(value) =>
              setRemoveReasonByUser((current) => ({ ...current, [assignee.id]: value }))
            }
            onRemove={() => void removeAssignee(assignee)}
            isRemoving={actions.removeAssignee.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function AssigneeRow({
  assignee,
  requiresReason,
  reason,
  onReasonChange,
  onRemove,
  isRemoving,
}: {
  assignee: UserSummary;
  requiresReason: boolean;
  reason: string;
  onReasonChange: (value: string) => void;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const t = useTranslations("requests");

  return (
    <div className="flex items-center gap-2 rounded-md border border-[#e5e7eb] bg-white p-2">
      <span className="min-w-0 flex-1 truncate text-sm text-[#4b5563]">
        {formatUserSummaryLabel(assignee) ?? assignee.id}
      </span>
      {requiresReason ? (
        <input
          className="h-7 w-32 rounded border border-[#e5e7eb] px-2 text-xs"
          placeholder={t("actions.reason")}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
        />
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={onRemove}
        disabled={isRemoving}
      >
        {isRemoving ? "..." : t("actions.removeAssignee")}
      </Button>
    </div>
  );
}
