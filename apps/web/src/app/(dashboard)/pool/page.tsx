import { getTranslations } from "next-intl/server";
import { RequestList } from "@/components/requests/request-list";
import { PageHeader } from "@/components/shared/page-header";

export default async function PoolPage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("views.poolTitle")}
        description={t("views.poolDescription")}
      />
      <RequestList
        view="pool"
        emptyMessage={t("empty.pool")}
        forbiddenMessage={t("forbidden.pool")}
      />
    </div>
  );
}
