"use client";

import type React from "react";
import Link from "next/link";
import { Clipboard, Cross } from "lucide-react";
import { displayRequestPublicRef } from "@/lib/public-ref";
import {
  formatShortId,
  requestStatusBadgeClass,
  requestStatusFr,
  requestStatusShortFr,
  requestStatusShortFrPharmacien,
} from "@/lib/request-display";
import { formatDh } from "@/lib/currency-ma";
import { formatDateTimeListCasablanca, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { summarizeRequestForPatientCard, type PatientRequestItemRow } from "@/lib/patient-request-list-summary";
import { one } from "@/lib/embed";
import { clsx } from "clsx";

export type HubTab = "dashboard" | "list";

type PharmEmbed =
  | { nom: string; ville: string; public_ref?: string | null }
  | { nom: string; ville: string; public_ref?: string | null }[]
  | null;

export type PatientRequestRow = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  submitted_at?: string | null;
  responded_at?: string | null;
  /** Ex. D042/26 — unique avec l’officine pour l’année. */
  request_public_ref?: string | null;
  pharmacies: PharmEmbed;
  /** Lignes produits (liste « Toutes les demandes », totaux DH) */
  request_items?: PatientRequestItemRow[] | null;
};

export type PharmacistRequestRow = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  patient_id: string;
  submitted_at?: string | null;
  responded_at?: string | null;
  request_public_ref?: string | null;
  /** Renseigné après chargement batch des profils (RLS pharmacien). */
  patient_full_name?: string | null;
  patient_whatsapp?: string | null;
  patient_ref?: string | null;
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

function copyRef(e: React.MouseEvent, text: string) {
  e.preventDefault();
  e.stopPropagation();
  void navigator.clipboard.writeText(text);
}

export function PatientDemandeCard({
  row,
  variant = "default",
}: {
  row: PatientRequestRow;
  /** `list` : carte large type maquette mobile (Réf · produits · total DH · badge). */
  variant?: "default" | "list";
}) {
  const ph = one(row.pharmacies);
  const when = row.submitted_at ?? row.created_at;
  const itemsRaw = row.request_items;
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []) as PatientRequestItemRow[];
  const summary = summarizeRequestForPatientCard(items.length ? items : null);
  const refVisuel = displayRequestPublicRef(row);
  const copyLabel = row.request_public_ref?.trim()
    ? `${row.request_public_ref.trim()} (${row.id})`
    : row.id;

  if (variant === "list") {
    const totalLabel = summary.totalDh != null ? formatDh(summary.totalDh) : "—";
    const nLines = summary.lineCount;

    return (
      <div className="relative overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:border-sky-300/60 hover:shadow-md">
        <Link href={`/dashboard/demandes/${row.id}`} className="group block px-4 py-3.5 pr-14">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 gap-3">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100"
                aria-hidden
              >
                <Cross className="h-[22px] w-[22px]" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-gray-950">
                  {ph?.nom ?? "Pharmacie"}
                </p>
                {ph?.ville ? <p className="mt-0.5 text-xs text-muted-foreground">{ph.ville}</p> : null}
              </div>
            </div>
            <time
              dateTime={when}
              className="shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-muted-foreground"
            >
              {formatDateTimeListCasablanca(when)}
            </time>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100/90 pt-3 text-[12px] text-muted-foreground">
            <span>
              Réf.&nbsp;: <span className="font-mono font-medium text-gray-900">{refVisuel}</span>
            </span>
            <span className="font-medium tabular-nums text-gray-800">
              {nLines} produit{nLines > 1 ? "s" : ""}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-gray-900">
              Total : <span className="tabular-nums">{totalLabel}</span>
              {summary.totalDh == null ? <span className="ml-1 text-[11px] font-normal text-muted-foreground">(prix après réponse)</span> : null}
            </span>
            <RequestStatusBadge status={row.status} role="patient" />
          </div>

          <p className="mt-2 text-[11px] font-medium text-sky-800/90">Voir le détail de la demande</p>
        </Link>
        <button
          type="button"
          title="Copier la référence complète"
          onClick={(e) => copyRef(e, copyLabel)}
          className="absolute right-3 top-3 rounded-full border border-gray-200 bg-gray-50/90 p-1.5 text-muted-foreground hover:bg-gray-100"
        >
          <Clipboard className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    );
  }

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
              <span className="font-mono text-[10px] font-medium text-foreground">{displayRequestPublicRef(row)}</span>
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
        onClick={(e) =>
          copyRef(
            e,
            row.request_public_ref?.trim() ? `${row.request_public_ref.trim()} (${row.id})` : row.id
          )
        }
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
                <span className="font-mono text-[10px] font-medium text-foreground">{displayRequestPublicRef(row)}</span>
                {row.patient_ref ? (
                  <span className="text-[10px] text-muted-foreground">
                    Client <span className="font-mono font-medium text-foreground">{row.patient_ref}</span>
                  </span>
                ) : null}
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
        onClick={(e) =>
          copyRef(
            e,
            row.request_public_ref?.trim() ? `${row.request_public_ref.trim()} (${row.id})` : row.id
          )
        }
        className="absolute right-2 top-2 rounded border border-border/80 bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
      >
        Copier
      </button>
    </div>
  );
}

export const ALL_REQUEST_STATUSES = Object.keys(requestStatusFr);
export const ALL_REQUEST_TYPES = ["product_request", "prescription", "free_consultation"] as const;
