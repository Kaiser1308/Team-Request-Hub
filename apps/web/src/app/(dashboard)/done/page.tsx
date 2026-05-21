import { RequestList } from "@/components/requests/request-list";

export default function DonePage() {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">Done</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Completed requests relevant to your work, with completion timestamps
          and quick links to full details.
        </p>
      </div>
      <RequestList
        view="done"
        emptyMessage="No completed requests yet. Completed work will appear here."
      />
    </div>
  );
}
