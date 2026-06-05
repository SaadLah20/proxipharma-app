import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  effectiveLocale,
  isAppLocale,
  pickLocaleFromAcceptLanguage,
  type AppLocale,
} from "@/lib/i18n/config";
import { loadMessages } from "@/lib/i18n/load-messages";

async function resolveLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const pathname = headerStore.get("x-pathname") ?? "/";

  let cookieLocale: AppLocale = DEFAULT_LOCALE;
  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isAppLocale(raw)) {
    cookieLocale = raw;
  } else {
    cookieLocale = pickLocaleFromAcceptLanguage(headerStore.get("accept-language"));
  }

  return effectiveLocale(cookieLocale, pathname);
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
