import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { getValidLocale, localeCookieName } from "./config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = getValidLocale(cookieStore.get(localeCookieName)?.value);

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    timeZone: "Asia/Ho_Chi_Minh",
  };
});
