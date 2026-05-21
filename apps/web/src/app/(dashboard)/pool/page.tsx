import { RequestList } from "@/components/requests/request-list";

export default function PoolPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">Pool</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Unassigned requests for backend teammates and leads. Use priority
          filtering to pick up the next best request.
        </p>
      </div>
      <RequestList
        view="pool"
        emptyMessage="The request pool is empty. Check back when new requests are submitted."
        forbiddenMessage="Pool access is limited to backend teammates and leads."
      />
    </div>
  );
}
