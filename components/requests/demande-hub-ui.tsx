"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { displayRequestPublicRef } from "@/lib/public-ref";
import {
  formatShortId,
  requestStatusBadgeClass,
  requestStatusFr,
  requestStatusShortFrPharmacien,
} from "@/lib/request-display";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { usePatientRequestStatusLabel } from "@/lib/i18n/patient-request-status-label";
import { summarizeRequestForPatientCard, type PatientRequestItemRow } from "@/lib/patient-request-list-summary";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindAccent } from "@/lib/request-kinds/types";
import { one } from "@/lib/embed";
import { pharmacyCityLabel } from "@/lib/pharmacy-cities-morocco";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { clsx } from "clsx";

function demandeCardShell(_status: string, _role: "patient" | "pharmacien", _accent: RequestKindAccent = "sky"): string {
  return "rounded-lg border border-border bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md";
}

function patientCardLineBadge(
  row: PatientRequestRow,
  summary: ReturnType<typeof summarizeRequestForPatientCard>,
  t: ReturnType<typeof useTranslations<"hub.listChrome">>,
): string {
  if (row.request_type === "free_consultation" && ["submitted", "in_review"].includes(row.status) && summary.lineCount === 0) {
    return t("inDiscussion");
  }
  if (row.request_type === "free_consultation" && summary.lineCount > 0) {
    return t("productsProposed", { count: summary.lineCount });
  }
  if (row.request_type === "prescription" && ["submitted", "in_review"].includes(row.status) && summary.lineCount === 0) {
    return t("scanSent");
  }
  if (row.request_type === "prescription" && summary.lineCount > 0) {
    return t("productsEntered", { count: summary.lineCount });
  }
  return t("lines", { count: summary.lineCount });
}

function pharmacistCardLineBadge(row: PharmacistRequestRow, lineCount: number): string {
  if (row.request_type === "free_consultation" && ["submitted", "in_review"].includes(row.status) && lineCount === 0) {
    return "À lire · discussion";
  }
  if (row.request_type === "free_consultation" && lineCount > 0) {
    return `${lineCount} produit${lineCount > 1 ? "s" : ""} proposé${lineCount > 1 ? "s" : ""}`;
  }
  if (row.request_type === "prescription" && ["submitted", "in_review"].includes(row.status) && lineCount === 0) {
    return "Scan à traiter";
  }
  if (row.request_type === "prescription" && lineCount > 0) {
    return `${lineCount} produit${lineCount > 1 ? "s" : ""} saisi${lineCount > 1 ? "s" : ""}`;
  }
  return `${lineCount} ligne${lineCount === 1 ? "" : "s"}`;
}

/** Une date si identique, sinon MAJ seule (plus courte que création + MAJ). */
function hubCardTimestamp(created: string, updated: string | null | undefined, locale: AppLocale): string {
  const u = updated?.trim() || created;
  if (updated?.trim() && updated.trim() !== created) {
    return formatDateTimeShortForLocale(u, locale);
  }
  return formatDateTimeShortForLocale(created, locale);
}

export type HubTab = "dashboard" | "list";

type PharmEmbed =
  | { nom: string; nom_ar?: string | null; ville: string; public_ref?: string | null }
  | { nom: string; nom_ar?: string | null; ville: string; public_ref?: string | null }[]
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

function hubTabButtonClass(active: boolean): string {
  return clsx(
    "flex-1 rounded-md px-2 py-1.5 text-center text-xs font-semibold transition sm:px-3 sm:text-sm",
    active
      ? "bg-card text-foreground shadow-sm ring-1 ring-border/80"
      : "text-muted-foreground hover:text-foreground",
  );
}

