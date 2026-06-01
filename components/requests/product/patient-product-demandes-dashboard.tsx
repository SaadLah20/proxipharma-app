"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight, Sparkles } from "lucide-react";
import type { PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { PatientProductDemandeHubCard } from "@/components/requests/product/patient-product-demande-hub-card";
import {
  countInPatientProductHubSection,
  PATIENT_PRODUCT_HUB_DASHBOARD_PREVIEW,
  PATIENT_PRODUCT_HUB_SECTIONS,
  patientProductHubListHref,
  pickRecentActiveProductRequests,
  rowsInPatientProductHubSection,
  type PatientProductHubSectionId,
} from "@/lib/patient-product-hub-sections";
import { ProductHubDashboardKpiPanel } from "@/components/requests/product/product-hub-dashboard-kpi-panel";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
const DASHBOARD_BUCKETS = dashboardBucketsForKind("product_request", "patient");

const SECTION_ORDER: PatientProductHubSectionId[] = ["action_required", "at_pharmacy", "archives"];

function hubSectionDomId(sectionId: PatientProductHubSectionId): string {
  return `patient-product-hub-section-${sectionId}`;
}

function SectionBlock({
  sectionId,
  rows,
  basePath,
  unreadById,
  defaultCollapsed,
  footer,
}: {
  sectionId: PatientProductHubSectionId;
  rows: PatientRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
  defaultCollapsed?: boolean;
  footer?: ReactNode;
}) {
  const section = PATIENT_PRODUCT_HUB_SECTIONS.find((s) => s.id === sectionId)!;
  const sectionRows = rowsInPatientProductHubSection(rows, sectionId);
  const count = sectionRows.length;
  const preview = sectionRows.slice(0, PATIENT_PRODUCT_HUB_DASHBOARD_PREVIEW);
  const listHref = patientProductHubListHref(basePath);

  if (count === 0) return null;

  const body = (
    <ul className="space-y-2">
      {preview.map((r) => (
        <li key={r.id}>
          <PatientProductDemandeHubCard row={r} conversationUnread={unreadById[r.id] === true} />
        </li>
      ))}
    </ul>
  );

  return (
    <section
      id={hubSectionDomId(sectionId)}
      className={clsx(
        "scroll-mt-4 rounded-xl border border-border/80 bg-card shadow-sm ring-1 ring-black/[0.03]",
        "border-l-4 border-l-primary/35"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5 sm:px-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-foreground sm:text-base">{section.title}</h3>
            <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-foreground ring-1 ring-border">
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground sm:text-xs">{section.subtitle}</p>
        </div>
        {count > PATIENT_PRODUCT_HUB_DASHBOARD_PREVIEW ? (
          <Link
            href={listHref}
            className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-card px-2 py-1 text-[11px] font-semibold text-primary hover:bg-muted/50"
          >
            Tout voir ({count})
            <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="p-2.5 sm:p-3">
        {defaultCollapsed && count > 0 ? (
          <details className="group" open={count <= 2}>
            <summary className="mb-2 cursor-pointer list-none text-[11px] font-semibold text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              Afficher les dossiers ({count})
            </summary>
            {body}
          </details>
        ) : (
          body
        )}
        {footer ? <div className="mt-3 border-t border-border/50 pt-3">{footer}</div> : null}
      </div>
    </section>
  );
}

export function PatientProductDemandesDashboard({
  rows,
  basePath,
  unreadById,
}: {
  rows: PatientRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
}) {
  const recent = pickRecentActiveProductRequests(rows, unreadById, 5);
  const actionCount = countInPatientProductHubSection(rows, "action_required");
  const pharmacyCount = countInPatientProductHubSection(rows, "at_pharmacy");
  const archiveCount = countInPatientProductHubSection(rows, "archives");

  const scrollToHubSection = (sectionId: PatientProductHubSectionId) => {
    document.getElementById(hubSectionDomId(sectionId))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const kpiPanel = (
    <ProductHubDashboardKpiPanel
      rows={rows}
      buckets={DASHBOARD_BUCKETS}
      basePath={basePath}
      unreadById={unreadById}
      role="patient"
    />
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-3.5 py-3 sm:px-4 sm:py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Demandes de produits
          </p>
          <p className="mt-1 text-sm font-semibold leading-snug text-foreground sm:text-base">
            {actionCount > 0
              ? `${actionCount} dossier${actionCount > 1 ? "s" : ""} nécessite${actionCount > 1 ? "nt" : ""} votre attention`
              : pharmacyCount > 0
                ? `${pharmacyCount} dossier${pharmacyCount > 1 ? "s" : ""} chez la pharmacie`
                : "Tout est à jour — consultez vos archives si besoin"}
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border bg-card">
          <button
            type="button"
            onClick={() => scrollToHubSection("action_required")}
            className="px-2 py-2.5 text-center transition hover:bg-muted/40 sm:px-3"
            aria-label="Aller au bloc À votre action"
          >
            <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">{actionCount}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
              À votre action
            </p>
          </button>
          <button
            type="button"
            onClick={() => scrollToHubSection("at_pharmacy")}
            className="px-2 py-2.5 text-center transition hover:bg-muted/40 sm:px-3"
            aria-label="Aller au bloc Chez la pharmacie"
          >
            <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">{pharmacyCount}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
              Chez la pharmacie
            </p>
          </button>
          <button
            type="button"
            onClick={() => scrollToHubSection("archives")}
            className="px-2 py-2.5 text-center transition hover:bg-muted/40 sm:px-3"
            aria-label="Aller au bloc Archives"
          >
            <p className="text-lg font-bold tabular-nums text-foreground sm:text-xl">{archiveCount}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
              Archives
            </p>
          </button>
        </div>
        <p className="border-t border-border bg-muted/20 px-3.5 py-2 text-[10px] leading-snug text-muted-foreground sm:px-4">
          Les chiffres ci-dessus font défiler la page vers un regroupement indicatif — ils ne filtrent pas la liste
          complète.
        </p>
      </div>

      {recent.length > 0 ? (
        <section className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-foreground">Reprendre rapidement</h2>
              <p className="text-[11px] text-muted-foreground">
                Vos 5 derniers dossiers ouverts ou consultés — tous statuts, messages non lus en tête
              </p>
            </div>
          </div>
          <ul className="flex gap-2.5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
            {recent.map((r) => (
              <li key={r.id} className="w-[min(100%,280px)] shrink-0 sm:w-[min(85%,300px)]">
                <PatientProductDemandeHubCard
                  row={r}
                  compact
                  conversationUnread={unreadById[r.id] === true}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-[11px] leading-snug text-muted-foreground">
        Regroupement indicatif pour vous orienter — la liste « Toutes les demandes » se filtre uniquement par statut,
        pharmacie ou référence.
      </p>

      {SECTION_ORDER.map((sectionId) => (
        <SectionBlock
          key={sectionId}
          sectionId={sectionId}
          rows={rows}
          basePath={basePath}
          unreadById={unreadById}
          defaultCollapsed={sectionId === "archives" && archiveCount > PATIENT_PRODUCT_HUB_DASHBOARD_PREVIEW}
          footer={sectionId === "archives" ? kpiPanel : undefined}
        />
      ))}

      {archiveCount === 0 ? kpiPanel : null}

      <p className="text-center">
        <Link
          href={`${basePath}?vue=liste`}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm hover:bg-muted/50"
        >
          Voir toutes les demandes (filtres par statut)
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
