import { getTranslations } from "next-intl/server";
import { RequestList } from "@/components/requests/request-list";

export default async function DonePage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">{t("views.doneTitle")}</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          {t("views.doneDescription")}
        </p>
      </div>
      <RequestList view="done" emptyMessage={t("empty.done")} />
    </div>
  );
}
