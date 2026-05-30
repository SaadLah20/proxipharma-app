"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight, Sparkles } from "lucide-react";
import type { PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { PharmacistProductDemandeHubCard } from "@/components/requests/product/pharmacist-product-demande-hub-card";
import { ProductHubDashboardKpiPanel } from "@/components/requests/product/product-hub-dashboard-kpi-panel";
import {
  countInPharmacistProductHubSection,
  PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW,
  PHARMACIST_PRODUCT_HUB_SECTIONS,
  pharmacistProductHubListHref,
  pickRecentActivePharmacistProductRequests,
  rowsInPharmacistProductHubSection,
  type PharmacistProductHubSectionId,
} from "@/lib/pharmacist-product-hub-sections";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
import { RequestKindIndicator } from "@/components/ui/request-kind-indicator";
import { buttonVariants } from "@/components/ui/button";
import { neutralCardShell } from "@/lib/design-system/request-kind-accent";

const SECTION_ORDER: PharmacistProductHubSectionId[] = ["action_required", "in_preparation", "archives"];

const DASHBOARD_BUCKETS = dashboardBucketsForKind("product_request", "pharmacien");

function hubSectionDomId(sectionId: PharmacistProductHubSectionId): string {
  return `pharmacist-product-hub-section-${sectionId}`;
}

function SectionBlock({
  sectionId,
  rows,
  basePath,
  unreadById,
  defaultCollapsed,
  footer,
}: {
  sectionId: PharmacistProductHubSectionId;
  rows: PharmacistRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
  defaultCollapsed?: boolean;
  footer?: ReactNode;
}) {
  const section = PHARMACIST_PRODUCT_HUB_SECTIONS.find((s) => s.id === sectionId)!;
  const sectionRows = rowsInPharmacistProductHubSection(rows, sectionId);
  const count = sectionRows.length;
  const preview = sectionRows.slice(0, PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW);
  const listHref = pharmacistProductHubListHref(basePath);

  if (count === 0) return null;

  const body = (
    <ul className="space-y-2">
      {preview.map((r) => (
        <li key={r.id}>
          <PharmacistProductDemandeHubCard row={r} conversationUnread={unreadById[r.id] === true} />
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
        {count > PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW ? (
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

export function PharmacistProductDemandesDashboard({
  rows,
  basePath,
  unreadById,
}: {
  rows: PharmacistRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
}) {
  const recent = pickRecentActivePharmacistProductRequests(rows, unreadById, 5);
  const actionCount = countInPharmacistProductHubSection(rows, "action_required");
  const prepCount = countInPharmacistProductHubSection(rows, "in_preparation");
  const archiveCount = countInPharmacistProductHubSection(rows, "archives");

  const kpiPanel = (
    <ProductHubDashboardKpiPanel
      rows={rows}
      buckets={DASHBOARD_BUCKETS}
      basePath={basePath}
      unreadById={unreadById}
      role="pharmacien"
    />
  );

  return (
    <div className="space-y-4">
      <div className={clsx(neutralCardShell, "p-4 sm:p-5")}>
        <RequestKindIndicator kindId="product_request" />
        <p className="mt-2 text-base font-semibold text-foreground">
          {actionCount > 0
            ? `${actionCount} dossier${actionCount > 1 ? "s" : ""} à traiter en priorité`
            : prepCount > 0
              ? `${prepCount} dossier${prepCount > 1 ? "s" : ""} en préparation validée`
              : "Tout est à jour"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Regroupement indicatif — filtrez la liste complète par statut ou patient.
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
                <PharmacistProductDemandeHubCard
                  row={r}
                  compact
                  conversationUnread={unreadById[r.id] === true}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {SECTION_ORDER.map((sectionId) => (
        <SectionBlock
          key={sectionId}
          sectionId={sectionId}
          rows={rows}
          basePath={basePath}
          unreadById={unreadById}
          defaultCollapsed={sectionId === "archives" && archiveCount > PHARMACIST_PRODUCT_HUB_DASHBOARD_PREVIEW}
          footer={sectionId === "archives" ? kpiPanel : undefined}
        />
      ))}

      {archiveCount === 0 ? kpiPanel : null}

      <p className="text-center">
        <Link
          href={`${basePath}?vue=liste`}
          className={clsx(buttonVariants({ variant: "outline" }), "h-11 gap-1")}
        >
          Voir toutes les demandes
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
