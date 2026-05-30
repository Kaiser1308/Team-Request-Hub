"use client";

import * as React from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import type { UserSummary } from "@/types";

interface UserMultiSelectProps {
  users: UserSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function formatUserLabel(user: UserSummary): string {
  if (user.name && user.email) return `${user.name} (${user.email})`;
  return user.name ?? user.email ?? user.id;
}

export function UserMultiSelect({
  users,
  selectedIds,
  onChange,
  placeholder = "Select assignees...",
  className,
  disabled = false,
}: UserMultiSelectProps) {
  const selectedUsers = React.useMemo(
    () => users.filter((u) => selectedIds.includes(u.id)),
    [users, selectedIds],
  );

  const handleSelect = React.useCallback(
    (user: UserSummary) => {
      if (!selectedIds.includes(user.id)) {
        onChange([...selectedIds, user.id]);
      }
    },
    [selectedIds, onChange],
  );

  const handleRemove = React.useCallback(
    (user: UserSummary) => {
      onChange(selectedIds.filter((id) => id !== user.id));
    },
    [selectedIds, onChange],
  );

  const isSelected = React.useCallback(
    (user: UserSummary) => selectedIds.includes(user.id),
    [selectedIds],
  );

  const getKey = React.useCallback((user: UserSummary) => user.id, []);

  const filterFn = React.useCallback(
    (user: UserSummary, query: string) => {
      const q = query.toLowerCase();
      return (
        (user.name?.toLowerCase().includes(q) ?? false) ||
        (user.email?.toLowerCase().includes(q) ?? false)
      );
    },
    [],
  );

  const renderOption = React.useCallback((user: UserSummary) => (
    <div className="flex flex-col">
      {user.name && <span className="text-sm">{user.name}</span>}
      {user.email && (
        <span className="text-xs text-muted-foreground">{user.email}</span>
      )}
    </div>
  ), []);

  const renderBadge = React.useCallback(
    (user: UserSummary) => <span>{user.name ?? user.email ?? user.id}</span>,
    [],
  );

  return (
    <MultiSelect
      options={users}
      selected={selectedUsers}
      onSelect={handleSelect}
      onRemove={handleRemove}
      renderOption={renderOption}
      renderBadge={renderBadge}
      isSelected={isSelected}
      getKey={getKey}
      filterFn={filterFn}
      placeholder={placeholder}
      searchPlaceholder="Search by name or email..."
      emptyMessage="No users found."
      className={className}
      disabled={disabled}
    />
  );
}
