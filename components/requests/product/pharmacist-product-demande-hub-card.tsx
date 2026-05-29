"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestStatusBadge } from "@/components/requests/demande-hub-ui";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { pharmacistProductHubCardContextFr } from "@/lib/pharmacist-product-hub-sections";
import { formatShortId } from "@/lib/request-display";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";

function cardShell(status: string): string {
  const closed = [
    "completed",
    "cancelled",
    "abandoned",
    "expired",
    "partially_collected",
    "fully_collected",
    "draft",
  ];
  if (closed.includes(status)) {
    return "rounded-xl border border-slate-200/90 bg-slate-50/50 ring-1 ring-slate-200/60";
  }
  if (status === "responded") {
    return "rounded-xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 ring-1 ring-amber-200/70";
  }
  if (status === "treated") {
    return "rounded-xl border-2 border-violet-300/70 bg-gradient-to-br from-violet-50/50 via-white to-sky-50/30 ring-1 ring-violet-200/55";
  }
  if (status === "confirmed") {
    return "rounded-xl border-2 border-teal-300/75 bg-gradient-to-br from-teal-50/45 via-white to-sky-50/25 ring-1 ring-teal-200/60";
  }
  if (status === "submitted" || status === "in_review") {
    return "rounded-xl border-2 border-sky-300/55 bg-gradient-to-br from-sky-50/70 via-white to-teal-50/20 ring-1 ring-sky-200/55";
  }
  return "rounded-xl border border-border/80 bg-card ring-1 ring-black/[0.03]";
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
    <article className={clsx(cardShell(row.status), "transition hover:-translate-y-px hover:shadow-md")}>
      <Link href={detailPath} className={clsx("group block", compact ? "p-2.5" : "p-3 sm:p-3.5")}>
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <RequestStatusBadge status={row.status} role="pharmacien" />
              {conversationUnread ? (
                <span
                  className="inline-flex items-center rounded-full bg-sky-600 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white"
                  title="Conversation non lue"
                >
                  Message
                </span>
              ) : null}
            </div>

            <div>
              <p className="truncate text-sm font-bold leading-tight text-foreground sm:text-[15px]">
                {patientLabel(row)}
              </p>
              <p className="mt-0.5 font-mono text-[11px] font-semibold text-emerald-900/90">{refVisuel}</p>
            </div>

            <div
              className={clsx(
                "rounded-lg px-2 py-1.5 text-[11px] leading-snug sm:text-xs",
                ctx.emphasis === "urgent" && "bg-amber-100/80 text-amber-950 ring-1 ring-amber-200/70",
                ctx.emphasis === "info" && "bg-sky-50/90 text-sky-950 ring-1 ring-sky-200/55",
                ctx.emphasis === "success" && "bg-emerald-50/90 text-emerald-950 ring-1 ring-emerald-200/60",
                ctx.emphasis === "muted" && "bg-slate-100/80 text-slate-700 ring-1 ring-slate-200/60"
              )}
            >
              <p className="font-semibold">{ctx.primaryLine}</p>
              {ctx.secondaryLine ? (
                <p className="mt-0.5 text-[10px] font-medium opacity-90 sm:text-[11px]">{ctx.secondaryLine}</p>
              ) : null}
            </div>

            <p className="text-[10px] tabular-nums text-muted-foreground">Dernière activité · {when}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}
