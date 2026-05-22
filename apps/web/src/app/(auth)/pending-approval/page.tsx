import { getTranslations } from "next-intl/server";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function PendingApprovalPage() {
  const tAuth = await getTranslations("auth");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9fafb] px-4">
      <div className="grid max-w-lg gap-4 rounded-lg border border-[#e5e7eb] bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold">{tAuth("pendingApprovalTitle")}</h1>
        <p className="text-sm leading-6 text-[#4b5563]">
          {tAuth("pendingApprovalDescription")}
        </p>
        <div className="mx-auto">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
