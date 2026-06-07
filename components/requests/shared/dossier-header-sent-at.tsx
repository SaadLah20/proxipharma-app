"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDossierSentAtCompactForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { uiEyebrowLabel } from "@/lib/ui-label-styles";
import { cn } from "@/lib/utils";

/** Ligne bandeau : « Demande N° D010/26 · Envoyée le 01/06/26 - 16h22 » */
export function DossierHeaderRequestLine({
  kindLabel = "Demande",
  dossierRefLabel,
  submittedAt,
  createdAt,
  hideSentAt = false,
  className,
}: {
  kindLabel?: string;
  dossierRefLabel: string;
  submittedAt?: string | null;
  createdAt?: string | null;
  /** Masquer la date d'envoi (ex. bandeau pharmacien archives). */
  hideSentAt?: boolean;
  className?: string;
}) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");
  const iso = submittedAt ?? createdAt;
  const sentCompact = iso?.trim() ? formatDossierSentAtCompactForLocale(iso, locale) : null;

  return (
    <p className={cn("text-[11px] font-bold leading-snug text-foreground sm:text-xs", className)}>
      <span className={uiEyebrowLabel}>{kindLabel}</span>{" "}
      <span className="font-mono text-[13px] tabular-nums text-foreground sm:text-sm">N° {dossierRefLabel}</span>
      {!hideSentAt && sentCompact ? (
        <>
          <span className="mx-1.5 font-normal text-muted-foreground" aria-hidden>
            ·
          </span>
          <span className="font-normal text-muted-foreground">
            {t("sentOn")}{" "}
            <time dateTime={iso ?? undefined} className="font-semibold tabular-nums text-foreground">
              {sentCompact}
            </time>
          </span>
        </>
      ) : null}
    </p>
  );
}
