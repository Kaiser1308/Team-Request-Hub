"use client";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useUpdateUserActiveState, useUpdateUserRole, useUsers } from "@/hooks/use-users";
import type { Role } from "@/types";

const roles: Role[] = ["fe", "be", "lead"];

function roleLabel(role: Role) {
  return role.toUpperCase();
}

export function UserRoleTable() {
  const currentUserQuery = useCurrentUser();
  const usersQuery = useUsers();
  const updateRole = useUpdateUserRole();
  const updateActive = useUpdateUserActiveState();

  if (currentUserQuery.isLoading || usersQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white p-3">
        <div className="h-4 w-48 animate-pulse rounded bg-[#f3f4f6]" />
        <div className="h-10 animate-pulse rounded bg-[#f3f4f6]" />
        <div className="h-10 animate-pulse rounded bg-[#f3f4f6]" />
      </div>
    );
  }

  if (currentUserQuery.data?.role !== "lead") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-medium text-amber-900">Forbidden</p>
        <p className="mt-1 text-sm text-amber-800">
          Only lead users can manage user roles and account access.
        </p>
      </div>
    );
  }

  if (usersQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-900">Could not load users</p>
        <p className="mt-1 text-sm text-red-700">
          {usersQuery.error instanceof Error
            ? usersQuery.error.message
            : "The backend returned an unexpected response."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void usersQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!usersQuery.data?.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">
        No users found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[#e5e7eb] bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[#f3f4f6] text-xs text-[#6b7280]">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Role</th>
            <th className="px-3 py-2 font-medium">State</th>
            <th className="px-3 py-2 font-medium">Access</th>
            <th className="px-3 py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {usersQuery.data.map((user) => (
            <tr key={user.id} className="border-t border-[#e5e7eb]">
              <td className="px-3 py-2 text-[#111827]">
                {user.name ?? "Unnamed"}
              </td>
              <td className="px-3 py-2 text-[#4b5563]">{user.email}</td>
              <td className="px-3 py-2">
                <select
                  className="h-9 rounded-md border border-[#e5e7eb] bg-white px-2 text-sm"
                  value={user.role}
                  disabled={updateRole.isPending}
                  onChange={(event) =>
                    updateRole.mutate({
                      userId: user.id,
                      role: event.target.value as Role,
                    })
                  }
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
                {updateRole.isPending ? (
                  <p className="mt-1 text-xs text-[#6b7280]">Saving role...</p>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <span className={user.is_active ? "text-green-700" : "text-amber-700"}>
                  {user.is_active ? "Active account" : "Pending approval"}
                </span>
              </td>
              <td className="px-3 py-2">
                <Button
                  type="button"
                  variant={user.is_active ? "outline" : "default"}
                  size="sm"
                  disabled={updateActive.isPending}
                  onClick={() =>
                    updateActive.mutate({
                      userId: user.id,
                      isActive: !user.is_active,
                    })
                  }
                >
                  {updateActive.isPending
                    ? user.is_active
                      ? "Disabling..."
                      : "Approving..."
                    : user.is_active
                      ? "Disable"
                      : "Approve"}
                </Button>
              </td>
              <td className="px-3 py-2 text-[#6b7280]">
                {new Intl.DateTimeFormat("en", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                }).format(new Date(user.created_at))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {updateRole.error ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {updateRole.error instanceof Error
            ? updateRole.error.message
            : "Could not update this user role."}
        </div>
      ) : null}

      {updateActive.error ? (
        <div className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {updateActive.error instanceof Error
            ? updateActive.error.message
            : "Could not update user access state."}
        </div>
      ) : null}
    </div>
  );
}
