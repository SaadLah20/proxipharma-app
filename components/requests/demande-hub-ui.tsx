"use client";

import type React from "react";
import Link from "next/link";
import { Cross } from "lucide-react";
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
  request_items?: { counter_outcome?: string | null; is_selected_by_patient?: boolean | null }[] | null;
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
  const cardStatus =
    row.status === "confirmed" && summary.hasExecutionProgress ? "in_progress_virtual" : row.status;

  if (variant === "list") {
    const isInitialDemandView = row.status === "submitted" || row.status === "in_review" || row.status === "responded";
    const statusLabel = cardStatus === "in_progress_virtual" ? "En préparation" : requestStatusShortFr(cardStatus);
    const statusClass =
      cardStatus === "in_progress_virtual"
        ? "bg-indigo-100 text-indigo-950 ring-1 ring-indigo-200/80"
        : requestStatusBadgeClass(cardStatus);
    const totalLabel =
      isInitialDemandView
        ? summary.totalInitialDh != null
          ? formatDh(summary.totalInitialDh)
          : "—"
        : summary.totalSelectedDh != null
          ? formatDh(summary.totalSelectedDh)
          : "—";

    return (
      <div className="overflow-hidden rounded-2xl border-2 border-sky-100 bg-gradient-to-br from-white via-white to-sky-50/40 shadow-[0_2px_10px_rgba(2,132,199,0.08)] transition hover:border-sky-300 hover:shadow-[0_6px_18px_rgba(2,132,199,0.16)]">
        <div className="h-1.5 w-full bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400" aria-hidden />
        <Link href={`/dashboard/demandes/${row.id}`} className="group block px-3.5 py-3 sm:px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 gap-2.5">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 ring-1 ring-sky-100"
                aria-hidden
              >
                <Cross className="h-5 w-5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight text-gray-950 sm:text-[15px]">
                  {ph?.nom ?? "Pharmacie"}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="font-mono font-medium text-foreground">{refVisuel}</span>
                  {ph?.ville ? <span>{ph.ville}</span> : null}
                </p>
              </div>
            </div>
            <time
              dateTime={when}
              className="shrink-0 whitespace-nowrap text-right text-[10px] tabular-nums text-muted-foreground sm:text-[11px]"
            >
              {formatDateTimeListCasablanca(when)}
            </time>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2.5">
            <span className={clsx("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", statusClass)}>
              {statusLabel}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
              {summary.lineCount} lignes
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground sm:grid-cols-3">
            {isInitialDemandView ? (
              <>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  Princ. <strong className="text-foreground">{summary.principalCount}</strong>
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  Alt. <strong className="text-foreground">{summary.alternativesCount}</strong>
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  Proposés <strong className="text-foreground">{summary.proposedCount}</strong>
                </span>
              </>
            ) : (
              <>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  Princ. validés <strong className="text-foreground">{summary.selectedPrincipalCount}</strong>
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  Alt. validés <strong className="text-foreground">{summary.selectedAlternativesCount}</strong>
                </span>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm">
                  Proposés validés <strong className="text-foreground">{summary.selectedProposedCount}</strong>
                </span>
              </>
            )}
            {cardStatus === "in_progress_virtual" ? (
              <>
                <span className="rounded-md bg-indigo-50 px-2 py-1">
                  En attente <strong className="text-indigo-950">{summary.selectedPendingPickupCount}</strong>
                </span>
                <span className="rounded-md bg-emerald-50 px-2 py-1">
                  Récupérés <strong className="text-emerald-950">{summary.selectedPickedUpCount}</strong>
                </span>
                <span className="rounded-md bg-rose-50 px-2 py-1">
                  Annulés <strong className="text-rose-950">{summary.selectedCancelledCount}</strong>
                </span>
                <span className="rounded-md bg-amber-50 px-2 py-1">
                  Commandés non reçus <strong className="text-amber-950">{summary.selectedToOrderPendingCount}</strong>
                </span>
              </>
            ) : null}
          </div>

          <div className="mt-2.5 rounded-md border border-sky-100 bg-sky-50/50 px-2.5 py-1.5 text-[11px] text-sky-950">
            <span className="font-semibold">
              Total : <span className="tabular-nums">{totalLabel}</span>
            </span>
            {isInitialDemandView ? (
              <span className="ml-1 text-sky-900/85">(montant basé sur les produits et quantités initialement demandés)</span>
            ) : (
              <span className="ml-1 text-sky-900/85">(montant basé sur les produits validés par vous)</span>
            )}
          </div>

          <p className="mt-2 text-[11px] font-medium text-sky-800/90">
            Voir le détail de la demande
          </p>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/90 bg-card shadow-sm transition hover:border-sky-500/40 hover:shadow-md">
      <Link href={`/dashboard/demandes/${row.id}`} className="group block p-2.5 sm:p-3">
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
              <RequestStatusBadge status={cardStatus} role="patient" />
            </div>
          </div>
          <span className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-sky-700" aria-hidden>
            →
          </span>
        </div>
      </Link>
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
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/35 shadow-[0_2px_10px_rgba(16,185,129,0.08)] transition hover:border-emerald-300 hover:shadow-[0_6px_18px_rgba(16,185,129,0.16)]">
      <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" aria-hidden />
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
                <span className="rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-foreground shadow-sm">
                  {displayRequestPublicRef(row)}
                </span>
                {row.patient_ref ? (
                  <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground shadow-sm">
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
