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
import { RequestKindIndicator } from "@/components/ui/request-kind-indicator";
import { buttonVariants } from "@/components/ui/button";
import { neutralCardShell } from "@/lib/design-system/request-kind-accent";

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
    <section id={hubSectionDomId(sectionId)} className={clsx(neutralCardShell, "scroll-mt-4 p-0")}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
            <span className="inline-flex min-w-[1.75rem] items-center justify-center rounded-full border border-border/80 bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
              {count}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{section.subtitle}</p>
        </div>
        {count > PATIENT_PRODUCT_HUB_DASHBOARD_PREVIEW ? (
          <Link href={listHref} className={clsx(buttonVariants({ variant: "outline", size: "sm" }), "h-9 gap-1")}>
            Tout voir ({count})
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="p-3 sm:p-4">
        {defaultCollapsed && count > 0 ? (
          <details className="group" open={count <= 2}>
            <summary className="mb-2 cursor-pointer list-none text-sm font-medium text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
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
      <div className={clsx(neutralCardShell, "p-4 sm:p-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <RequestKindIndicator kindId="product_request" />
        </div>
        <p className="mt-2 text-base font-semibold text-foreground">
          {actionCount > 0
            ? `${actionCount} dossier${actionCount > 1 ? "s" : ""} nécessite${actionCount > 1 ? "nt" : ""} votre attention`
            : pharmacyCount > 0
              ? `${pharmacyCount} dossier${pharmacyCount > 1 ? "s" : ""} chez la pharmacie`
              : "Tout est à jour"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultez vos dossiers ci-dessous ou ouvrez la liste complète avec les filtres.
        </p>
      </div>

      {recent.length > 0 ? (
        <section className={clsx(neutralCardShell, "p-4 sm:p-5")}>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-base font-semibold text-foreground">Reprendre rapidement</h2>
              <p className="text-sm text-muted-foreground">Vos 5 derniers dossiers</p>
            </div>
          </div>
          <ul className="flex gap-3 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
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

      {kpiPanel}

      {SECTION_ORDER.map((sectionId) => (
        <SectionBlock
          key={sectionId}
          sectionId={sectionId}
          rows={rows}
          basePath={basePath}
          unreadById={unreadById}
          defaultCollapsed={sectionId === "archives"}
        />
      ))}
    </div>
  );
}
