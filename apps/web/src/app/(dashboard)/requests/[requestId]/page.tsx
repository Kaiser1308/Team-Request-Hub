import { RequestDetail } from "@/components/requests/request-detail";

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl">
      <RequestDetail requestId={requestId} />
    </div>
  );
}