export function DemandeHubTabBar({
  tab,
  onTab,
  labels,
  tabOrder = "dashboardFirst",
}: {
  tab: HubTab;
  onTab: (t: HubTab) => void;
  labels: { dashboard: string; list: string };
  /** Patient : liste à gauche ; pharmacien : tableau de bord à gauche (défaut). */
  tabOrder?: "dashboardFirst" | "listFirst";
}) {
  const dashboardBtn = (
    <button
      key="dashboard"
      type="button"
      onClick={() => onTab("dashboard")}
      className={hubTabButtonClass(tab === "dashboard")}
    >
      {labels.dashboard}
    </button>
  );
  const listBtn = (
    <button
      key="list"
      type="button"
      onClick={() => onTab("list")}
      className={hubTabButtonClass(tab === "list")}
    >
      {labels.list}
    </button>
  );

  return (
    <div className="flex rounded-lg bg-muted/60 p-0.5 ring-1 ring-border/80">
      {tabOrder === "listFirst" ? [listBtn, dashboardBtn] : [dashboardBtn, listBtn]}
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
  const patientLabel = usePatientRequestStatusLabel(status);
  const label = role === "pharmacien" ? requestStatusShortFrPharmacien(status) : patientLabel;
  return (
    <span className={clsx(requestStatusBadgeClass(status), "sm:text-[11px]")}>
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
  const locale = useLocale() as AppLocale;
  const tList = useTranslations("hub.listChrome");
  const tDossier = useTranslations("demandes.dossierBand");
  const ph = one(row.pharmacies);
  const when = row.submitted_at ?? row.created_at;
  const ts = hubCardTimestamp(when, row.updated_at, locale);
  const itemsRaw = row.request_items;
  const items = (Array.isArray(itemsRaw) ? itemsRaw : []) as PatientRequestItemRow[];
  const summary = summarizeRequestForPatientCard(items.length ? items : null, row.status);
  const refVisuel = displayRequestPublicRef(row);
  const cardStatus = row.status;
  const kindConfig = getRequestKindConfig(row.request_type);
  const cardAccent = kindConfig.theme.accent;
  const lineBadge = patientCardLineBadge(row, summary, tList);
  const pharmacyFallback = tDossier("pharmacyFallback");
  const pharmacyTitle = ph?.nom
    ? pharmacyPublicLabel(ph.nom, { locale, nomAr: ph.nom_ar })
    : pharmacyFallback;
  const displayVille = ph?.ville ? pharmacyCityLabel(ph.ville, locale) : "";
  if (variant === "list") {
    return (
      <div className={clsx(demandeCardShell(cardStatus, "patient", cardAccent), "transition hover:-translate-y-px")}>
        <Link
          href={`/dashboard/demandes/${row.id}`}
          className="group block p-2.5 sm:p-3"
          aria-label={
            conversationUnread
              ? tList("conversationUnreadAria", { pharmacy: pharmacyTitle })
              : undefined
          }
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="truncate text-[13px] font-semibold leading-tight text-foreground sm:text-sm">
                  {pharmacyTitle}
                </p>
                {displayVille ? (
                  <span className="shrink-0 text-[10px] text-muted-foreground">({displayVille})</span>
                ) : null}
              </div>
              <p className="font-mono text-[10px] font-medium text-foreground">{refVisuel}</p>
              <p className="text-[10px] tabular-nums text-muted-foreground">{ts}</p>
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <span className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                  {lineBadge}
                </span>
                <RequestStatusBadge status={cardStatus} role="patient" />
              </div>
            </div>
            <span className="relative flex shrink-0 items-center gap-1 pt-0.5" aria-hidden>
              {conversationUnread ? (
                <span
                  className="size-2 shrink-0 rounded-full bg-primary shadow-sm ring-2 ring-white"
                  title={tList("conversationUnread")}
                />
              ) : null}
              <span className="text-muted-foreground transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 group-hover:text-primary rtl:rotate-180">
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
        aria-label={conversationUnread ? tList("requestUnreadAria") : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted-foreground">
              {formatDateTimeShortForLocale(when, locale)}
              {ph ? (
                <>
                  {" "}
                  · <span className="font-medium text-foreground">{pharmacyPublicLabel(ph.nom, { locale, nomAr: ph.nom_ar })}</span>
                  <span className="text-muted-foreground/90"> ({displayVille})</span>
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
              <span className="size-2 shrink-0 rounded-full bg-sky-600 shadow-sm ring-2 ring-white" title={tList("conversationUnread")} />
            ) : null}
            <span className="text-muted-foreground transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 group-hover:text-primary rtl:rotate-180">→</span>
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
  const ts = hubCardTimestamp(when, row.updated_at, "fr");
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
            <p className="text-[10px] tabular-nums text-muted-foreground">{ts}</p>
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="rounded border border-border/60 bg-muted/70 px-1.5 py-px text-[10px] font-medium text-foreground">
                {lineBadge}
              </span>
              <RequestStatusBadge status={statusForCard} role="pharmacien" />
            </div>
            {hasFulfillmentProgress && (row.status === "confirmed" || row.status === "treated") ? (
              <p className="text-[9px] font-medium text-muted-foreground">
                Rés.{nReserved} · Cmd.{nOrdered}
                {nArrived > 0 ? ` · Reçu ${nArrived}` : ""}
              </p>
            ) : null}
          </div>
          <span className="relative flex shrink-0 items-center gap-1 self-center" aria-hidden>
            {conversationUnread ? (
              <span
                className="size-2 shrink-0 rounded-full bg-primary shadow-sm ring-2 ring-white"
                title="Conversation non lue"
              />
            ) : null}
            <span className="text-muted-foreground transition group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 group-hover:text-primary rtl:rotate-180">→</span>
          </span>
        </div>
      </Link>
    </div>
  );
}

export const ALL_REQUEST_STATUSES = Object.keys(requestStatusFr);
export const ALL_REQUEST_TYPES = ["product_request", "prescription", "free_consultation"] as const;
