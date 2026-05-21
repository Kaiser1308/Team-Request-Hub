import { RequestList } from "@/components/requests/request-list";

export default function AllRequestsPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">All requests</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Lead-only compact view across the workspace with status and priority
          filters plus creator and assignee metadata on each request.
        </p>
      </div>
      <RequestList
        view="all"
        emptyMessage="No requests exist yet. New requests will appear here automatically."
        forbiddenMessage="Only leads can access the all-requests view."
      />
    </div>
  );
}
