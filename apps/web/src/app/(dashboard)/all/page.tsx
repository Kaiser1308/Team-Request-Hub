import { getTranslations } from "next-intl/server";
import { AllRequestsBoard } from "@/components/requests/all-requests-board";

export default async function AllRequestsPage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">{t("views.allTitle")}</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          {t("views.allDescription")}
        </p>
      </div>
      <AllRequestsBoard
        emptyMessage={t("empty.all")}
        forbiddenMessage={t("forbidden.all")}
      />
    </div>
  );
}
