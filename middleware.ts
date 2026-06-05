import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isAppLocale,
  isFrenchOnlyPath,
  pickLocaleFromAcceptLanguage,
} from "@/lib/i18n/config";

/**
 * Cookie locale + header x-pathname pour i18n/request.ts.
 * Pas de middleware next-intl routing : localePrefix « never » réécrit en /fr|/ar
 * alors que les pages ne sont pas sous app/[locale]/ → 404 en prod.
 */
export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (isFrenchOnlyPath(pathname)) {
    response.cookies.set(LOCALE_COOKIE, DEFAULT_LOCALE, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return response;
  }

  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!isAppLocale(existing)) {
    const detected = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
    response.cookies.set(LOCALE_COOKIE, detected, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
