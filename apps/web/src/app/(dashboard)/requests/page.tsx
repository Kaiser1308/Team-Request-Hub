import Link from "next/link";
import { RequestList } from "@/components/requests/request-list";
import { Button } from "@/components/ui/button";

export default function RequestsPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-[#e5e7eb] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="text-2xl font-semibold">Created by me</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            Track requests you created, including status and assignee updates.
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">New request</Link>
        </Button>
      </div>
      <RequestList
        view="created"
        emptyMessage="You have not created requests yet. Start by creating your first request."
      />
    </div>
  );
}
