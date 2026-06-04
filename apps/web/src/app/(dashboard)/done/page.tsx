import { getTranslations } from "next-intl/server";
import { RequestList } from "@/components/requests/request-list";
import { PageHeader } from "@/components/shared/page-header";

export default async function DonePage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("views.doneTitle")}
        description={t("views.doneDescription")}
      />
      <RequestList view="done" emptyMessage={t("empty.done")} />
    </div>
  );
}
