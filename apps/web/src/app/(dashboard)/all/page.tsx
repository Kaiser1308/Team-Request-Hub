import { getTranslations } from "next-intl/server";
import { AllRequestsBoard } from "@/components/requests/all-requests-board";
import { PageHeader } from "@/components/shared/page-header";

export default async function AllRequestsPage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("views.allTitle")}
        description={t("views.allDescription")}
      />
      <AllRequestsBoard
        emptyMessage={t("empty.all")}
        forbiddenMessage={t("forbidden.all")}
      />
    </div>
  );
}
