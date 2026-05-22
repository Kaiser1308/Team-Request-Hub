import { RequestList } from "@/components/requests/request-list";
import { AnimeSampleCard } from "@/components/app/anime-sample-card";

export default function PoolPage() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">Pool</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Unassigned requests available for anyone to pick up. Use priority
          filtering to find the next best request.
        </p>
      </div>
      <AnimeSampleCard />
      <RequestList
        view="pool"
        emptyMessage="The request pool is empty. Check back when new requests are submitted."
        forbiddenMessage="You do not have permission to view the pool."
      />
    </div>
  );
}
