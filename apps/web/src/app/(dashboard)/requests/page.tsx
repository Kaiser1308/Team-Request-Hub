import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RequestList } from "@/components/requests/request-list";
import { Button } from "@/components/ui/button";

export default async function RequestsPage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border border-[#e5e7eb] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h1 className="text-2xl font-semibold">{t("views.createdTitle")}</h1>
          <p className="mt-1 text-sm text-[#6b7280]">
            {t("views.createdDescription")}
          </p>
        </div>
        <Button asChild>
          <Link href="/requests/new">{t("list.createRequest")}</Link>
        </Button>
      </div>
      <RequestList view="created" emptyMessage={t("empty.created")} />
    </div>
  );
}
