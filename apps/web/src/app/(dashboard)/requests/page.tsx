import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RequestList } from "@/components/requests/request-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";

export default async function RequestsPage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("views.createdTitle")}
        description={t("views.createdDescription")}
        action={
          <Button asChild>
            <Link href="/requests/new">{t("list.createRequest")}</Link>
          </Button>
        }
      />
      <RequestList view="created" emptyMessage={t("empty.created")} />
    </div>
  );
}
