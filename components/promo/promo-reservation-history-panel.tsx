"use client";

import { ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import {
  promoReservationHistoryEventLabel,
  type PromoReservationHistoryRow,
} from "@/lib/promo/promo-reservation-history-labels";
import { cn } from "@/lib/utils";

export function PromoReservationHistoryPanel({
  rows,
  role,
  busy = false,
  onRefresh,
  className,
}: {
  rows: PromoReservationHistoryRow[];
  role: "patient" | "pharmacien";
  busy?: boolean;
  onRefresh?: () => void;
  className?: string;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("promo");
  const tTimeline = useTranslations("timeline");

  return (
    <details
      className={cn(
        "group scroll-mb-8 rounded-xl border border-border/80 bg-card shadow-sm",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 marker:content-none sm:px-3 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {t("history.title")}
          </span>
          <p className="text-[11px] font-medium text-foreground">
            {rows.length === 0
              ? t("history.empty")
              : rows.length === 1
                ? t("history.eventsOpen", { count: rows.length })
                : t("history.eventsOpenPlural", { count: rows.length })}
          </p>
        </div>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border/70 px-2.5 pb-2.5 pt-1.5 sm:px-3">
        {onRefresh ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={onRefresh}
              className="inline-flex h-7 items-center justify-center rounded-md border border-border bg-background px-2 text-[10px] font-semibold text-foreground shadow-sm hover:bg-muted/40 disabled:opacity-50"
            >
              {tTimeline("dossier.refresh")}
            </button>
          </div>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{t("history.emptyDetail")}</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-lg border border-border/70 bg-muted/15 px-2.5 py-2 text-[11px]"
              >
                <p className="font-semibold text-foreground">
                  {promoReservationHistoryEventLabel(row, role)}
                </p>
                <p className="mt-0.5 tabular-nums text-muted-foreground">
                  {formatDateTimeShortForLocale(row.created_at, locale)}
                </p>
                {row.note?.trim() ? (
                  <p className="mt-1 whitespace-pre-wrap leading-snug text-foreground/90">{row.note.trim()}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
