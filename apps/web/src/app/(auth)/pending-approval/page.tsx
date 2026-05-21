import { LogoutButton } from "@/components/auth/logout-button";

export default function PendingApprovalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
      <div className="grid max-w-lg gap-4 rounded-lg border border-[#e5e7eb] bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold">Waiting for lead approval</h1>
        <p className="text-sm leading-6 text-[#4b5563]">
          Your account has been created, but a lead must approve it before you can use Team Request Hub.
        </p>
        <div className="mx-auto">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
