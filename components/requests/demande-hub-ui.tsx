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
    <div className="flex rounded-2xl bg-slate-100/90 p-1 ring-1 ring-slate-200/60">
      <button
        type="button"
        onClick={() => onTab("dashboard")}
        className={clsx(
          "flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition",
          tab === "dashboard"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
            : "text-slate-600 hover:text-slate-900"
        )}
      >
        {labels.dashboard}
      </button>
      <button
        type="button"
        onClick={() => onTab("list")}
        className={clsx(
          "flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition",
          tab === "list"
            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
            : "text-slate-600 hover:text-slate-900"
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
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
        requestStatusBadgeClass(status)
      )}
    >
      {requestStatusFr[status] ?? status}
    </span>
  );
}

function cardSubtitlePatient(r: PatientRequestRow): string | null {
  if (r.status === "responded" && r.responded_at) {
    return `Réponse le ${new Date(r.responded_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
  }
  if ((r.status === "submitted" || r.status === "in_review") && r.submitted_at) {
    return `Envoyée le ${new Date(r.submitted_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
  }
  return `Créée le ${new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
}

export function PatientDemandeCard({ row }: { row: PatientRequestRow }) {
  const ph = one(row.pharmacies);
  const subtitle = cardSubtitlePatient(row);

  return (
    <Link
      href={`/dashboard/demandes/${row.id}`}
      className="group block rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] transition hover:border-sky-300/70 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-medium tracking-tight text-slate-500">
              #{formatShortId(row.id)}
            </span>
            <RequestStatusBadge status={row.status} />
          </div>
          <p className="mt-2 truncate text-[15px] font-semibold text-slate-900 group-hover:text-sky-950">
            {requestTypeFr[row.request_type] ?? row.request_type}
            {ph ? (
              <span className="font-normal text-slate-600">
                {" "}
                · {ph.nom}
                <span className="text-slate-500"> ({ph.ville})</span>
              </span>
            ) : (
              <span className="font-normal text-slate-500"> · Pharmacie…</span>
            )}
          </p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <span
          className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-700"
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
    return `Réponse publiée le ${new Date(r.responded_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
  }
  return `Reçue le ${new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
}

export function PharmacistDemandeCard({ row }: { row: PharmacistRequestRow }) {
  return (
    <Link
      href={`/dashboard/pharmacien/demandes/${row.id}`}
      className="group block rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-black/[0.02] transition hover:border-emerald-300/70 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-medium text-slate-500">#{formatShortId(row.id)}</span>
            <RequestStatusBadge status={row.status} />
          </div>
          <p className="mt-2 text-[15px] font-semibold text-slate-900 group-hover:text-emerald-950">
            {requestTypeFr[row.request_type] ?? row.request_type}
            <span className="font-normal text-slate-600">
              {" "}
              · Patient <span className="font-mono text-xs">{formatShortId(row.patient_id)}</span>
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">{cardSubtitlePharmacist(row)}</p>
        </div>
        <span className="shrink-0 text-slate-400 group-hover:text-emerald-700" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}

export const ALL_REQUEST_STATUSES = Object.keys(requestStatusFr);
export const ALL_REQUEST_TYPES = ["product_request", "prescription", "free_consultation"] as const;
