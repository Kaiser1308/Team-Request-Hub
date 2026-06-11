import { UserRoleTable } from "@/components/admin/user-role-table";
import { PageHeader } from "@/components/shared/page-header";

export default function AdminUsersPage() {
  return (
    <div className="space-y-3">
      <PageHeader
        title="Users"
        description="Lead-only role management with account approval controls."
      />
      <UserRoleTable />
    </div>
  );
}
