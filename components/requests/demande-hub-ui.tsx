"use client";

import Link from "next/link";
import { displayRequestPublicRef } from "@/lib/public-ref";
import {
  formatShortId,
  requestStatusBadgeClass,
  requestStatusFr,
  requestStatusShortFr,
  requestStatusShortFrPharmacien,
} from "@/lib/request-display";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
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
  updated_at?: string | null;
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
  updated_at?: string | null;
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
  request_items?: {
    counter_outcome?: string | null;
    is_selected_by_patient?: boolean | null;
    post_confirm_fulfillment?: string | null;
  }[] | null;
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

export function PatientDemandeCard({
  row,
  variant = "default",
}: {
  row: PatientRequestRow;
  /** `list` : liste compacte (réf · pharmacie · dates · lignes · statut). */
  variant?: "default" | "list";
}) {
  const ph = one(row.pharmacies);
  const when = row.submitted_at ?? row.created_at;
  const updatedWhen = row.updated_at?.trim() ? row.updated_at : row.created_at;
  const itemsRaw = row.request_items;
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []) as PatientRequestItemRow[];
  const summary = summarizeRequestForPatientCard(items.length ? items : null, row.status);
  const refVisuel = displayRequestPublicRef(row);
  const cardStatus =
    row.status === "processing"
      ? "processing"
      : row.status === "treated"
        ? "treated"
        : row.status === "confirmed" && summary.hasExecutionProgress
          ? "in_progress_virtual"
          : row.status;

  if (variant === "list") {
    return (
      <div className="rounded-lg border border-border/90 bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md">
        <Link href={`/dashboard/demandes/${row.id}`} className="group block p-2.5 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="truncate text-[13px] font-semibold leading-tight text-foreground sm:text-sm">
                  {ph?.nom ?? "Pharmacie"}
                </p>
                {ph?.ville ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">({ph.ville})</span>
                ) : null}
              </div>
              <p className="font-mono text-[10px] font-medium text-foreground">{refVisuel}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums leading-snug text-muted-foreground">
                <span>
                  Création{" "}
                  <span className="font-medium text-foreground">{formatDateTimeShort24hFr(when)}</span>
                </span>
                <span>
                  MAJ <span className="font-medium text-foreground">{formatDateTimeShort24hFr(updatedWhen)}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                  {summary.lineCount} ligne{summary.lineCount === 1 ? "" : "s"}
                </span>
                <RequestStatusBadge status={cardStatus} role="patient" />
              </div>
            </div>
            <span
              className="shrink-0 pt-0.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
              aria-hidden
            >
              →
            </span>
          </div>
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
  const maj = row.updated_at?.trim() ? row.updated_at : row.created_at;
  const name = patientDisplayName(row);
  const lines = Array.isArray(row.request_items) ? row.request_items : [];
  const nReserved = lines.filter(
    (l) => l.is_selected_by_patient === true && (l.post_confirm_fulfillment ?? "unset") === "reserved"
  ).length;
  const nOrdered = lines.filter(
    (l) => l.is_selected_by_patient === true && (l.post_confirm_fulfillment ?? "unset") === "ordered"
  ).length;
  const nArrived = lines.filter(
    (l) => l.is_selected_by_patient === true && (l.post_confirm_fulfillment ?? "unset") === "arrived_reserved"
  ).length;
  const hasFulfillmentProgress = nReserved + nOrdered + nArrived > 0;
  const statusForCard =
    row.status === "processing"
      ? "processing"
      : row.status === "treated"
        ? "treated"
        : hasFulfillmentProgress && row.status === "confirmed"
          ? "in_progress_virtual"
          : row.status;
  const cref = row.patient_ref?.trim();

  return (
    <div className="rounded-lg border border-border/90 bg-card shadow-sm transition hover:border-primary/30 hover:shadow-md">
      <Link href={`/dashboard/pharmacien/demandes/${row.id}`} className="group block p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-foreground sm:text-sm">{name}</p>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[10px]">
              <span className="font-medium text-foreground">{displayRequestPublicRef(row)}</span>
              {cref ? (
                <span className="text-muted-foreground">
                  Client <span className="font-medium text-foreground">{cref}</span>
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] tabular-nums leading-snug text-muted-foreground">
              <span>
                Création <span className="font-medium text-foreground">{formatDateTimeShort24hFr(when)}</span>
              </span>
              <span>
                MAJ <span className="font-medium text-foreground">{formatDateTimeShort24hFr(maj)}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                {lines.length} ligne{lines.length === 1 ? "" : "s"}
              </span>
              <RequestStatusBadge status={statusForCard} role="pharmacien" />
            </div>
            {statusForCard === "in_progress_virtual" ? (
              <p className="text-[10px] font-medium leading-snug text-muted-foreground">
                Réservation / commande : {nReserved} réservé(s), {nOrdered} commandé(s)
                {nArrived > 0 ? `, ${nArrived} reçu(s) en officine` : ""}.
              </p>
            ) : null}
          </div>
          <span
            className="shrink-0 pt-0.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden
          >
            →
          </span>
        </div>
      </Link>
    </div>
  );
}

export const ALL_REQUEST_STATUSES = Object.keys(requestStatusFr);
export const ALL_REQUEST_TYPES = ["product_request", "prescription", "free_consultation"] as const;
