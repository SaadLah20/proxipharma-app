"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import type { PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestStatusBadge } from "@/components/requests/demande-hub-ui";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { pharmacistProductHubCardContextFr } from "@/lib/pharmacist-product-hub-sections";
import { formatShortId } from "@/lib/request-display";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { uiSecondaryLabel } from "@/lib/ui-label-styles";
import {
  hubDemandeCardAccent,
  hubDemandeCardAccentBarClass,
  hubDemandeCardContextClass,
  hubDemandeCardShellClass,
} from "@/lib/hub-demande-card-chrome";

function patientTitle(row: PharmacistRequestRow): string {
  const name = row.patient_full_name?.trim();
  if (name) return name;
  const pref = row.patient_ref?.trim();
  const tag = pref ? pref : `#${formatShortId(row.patient_id)}`;
  return `Patient ${tag}`;
}

function patientTag(row: PharmacistRequestRow): string | null {
  const name = row.patient_full_name?.trim();
  const pref = row.patient_ref?.trim();
  const tag = pref ? pref : `#${formatShortId(row.patient_id)}`;
  return name ? tag : null;
}

function pharmacistHubCardContextLines(
  row: PharmacistRequestRow,
  ctx: ReturnType<typeof pharmacistProductHubCardContextFr>,
): { headline: string; detail?: string } {
  const patientName = row.patient_full_name?.trim();
  if (patientName && ctx.primaryLine.startsWith(patientName)) {
    return {
      headline: ctx.secondaryLine ?? ctx.primaryLine.slice(patientName.length).replace(/^[—–-]\s*/, "").trim(),
      detail: undefined,
    };
  }
  return {
    headline: ctx.primaryLine,
    detail: ctx.secondaryLine,
  };
}

export function PharmacistProductDemandeHubCard({
  row,
  conversationUnread = false,
  showParcoursLabel = false,
}: {
  row: PharmacistRequestRow;
  compact?: boolean;
  conversationUnread?: boolean;
  showParcoursLabel?: boolean;
}) {
  const ctx = pharmacistProductHubCardContextFr(row);
  const { headline, detail } = pharmacistHubCardContextLines(row, ctx);
  const contextLine = detail ? `${headline} · ${detail}` : headline;
  const refVisuel = displayRequestPublicRef(row);
  const when = formatDateTimeShort24hFr(row.updated_at ?? row.submitted_at ?? row.created_at);
  const accent = hubDemandeCardAccent(row.request_type);
  const parcoursLabel = showParcoursLabel ? getRequestKindConfig(row.request_type).theme.headerLabelShort : null;
  const tag = patientTag(row);

  return (
    <article
      className={clsx(
        hubDemandeCardShellClass(accent),
        "relative overflow-hidden transition hover:-translate-y-px hover:shadow-md",
      )}
    >
      <div className={clsx("absolute inset-y-0 left-0 w-1", hubDemandeCardAccentBarClass(accent))} aria-hidden />
      <Link
        href={`/dashboard/pharmacien/demandes/${row.id}`}
        className="group block py-3 pl-3.5 pr-3 sm:py-3.5 sm:pl-4"
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <RequestStatusBadge status={row.status} role="pharmacien" />
                {conversationUnread ? (
                  <span className={uiSecondaryLabel} title="Conversation non lue">
                    Message
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {parcoursLabel ? (
                  <span
                    className={clsx(
                      "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide sm:text-[10px]",
                      accent === "amber"
                        ? "bg-amber-100/90 text-amber-900"
                        : accent === "violet"
                          ? "bg-violet-100/90 text-violet-900"
                          : "bg-sky-100/90 text-sky-900",
                    )}
                  >
                    {parcoursLabel}
                  </span>
                ) : null}
                <span className="font-mono text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-[11px]">
                  {refVisuel}
                </span>
              </div>
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-snug text-foreground sm:text-[15px]">
                  {patientTitle(row)}
                </p>
                {tag ? <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-muted-foreground">{tag}</p> : null}
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

            <p className="text-[10px] tabular-nums text-muted-foreground">Dernière activité · {when}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}
