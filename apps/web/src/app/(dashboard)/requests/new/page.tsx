import { getTranslations } from "next-intl/server";
import { RequestForm } from "@/components/requests/request-form";

export default async function NewRequestPage() {
  const t = await getTranslations("requests");

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold">{t("views.newTitle")}</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          {t("views.newDescription")}
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl">
        <RequestForm />
      </div>
    </div>
  );
}
