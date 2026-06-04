import { getTranslations } from "next-intl/server";
import { RequestForm } from "@/components/requests/request-form";
import { PageHeader } from "@/components/shared/page-header";

export default async function NewRequestPage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title={t("views.newTitle")}
          description={t("views.newDescription")}
        />
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <RequestForm />
      </div>
    </div>
  );
}
