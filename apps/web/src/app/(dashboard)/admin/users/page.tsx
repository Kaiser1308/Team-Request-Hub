import { UserRoleTable } from "@/components/admin/user-role-table";

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Lead-only role and approval management for Team Request Hub.
        </p>
      </div>
      <UserRoleTable />
    </div>
  );
}
