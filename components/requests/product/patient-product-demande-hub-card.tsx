"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import type { PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestStatusBadge } from "@/components/requests/demande-hub-ui";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { patientProductHubCardContextFr } from "@/lib/patient-product-hub-sections";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { one } from "@/lib/embed";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { neutralCardShell } from "@/lib/design-system/request-kind-accent";
import { Badge } from "@/components/ui/badge";

export function PatientProductDemandeHubCard({
  row,
  compact = false,
  conversationUnread = false,
}: {
  row: PatientRequestRow;
  compact?: boolean;
  conversationUnread?: boolean;
}) {
  const ph = one(row.pharmacies);
  const ctx = patientProductHubCardContextFr(row);
  const refVisuel = displayRequestPublicRef(row);
  const when = formatDateTimeShort24hFr(row.updated_at ?? row.submitted_at ?? row.created_at);

  return (
    <article className={clsx(neutralCardShell, "transition hover:-translate-y-px hover:shadow-md")}>
      <Link
        href={`/dashboard/demandes/${row.id}`}
        className={clsx("group block", compact ? "p-3" : "p-4")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <RequestStatusBadge status={row.status} role="patient" />
              {conversationUnread ? (
                <Badge variant="attention">Message</Badge>
              ) : null}
            </div>

            <div>
              <p className="text-[15px] font-semibold leading-snug break-words text-foreground">
                {ph?.nom ? pharmacyPublicLabel(ph.nom) : "Pharmacie"}
              </p>
              {ph?.ville ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{ph.ville}</p>
              ) : null}
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
