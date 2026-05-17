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
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindAccent } from "@/lib/request-kinds/types";
import { one } from "@/lib/embed";
import { clsx } from "clsx";

function demandeCardShell(status: string, role: "patient" | "pharmacien", accent: RequestKindAccent = "sky"): string {
  const closed = ["completed", "cancelled", "abandoned", "expired", "partially_collected", "fully_collected", "draft"];
  const pharma = role === "pharmacien";
  if (closed.includes(status)) {
    return pharma
      ? "rounded-lg border border-border/90 bg-card shadow-sm ring-1 ring-border/60 transition hover:border-border hover:shadow-md"
      : "rounded-xl border border-border/80 bg-card shadow-md ring-1 ring-border/50 transition hover:shadow-lg hover:ring-border/70";
  }
  if (status === "responded") {
    return pharma
      ? "rounded-lg border border-amber-300/75 bg-gradient-to-br from-amber-50/50 via-card to-card shadow-sm ring-1 ring-amber-200/55 transition hover:border-amber-400/80 hover:shadow-md"
      : "rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-card to-card shadow-md ring-1 ring-amber-200/45 transition hover:shadow-lg hover:ring-amber-300/50";
  }
  if (status === "confirmed") {
    return role === "patient"
      ? "rounded-xl border border-emerald-200/85 bg-gradient-to-br from-emerald-50/45 via-card to-card shadow-md ring-1 ring-emerald-200/50 transition hover:shadow-lg hover:ring-emerald-300/55"
      : "rounded-lg border border-emerald-300/70 bg-gradient-to-br from-emerald-50/45 via-card to-card shadow-sm ring-1 ring-emerald-200/55 transition hover:border-emerald-400/65 hover:shadow-md";
  }
  if (status === "treated") {
    return pharma
      ? "rounded-lg border border-violet-300/70 bg-gradient-to-br from-violet-50/40 via-card to-card shadow-sm ring-1 ring-violet-200/55 transition hover:border-violet-400/65 hover:shadow-md"
      : "rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/35 via-card to-card shadow-md ring-1 ring-violet-200/45 transition hover:shadow-lg hover:ring-violet-300/50";
  }
  if (accent === "amber") {
    return pharma
      ? "rounded-lg border border-amber-300/70 bg-gradient-to-br from-amber-50/45 via-card to-card shadow-sm ring-1 ring-amber-200/55 transition hover:border-amber-400/65 hover:shadow-md"
      : "rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/40 via-card to-card shadow-md ring-1 ring-amber-200/45 transition hover:shadow-lg hover:ring-amber-300/50";
  }
  if (accent === "violet") {
    return pharma
      ? "rounded-lg border border-violet-300/70 bg-gradient-to-br from-violet-50/40 via-card to-card shadow-sm ring-1 ring-violet-200/55 transition hover:border-violet-400/65 hover:shadow-md"
      : "rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/35 via-card to-card shadow-md ring-1 ring-violet-200/45 transition hover:shadow-lg hover:ring-violet-300/50";
  }
  return pharma
    ? "rounded-lg border border-sky-300/70 bg-gradient-to-br from-sky-50/45 via-card to-card shadow-sm ring-1 ring-sky-200/55 transition hover:border-sky-400/65 hover:shadow-md"
    : "rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/40 via-card to-card shadow-md ring-1 ring-sky-200/45 transition hover:shadow-lg hover:ring-sky-300/50";
}

function patientCardLineBadge(row: PatientRequestRow, summary: ReturnType<typeof summarizeRequestForPatientCard>): string {
  if (row.request_type === "prescription" && ["submitted", "in_review"].includes(row.status) && summary.lineCount === 0) {
    return "Scan envoyé";
  }
  if (row.request_type === "prescription" && summary.lineCount > 0) {
    return `${summary.lineCount} produit${summary.lineCount > 1 ? "s" : ""} saisi${summary.lineCount > 1 ? "s" : ""}`;
  }
  return `${summary.lineCount} ligne${summary.lineCount === 1 ? "" : "s"}`;
}

