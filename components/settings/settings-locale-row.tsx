"use client";

import { clsx } from "clsx";
import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { AppLocale } from "@/lib/i18n/config";
import { setAppLocaleCookie } from "@/lib/i18n/set-app-locale-client";

export function SettingsLocaleRow() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("account");
  const th = useTranslations("header.locale");
  const router = useRouter();

  const setLocale = useCallback(
    (next: AppLocale) => {
      if (next === locale) return;
      setAppLocaleCookie(next);
      router.refresh();
    },
    [locale, router],
  );

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex min-w-0 items-start gap-2">
          <Languages className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{t("language")}</span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">{t("languageHint")}</span>
          </span>
        </span>
        <div
          className="flex shrink-0 gap-1 rounded-lg bg-muted/60 p-0.5 text-[11px]"
          role="group"
          aria-label={th("choose")}
        >
          {(["fr", "ar"] as const).map((code) => {
            const selected = locale === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={clsx(
                  "rounded-md px-2.5 py-1.5 font-semibold uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-pressed={selected}
              >
                {code}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
