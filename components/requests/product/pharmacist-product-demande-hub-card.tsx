"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestStatusBadge } from "@/components/requests/demande-hub-ui";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { pharmacistProductHubCardContextFr } from "@/lib/pharmacist-product-hub-sections";
import { formatShortId } from "@/lib/request-display";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { uiSecondaryLabel } from "@/lib/ui-label-styles";

function cardShell(requestType: string | null | undefined): string {
  if (requestType === "product_request") {
    return "rounded-xl border border-sky-200/55 bg-card shadow-sm ring-1 ring-sky-100/40";
  }
  if (requestType === "prescription") {
    return "rounded-xl border border-amber-200/50 bg-card shadow-sm ring-1 ring-amber-100/30";
  }
  if (requestType === "free_consultation") {
    return "rounded-xl border border-violet-200/55 bg-card shadow-sm ring-1 ring-violet-100/35";
  }
  return "rounded-xl border border-border bg-card shadow-sm ring-1 ring-black/[0.02]";
}

function patientLabel(row: PharmacistRequestRow): string {
  const name = row.patient_full_name?.trim();
  const pref = row.patient_ref?.trim();
  const tag = pref ? pref : `#${formatShortId(row.patient_id)}`;
  return name ? `${name} · ${tag}` : `Patient ${tag}`;
}

export function PharmacistProductDemandeHubCard({
  row,
  compact = false,
  conversationUnread = false,
}: {
  row: PharmacistRequestRow;
  compact?: boolean;
  conversationUnread?: boolean;
}) {
  const ctx = pharmacistProductHubCardContextFr(row);
  const refVisuel = displayRequestPublicRef(row);
  const when = formatDateTimeShort24hFr(row.updated_at ?? row.submitted_at ?? row.created_at);
  const detailPath = `/dashboard/pharmacien/demandes/${row.id}`;

  return (
    <article className={clsx(cardShell(row.request_type), "transition hover:-translate-y-px hover:shadow-md")}>
      <Link href={detailPath} className={clsx("group block", compact ? "p-2.5" : "p-3 sm:p-3.5")}>
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <RequestStatusBadge status={row.status} role="pharmacien" />
              {conversationUnread ? (
                <span className={uiSecondaryLabel} title="Conversation non lue">
                  Message
                </span>
              ) : null}
            </div>

            <div>
              <p className="truncate text-sm font-bold leading-tight text-foreground sm:text-[15px]">
                {patientLabel(row)}
              </p>
              <p className="mt-0.5 font-mono text-[11px] font-semibold text-muted-foreground">{refVisuel}</p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/25 px-2 py-1.5 text-[11px] leading-snug text-foreground sm:text-xs">
              <p className="font-semibold">{ctx.primaryLine}</p>
              {ctx.secondaryLine && !compact ? (
                <p className="mt-0.5 text-[10px] font-medium opacity-90 sm:text-[11px]">{ctx.secondaryLine}</p>
              ) : null}
            </div>

            <p className="text-[10px] tabular-nums text-muted-foreground">Dernière activité · {when}</p>
          </div>

          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition group-hover:bg-muted/50"
            aria-hidden
          >
            →
          </span>
        </div>
      </Link>
    </article>
  );
}
