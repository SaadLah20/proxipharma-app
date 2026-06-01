"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestStatusBadge } from "@/components/requests/demande-hub-ui";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { patientProductHubCardContextFr } from "@/lib/patient-product-hub-sections";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { one } from "@/lib/embed";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { uiSecondaryLabel } from "@/lib/ui-label-styles";

/** Carte hub uniforme — le statut porte la couleur (badge), pas toute la carte. */
function cardShell(_status: string): string {
  return "rounded-xl border border-border bg-card shadow-sm ring-1 ring-black/[0.02]";
}

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
    <article className={clsx(cardShell(row.status), "transition hover:-translate-y-px hover:shadow-md")}>
      <Link
        href={`/dashboard/demandes/${row.id}`}
        className={clsx("group block", compact ? "p-2.5" : "p-3 sm:p-3.5")}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <RequestStatusBadge status={row.status} role="patient" />
              {conversationUnread ? (
                <span className={uiSecondaryLabel} title="Conversation non lue">
                  Message
                </span>
              ) : null}
            </div>

            <div>
              <p className="text-sm font-bold leading-snug break-words text-foreground sm:text-[15px]">
                {ph?.nom ? pharmacyPublicLabel(ph.nom) : "Pharmacie"}
              </p>
              {ph?.ville ? (
                <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{ph.ville}</p>
              ) : null}
              <p className="mt-0.5 font-mono text-[11px] font-semibold text-muted-foreground">{refVisuel}</p>
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/25 px-2 py-1.5 text-[11px] leading-snug text-foreground sm:text-xs">
              <p className="font-semibold">{ctx.primaryLine}</p>
              {ctx.secondaryLine ? (
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
