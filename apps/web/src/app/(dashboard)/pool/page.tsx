import { RequestList } from "@/components/requests/request-list";

export default function PoolPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Pool</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Unassigned requests available for teammates to review and pick up.
        </p>
      </div>
      <RequestList view="pool" emptyMessage="The request pool is empty." />
    </div>
  );
}
