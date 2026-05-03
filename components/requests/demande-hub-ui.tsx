"use client";

import type React from "react";
import Link from "next/link";
import {
  formatShortId,
  requestStatusBadgeClass,
  requestStatusFr,
  requestStatusShortFr,
  requestStatusShortFrPharmacien,
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
  /** Renseigné après chargement batch des profils (RLS pharmacien). */
  patient_full_name?: string | null;
  patient_whatsapp?: string | null;
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

export function RequestStatusBadge({
  status,
  role = "patient",
}: {
  status: string;
  role?: "patient" | "pharmacien";
}) {
  const label = role === "pharmacien" ? requestStatusShortFrPharmacien(status) : requestStatusShortFr(status);
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold sm:text-[11px]",
        requestStatusBadgeClass(status)
      )}
    >
      {label}
    </span>
  );
}

function copyRef(e: React.MouseEvent, id: string) {
  e.preventDefault();
  e.stopPropagation();
  void navigator.clipboard.writeText(id);
}

export function PatientDemandeCard({ row }: { row: PatientRequestRow }) {
  const ph = one(row.pharmacies);
  const when = row.submitted_at ?? row.created_at;

  return (
    <div className="relative rounded-lg border border-border/90 bg-card shadow-sm transition hover:border-sky-500/40 hover:shadow-md">
      <Link href={`/dashboard/demandes/${row.id}`} className="group block p-2.5 pr-10 sm:p-3 sm:pr-12">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              {formatDateTimeShort24hFr(when)}
              {ph ? (
                <>
                  {" "}
                  · <span className="font-medium text-foreground">{ph.nom}</span>
                  <span className="text-muted-foreground/90"> ({ph.ville})</span>
                </>
              ) : null}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">#{formatShortId(row.id)}</span>
              <RequestStatusBadge status={row.status} role="patient" />
            </div>
          </div>
          <span className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-sky-700" aria-hidden>
            →
          </span>
        </div>
      </Link>
      <button
        type="button"
        title="Copier la référence complète"
        onClick={(e) => copyRef(e, row.id)}
        className="absolute right-2 top-2 rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
      >
        Copier
      </button>
    </div>
  );
}

function patientDisplayName(row: PharmacistRequestRow): string {
  const n = row.patient_full_name?.trim();
  if (n) return n;
  return `Patient #${formatShortId(row.patient_id)}`;
}

export function PharmacistDemandeCard({ row }: { row: PharmacistRequestRow }) {
  const when = row.submitted_at ?? row.created_at;
  const name = patientDisplayName(row);
  const phone = row.patient_whatsapp?.trim();

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.03] transition hover:border-emerald-500/35 hover:shadow-md">
      <Link href={`/dashboard/pharmacien/demandes/${row.id}`} className="group block p-3 pr-11 sm:p-3.5 sm:pr-12">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600/90 to-teal-700/95 text-xs font-bold text-white shadow-inner"
              aria-hidden
            >
              {(name.slice(0, 2) || "?").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">{name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTimeShort24hFr(when)}</p>
              {phone ? (
                <p className="mt-0.5 truncate text-[11px] font-medium text-emerald-800/90">{phone}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">Réf. #{formatShortId(row.id)}</span>
                <RequestStatusBadge status={row.status} role="pharmacien" />
              </div>
            </div>
          </div>
          <span className="shrink-0 pt-1 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-emerald-700" aria-hidden>
            →
          </span>
        </div>
      </Link>
      <button
        type="button"
        title="Copier la référence complète"
        onClick={(e) => copyRef(e, row.id)}
        className="absolute right-2 top-2 rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
      >
        Copier
      </button>
    </div>
  );
}

export const ALL_REQUEST_STATUSES = Object.keys(requestStatusFr);
export const ALL_REQUEST_TYPES = ["product_request", "prescription", "free_consultation"] as const;
