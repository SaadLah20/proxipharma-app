"use client";

import Link from "next/link";
import {
  formatShortId,
  requestStatusBadgeClass,
  requestStatusFr,
  requestTypeFr,
} from "@/lib/request-display";
import { one } from "@/lib/embed";
import { clsx } from "clsx";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";

export type HubTab = "dashboard" | "list";

type PharmEmbed = { nom: string; ville: string } | { nom: string; ville: string }[] | null;

export type PatientRequestRow = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  submitted_at?: string | null;
  responded_at?: string | null;
  pharmacies: PharmEmbed;
};

export type PharmacistRequestRow = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  patient_id: string;
  submitted_at?: string | null;
  responded_at?: string | null;
};

export function DemandeHubTabBar({
  tab,
  onTab,
  labels,
}: {
  tab: HubTab;
  onTab: (t: HubTab) => void;
  labels: { dashboard: string; list: string };
}) {
  return (
    <div className="flex rounded-lg bg-muted/60 p-0.5 ring-1 ring-border/80">
      <button
        type="button"
        onClick={() => onTab("dashboard")}
        className={clsx(
          "flex-1 rounded-md px-2 py-1.5 text-center text-xs font-semibold transition sm:px-3 sm:text-sm",
          tab === "dashboard"
            ? "bg-card text-foreground shadow-sm ring-1 ring-border/80"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {labels.dashboard}
      </button>
      <button
        type="button"
        onClick={() => onTab("list")}
        className={clsx(
          "flex-1 rounded-md px-2 py-1.5 text-center text-xs font-semibold transition sm:px-3 sm:text-sm",
          tab === "list"
            ? "bg-card text-foreground shadow-sm ring-1 ring-border/80"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        {labels.list}
      </button>
    </div>
  );
}

export function RequestStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]",
        requestStatusBadgeClass(status)
      )}
    >
      {requestStatusFr[status] ?? status}
    </span>
  );
}

function cardSubtitlePatient(r: PatientRequestRow): string | null {
  if (r.status === "responded" && r.responded_at) {
    return `Réponse ${formatDateTimeShort24hFr(r.responded_at)}`;
  }
  if ((r.status === "submitted" || r.status === "in_review") && r.submitted_at) {
    return `Envoyée ${formatDateTimeShort24hFr(r.submitted_at)}`;
  }
  return `Créée ${formatDateTimeShort24hFr(r.created_at)}`;
}

export function PatientDemandeCard({ row }: { row: PatientRequestRow }) {
  const ph = one(row.pharmacies);
  const subtitle = cardSubtitlePatient(row);

  return (
    <Link
      href={`/dashboard/demandes/${row.id}`}
      className="group block rounded-lg border border-border/90 bg-card p-2.5 shadow-sm transition hover:border-sky-500/40 hover:shadow-md sm:p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] font-medium tracking-tight text-muted-foreground">
              #{formatShortId(row.id)}
            </span>
            <RequestStatusBadge status={row.status} />
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-foreground group-hover:text-sky-950 sm:text-[15px]">
            {requestTypeFr[row.request_type] ?? row.request_type}
            {ph ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · {ph.nom}
                <span className="text-muted-foreground/80"> ({ph.ville})</span>
              </span>
            ) : (
              <span className="font-normal text-muted-foreground"> · Pharmacie…</span>
            )}
          </p>
          {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        <span
          className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-sky-700"
          aria-hidden
        >
          →
        </span>
      </div>
    </Link>
  );
}

function cardSubtitlePharmacist(r: PharmacistRequestRow): string {
  if (r.status === "responded" && r.responded_at) {
    return `Réponse ${formatDateTimeShort24hFr(r.responded_at)}`;
  }
  return `Reçue ${formatDateTimeShort24hFr(r.created_at)}`;
}

export function PharmacistDemandeCard({ row }: { row: PharmacistRequestRow }) {
  return (
    <Link
      href={`/dashboard/pharmacien/demandes/${row.id}`}
      className="group block rounded-lg border border-border/90 bg-card p-2.5 shadow-sm transition hover:border-emerald-500/40 hover:shadow-md sm:p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] font-medium text-muted-foreground">#{formatShortId(row.id)}</span>
            <RequestStatusBadge status={row.status} />
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground group-hover:text-emerald-950 sm:text-[15px]">
            {requestTypeFr[row.request_type] ?? row.request_type}
            <span className="font-normal text-muted-foreground">
              {" "}
              · Pat. <span className="font-mono text-[11px]">{formatShortId(row.patient_id)}</span>
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{cardSubtitlePharmacist(row)}</p>
        </div>
        <span className="shrink-0 text-muted-foreground group-hover:text-emerald-700" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}

export const ALL_REQUEST_STATUSES = Object.keys(requestStatusFr);
export const ALL_REQUEST_TYPES = ["product_request", "prescription", "free_consultation"] as const;
