import { RequestForm } from "@/components/requests/request-form";

export default function NewRequestPage() {
  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold">Create request</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          Send a clear internal request to the team.
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <RequestForm />
      </div>
    </div>
  );
}
