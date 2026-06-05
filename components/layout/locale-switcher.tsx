"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { Languages } from "lucide-react";
import { LOCALE_COOKIE, type AppLocale } from "@/lib/i18n/config";

type LocaleSwitcherProps = {
  /** Masquer pour pharmacien / admin connectés. */
  visible?: boolean;
};

export function LocaleSwitcher({ visible = true }: LocaleSwitcherProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("header.locale");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const setLocale = useCallback(
    (next: AppLocale) => {
      if (next === locale) {
        setOpen(false);
        return;
      }
      document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
      setOpen(false);
      router.refresh();
    },
    [locale, router],
  );

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!visible) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
        aria-label={t("ariaLabel")}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Languages className="h-5 w-5" />
        <span className="absolute -bottom-0.5 -right-0.5 rounded bg-slate-900 px-1 text-[9px] font-bold uppercase text-white">
          {locale}
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t("choose")}
          className="absolute right-0 top-full z-50 mt-2 min-w-[8.5rem] overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-xl"
        >
          <li role="option" aria-selected={locale === "fr"}>
            <button
              type="button"
              onClick={() => setLocale("fr")}
              className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/80 ${locale === "fr" ? "font-semibold text-primary" : ""}`}
            >
              <span>{t("french")}</span>
              <span className="text-xs uppercase text-muted-foreground">FR</span>
            </button>
          </li>
          <li role="option" aria-selected={locale === "ar"}>
            <button
              type="button"
              onClick={() => setLocale("ar")}
              className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-muted/80 ${locale === "ar" ? "font-semibold text-primary" : ""}`}
            >
              <span>{t("arabic")}</span>
              <span className="text-xs uppercase text-muted-foreground">AR</span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  );
}
