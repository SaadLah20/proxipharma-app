"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { LOCALE_COOKIE, type AppLocale } from "@/lib/i18n/config";

type LocaleRoleGuardProps = {
  role: "patient" | "pharmacien" | "admin" | null;
  booting: boolean;
};

/** Force FR pour pharmacien / admin (cookie + refresh si nécessaire). */
export function LocaleRoleGuard({ role, booting }: LocaleRoleGuardProps) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  useEffect(() => {
    if (booting) return;
    if (role !== "pharmacien" && role !== "admin") return;
    if (locale === "fr") return;
    document.cookie = `${LOCALE_COOKIE}=fr;path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
    router.refresh();
  }, [booting, locale, role, router]);

  return null;
}
