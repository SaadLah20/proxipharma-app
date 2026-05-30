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
import { neutralCardShell } from "@/lib/design-system/request-kind-accent";
import { Badge } from "@/components/ui/badge";

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
    <article className={clsx(neutralCardShell, "transition hover:-translate-y-px hover:shadow-md")}>
      <Link href={detailPath} className={clsx("group block", compact ? "p-3" : "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <RequestStatusBadge status={row.status} role="pharmacien" />
              {conversationUnread ? <Badge variant="attention">Message</Badge> : null}
            </div>

            <div>
              <p className="truncate text-[15px] font-semibold leading-tight text-foreground">
                {patientLabel(row)}
              </p>
              <p className="mt-0.5 font-mono text-xs font-medium text-muted-foreground">{refVisuel}</p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm leading-snug">
              <p className="font-medium text-foreground">{ctx.primaryLine}</p>
              {ctx.secondaryLine ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{ctx.secondaryLine}</p>
              ) : null}
            </div>

            <p className="text-xs tabular-nums text-muted-foreground">Dernière activité · {when}</p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>
      </Link>
    </article>
  );
}
