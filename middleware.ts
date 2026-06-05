import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isAppLocale,
  isFrenchOnlyPath,
  pickLocaleFromAcceptLanguage,
} from "@/lib/i18n/config";
import { routing } from "@/lib/i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (isFrenchOnlyPath(pathname)) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
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
    const response = intlMiddleware(new NextRequest(request.url, { headers: requestHeaders }));
    response.cookies.set(LOCALE_COOKIE, detected, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    response.headers.set("x-pathname", pathname);
    return response;
  }

  const response = intlMiddleware(new NextRequest(request.url, { headers: requestHeaders }));
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
