"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import { useLocale } from "next-intl";
import type { PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestStatusBadge } from "@/components/requests/demande-hub-ui";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { usePatientProductHubCardContext } from "@/lib/i18n/patient-product-hub-card-context";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { one } from "@/lib/embed";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { usePatientHubCardCopy } from "@/lib/i18n/patient-hub-card-copy";
import { uiSecondaryLabel } from "@/lib/ui-label-styles";
import {
  hubDemandeCardAccent,
  hubDemandeCardAccentBarClass,
  hubDemandeCardContextClass,
  hubDemandeCardShellClass,
} from "@/lib/hub-demande-card-chrome";

export function PatientProductDemandeHubCard({
  row,
  conversationUnread = false,
}: {
  row: PatientRequestRow;
  compact?: boolean;
  conversationUnread?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const cardCopy = usePatientHubCardCopy();
  const ph = one(row.pharmacies);
  const ctx = usePatientProductHubCardContext(row);
  const refVisuel = displayRequestPublicRef(row);
  const when = formatDateTimeShortForLocale(row.updated_at ?? row.submitted_at ?? row.created_at, locale);
  const accent = hubDemandeCardAccent(row.request_type);
  const pharmacyTitle = ph?.nom
    ? pharmacyPublicLabel(ph.nom, { locale, nomAr: ph.nom_ar })
    : cardCopy.pharmacyFallback;
  const locationLine = ph?.ville?.trim() ? ph.ville.trim() : null;
  const contextLine = ctx.secondaryLine ? `${ctx.primaryLine} · ${ctx.secondaryLine}` : ctx.primaryLine;

  return (
    <article
      className={clsx(
        hubDemandeCardShellClass(accent),
        "relative overflow-hidden transition hover:-translate-y-px hover:shadow-md",
      )}
    >
      <div className={clsx("absolute inset-y-0 left-0 w-1", hubDemandeCardAccentBarClass(accent))} aria-hidden />
      <Link href={`/dashboard/demandes/${row.id}`} className="group block py-3 pl-3.5 pr-3 sm:py-3.5 sm:pl-4">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <RequestStatusBadge status={row.status} role="patient" />
                {conversationUnread ? (
                  <span className={uiSecondaryLabel} title={cardCopy.messageUnreadTitle}>
                    {cardCopy.message}
                  </span>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-[11px]">
                {refVisuel}
              </span>
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-snug text-foreground sm:text-[15px]">{pharmacyTitle}</p>
                {locationLine ? (
                  <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{locationLine}</p>
                ) : null}
              </div>
              <ChevronRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 transition group-hover:text-foreground"
                aria-hidden
              />
            </div>

            <p
              className={clsx(
                "line-clamp-2 text-[11px] leading-snug sm:text-xs",
                hubDemandeCardContextClass(ctx.emphasis, accent),
              )}
            >
              {contextLine}
            </p>

            <p className="text-[10px] tabular-nums text-muted-foreground">{cardCopy.lastActivity(when)}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}
