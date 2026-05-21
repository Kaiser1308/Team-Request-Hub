import { UserRoleTable } from "@/components/admin/user-role-table";

export default function AdminUsersPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-[#111827]">Users</h1>
        <p className="mt-1 text-sm tracking-normal text-[#6b7280]">
          Lead-only role management with account approval controls.
        </p>
      </div>
      <UserRoleTable />
    </div>
  );
}