function pharmacistCardLineBadge(row: PharmacistRequestRow, lineCount: number): string {
  if (row.request_type === "prescription" && ["submitted", "in_review"].includes(row.status) && lineCount === 0) {
    return "Scan à traiter";
  }
  if (row.request_type === "prescription" && lineCount > 0) {
    return `${lineCount} produit${lineCount > 1 ? "s" : ""} saisi${lineCount > 1 ? "s" : ""}`;
  }
  return `${lineCount} ligne${lineCount === 1 ? "" : "s"}`;
}

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
  conversationUnread = false,
}: {
  row: PatientRequestRow;
  /** `list` : liste compacte (réf · pharmacie · dates · lignes · statut). */
  variant?: "default" | "list";
  /** Message(s) conversation d’autrui non lus pour l’utilisateur courant. */
  conversationUnread?: boolean;
}) {
  const ph = one(row.pharmacies);
  const when = row.submitted_at ?? row.created_at;
  const updatedWhen = row.updated_at?.trim() ? row.updated_at : row.created_at;
  const itemsRaw = row.request_items;
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []) as PatientRequestItemRow[];
  const summary = summarizeRequestForPatientCard(items.length ? items : null, row.status);
  const refVisuel = displayRequestPublicRef(row);
  const cardStatus = row.status;
  const kindConfig = getRequestKindConfig(row.request_type);
  const cardAccent = kindConfig.theme.accent;
  const lineBadge = patientCardLineBadge(row, summary);
  const unreadDotClass =
    cardAccent === "amber" ? "bg-amber-600" : cardAccent === "violet" ? "bg-violet-600" : "bg-sky-600";

  if (variant === "list") {
    return (
      <div className={clsx(demandeCardShell(cardStatus, "patient", cardAccent), "transition hover:-translate-y-px")}>
        <Link
          href={`/dashboard/demandes/${row.id}`}
          className="group block p-2.5 sm:p-3"
          aria-label={
            conversationUnread ? `${ph?.nom ?? "Pharmacie"} — conversation non lue` : undefined
          }
        >
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
                  {lineBadge}
                </span>
                <span className="rounded-md border border-border/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {kindConfig.theme.headerLabelShort}
                </span>
                <RequestStatusBadge status={cardStatus} role="patient" />
              </div>
            </div>
            <span className="relative flex shrink-0 items-center gap-1 pt-0.5" aria-hidden>
              {conversationUnread ? (
                <span
                  className={clsx("size-2 shrink-0 rounded-full shadow-sm ring-2 ring-white", unreadDotClass)}
                  title="Conversation non lue"
                />
              ) : null}
              <span className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary">
                →
              </span>
            </span>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className={clsx(demandeCardShell(cardStatus, "patient", cardAccent), "transition hover:-translate-y-px")}>
      <Link
        href={`/dashboard/demandes/${row.id}`}
        className="group block p-2.5 sm:p-3"
        aria-label={conversationUnread ? "Demande — conversation non lue" : undefined}
      >
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
          <span className="relative flex shrink-0 items-center gap-1" aria-hidden>
            {conversationUnread ? (
              <span className="size-2 shrink-0 rounded-full bg-sky-600 shadow-sm ring-2 ring-white" title="Conversation non lue" />
            ) : null}
            <span className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-sky-700">→</span>
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

export function PharmacistDemandeCard({
  row,
  conversationUnread = false,
}: {
  row: PharmacistRequestRow;
  conversationUnread?: boolean;
}) {
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
  const statusForCard = row.status;
  const cref = row.patient_ref?.trim();
  const kindConfig = getRequestKindConfig(row.request_type);
  const cardAccent = kindConfig.theme.accent;
  const lineBadge = pharmacistCardLineBadge(row, lines.length);
  const unreadDotClass =
    cardAccent === "amber" ? "bg-amber-600" : cardAccent === "violet" ? "bg-violet-600" : "bg-rose-600";

  return (
    <div className={clsx(demandeCardShell(statusForCard, "pharmacien", cardAccent), "transition hover:-translate-y-px")}>
      <Link
        href={`/dashboard/pharmacien/demandes/${row.id}`}
        className="group block px-2 py-2 sm:px-2.5 sm:py-2"
        aria-label={conversationUnread ? `${name} — conversation non lue` : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-[12px] font-semibold leading-tight text-foreground sm:text-[13px]">{name}</p>
            <div className="flex flex-wrap gap-x-2 gap-y-px font-mono text-[10px] leading-tight">
              <span className="font-medium text-foreground">{displayRequestPublicRef(row)}</span>
              {cref ? (
                <span className="text-muted-foreground">
                  Client <span className="font-medium text-foreground">{cref}</span>
                </span>
              ) : null}
            </div>
            <p className="text-[10px] tabular-nums leading-snug text-muted-foreground">
              Création <span className="font-medium text-foreground">{formatDateTimeShort24hFr(when)}</span>
              <span className="text-border" aria-hidden>
                {" "}
                ·{" "}
              </span>
              MAJ <span className="font-medium text-foreground">{formatDateTimeShort24hFr(maj)}</span>
            </p>
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="rounded border border-border/60 bg-muted/70 px-1.5 py-px text-[10px] font-medium text-foreground">
                {lineBadge}
              </span>
              <span className="rounded-md border border-border/70 bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                {kindConfig.theme.headerLabelShort}
              </span>
              <RequestStatusBadge status={statusForCard} role="pharmacien" />
            </div>
            {hasFulfillmentProgress && (row.status === "confirmed" || row.status === "treated") ? (
              <p className="text-[9px] font-medium leading-snug text-muted-foreground">
                Rés. {nReserved} · Cmd. {nOrdered}
                {nArrived > 0 ? ` · Reçu ${nArrived}` : ""}
              </p>
            ) : null}
          </div>
          <span className="relative flex shrink-0 items-center gap-1 self-center" aria-hidden>
            {conversationUnread ? (
              <span
                className={clsx("size-2 shrink-0 rounded-full shadow-sm ring-2 ring-white", unreadDotClass)}
                title="Conversation non lue"
              />
            ) : null}
            <span className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary">→</span>
          </span>
        </div>
      </Link>
    </div>
  );
}

export const ALL_REQUEST_STATUSES = Object.keys(requestStatusFr);
export const ALL_REQUEST_TYPES = ["product_request", "prescription", "free_consultation"] as const;
