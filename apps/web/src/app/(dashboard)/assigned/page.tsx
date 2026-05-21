import { RequestList } from "@/components/requests/request-list";

export default function AssignedPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">Assigned to me</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Review active assignments, filter by status and priority, and move each
          request to its next step.
        </p>
      </div>
      <RequestList
        view="assigned"
        emptyMessage="No requests are assigned to you."
      />
    </div>
  );
}
