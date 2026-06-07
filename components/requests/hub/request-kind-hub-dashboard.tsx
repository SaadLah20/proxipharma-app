"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { ChevronRight, MessageCircle } from "lucide-react";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import {
  PatientDemandeCard,
  PharmacistDemandeCard,
  type PatientRequestRow,
  type PharmacistRequestRow,
} from "@/components/requests/demande-hub-ui";
import { PatientProductDemandeHubCard } from "@/components/requests/product/patient-product-demande-hub-card";
import { PharmacistProductDemandeHubCard } from "@/components/requests/product/pharmacist-product-demande-hub-card";
import {
  countInPatientProductHubSection,
  getPatientProductHubSections,
  patientProductHubListHref,
  rowsInPatientProductHubSection,
} from "@/lib/patient-product-hub-sections";
import {
  countInPharmacistProductHubSection,
  pharmacistProductHubListHref,
  rowsInPharmacistProductHubSection,
} from "@/lib/pharmacist-product-hub-sections";
import {
  HUB_DASHBOARD_PREVIEW,
  hubDashboardQuickStats,
  pharmacistHubSections,
  pickRecentActiveHubRows,
  sortHubRowsByRecency,
} from "@/lib/request-kind-hub-dashboard";
import { dashboardBucketsForKind, hubDashboardChrome } from "@/lib/request-kinds/hub-and-terminal-copy";
import { statBucketGroupsForRole, PATIENT_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import { patientDashboardBucketLabels } from "@/lib/i18n/request-kind-patient-copy";
import {
  patientProductHubRecentSectionClass,
  patientProductHubSectionBadgeClass,
  patientProductHubSectionShellClass,
  patientProductHubSectionTierForId,
  patientProductHubSummaryBarClass,
  type PatientHubSectionTier,
} from "@/lib/patient-product-hub-dashboard-ui";
import type { RequestKindId } from "@/lib/request-kinds/types";
import type { PatientProductHubSectionId } from "@/lib/patient-product-hub-sections";

const PATIENT_SECTION_ORDER = ["action_required", "at_pharmacy", "archives"] as const;
const PHARMA_SECTION_ORDER = [
  "action_required",
  "awaiting_patient_validation",
  "awaiting_patient",
  "archives",
] as const;

function HubSectionBlock({
  title,
  subtitle,
  count,
  listHref,
  defaultCollapsed,
  children,
  sectionDomId,
  seeAllLabel,
  showCountLabel,
  sectionTier,
}: {
  title: string;
  subtitle?: string;
  count: number;
  listHref: string;
  defaultCollapsed?: boolean;
  children: ReactNode;
  sectionDomId: string;
  seeAllLabel: string;
  showCountLabel: string;
  sectionTier?: PatientHubSectionTier;
}) {
  if (count === 0) return null;

  const body = <ul className="space-y-1.5">{children}</ul>;
  const shellClass = sectionTier
    ? patientProductHubSectionShellClass(sectionTier)
    : "border-border/80 bg-card shadow-sm";
  const countBadgeClass = sectionTier
    ? patientProductHubSectionBadgeClass(sectionTier)
    : "bg-muted text-foreground";
  const headerBorderClass =
    sectionTier === "primary"
      ? "border-sky-200/50"
      : sectionTier === "secondary"
        ? "border-sky-100/45"
        : "border-border/60";
  const titleClass =
    sectionTier === "primary"
      ? "text-[13px] font-bold text-sky-950"
      : sectionTier === "secondary"
        ? "text-[13px] font-bold text-foreground"
        : "text-[12px] font-semibold text-muted-foreground";

  return (
    <section id={sectionDomId} className={clsx("scroll-mt-4 rounded-lg border", shellClass)}>
      <div className={clsx("flex flex-wrap items-center justify-between gap-2 border-b px-2.5 py-2", headerBorderClass)}>
        <div className="min-w-0 flex-1">
          <h3 className={titleClass}>{title}</h3>
          {subtitle ? (
            <p
              className={clsx(
                "text-[10px] leading-snug",
                sectionTier === "tertiary" ? "text-muted-foreground/90" : "text-muted-foreground",
              )}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <span
          className={clsx(
            "inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
            countBadgeClass,
          )}
        >
          {count}
        </span>
        {count > HUB_DASHBOARD_PREVIEW ? (
          <Link
            href={listHref}
            className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline"
          >
            {seeAllLabel}
            <ChevronRight className="size-3" aria-hidden />
          </Link>
        ) : null}
      </div>
      <div className="p-2">
        {defaultCollapsed && count > HUB_DASHBOARD_PREVIEW ? (
          <details className="group" open={count <= 2}>
            <summary className="mb-1.5 cursor-pointer list-none text-[10px] font-semibold text-muted-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              {showCountLabel}
            </summary>
            {body}
          </details>
        ) : (
          body
        )}
      </div>
    </section>
  );
}

export function RequestKindHubDashboard({
  kindId,
  role,
  rows,
  basePath,
  unreadById,
}: {
  kindId: RequestKindId;
  role: "patient" | "pharmacien";
  rows: PatientRequestRow[] | PharmacistRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
}) {
  const tHub = useTranslations("hub");
  const patientSections = getPatientProductHubSections(tHub);
  const baseBuckets =
    role === "patient"
      ? PATIENT_DASHBOARD_BUCKETS.map((b) => {
          const labels = patientDashboardBucketLabels(tHub, kindId);
          const copy = labels[b.key];
          return copy ? { ...b, label: copy.label, hint: copy.hint } : b;
        })
      : dashboardBucketsForKind(kindId, role);
  const buckets = baseBuckets;
  const chrome = hubDashboardChrome(kindId, role);
  const productRequestPatient = kindId === "product_request" && role === "patient";
  const rowsWithStatus = rows.map((r) => ({ ...r, status_for_dashboard: r.status }));
  const stats = hubDashboardQuickStats(rowsWithStatus, buckets, unreadById);
  const recent = pickRecentActiveHubRows(rowsWithStatus, unreadById, 5, role);

  const listAllLabel =
    kindId === "prescription"
      ? tHub("dashboard.allPrescriptions")
      : kindId === "free_consultation"
        ? tHub("dashboard.allConsultations")
        : tHub("dashboard.allRequests");

  const renderPatientCard = (row: PatientRequestRow, compact: boolean) =>
    kindId === "product_request" || kindId === "prescription" ? (
      <PatientProductDemandeHubCard row={row} compact={compact} conversationUnread={unreadById[row.id] === true} />
    ) : (
      <PatientDemandeCard row={row} variant="list" conversationUnread={unreadById[row.id] === true} />
    );

  const renderPharmaCard = (row: PharmacistRequestRow, compact: boolean) =>
    kindId === "product_request" || kindId === "prescription" ? (
      <PharmacistProductDemandeHubCard row={row} compact={compact} conversationUnread={unreadById[row.id] === true} />
    ) : (
      <PharmacistDemandeCard row={row} conversationUnread={unreadById[row.id] === true} />
    );

  const sectionBlocks =
    role === "patient" ? (
      <>
        {PATIENT_SECTION_ORDER.map((sectionId) => {
          const section = patientSections.find((s) => s.id === sectionId)!;
          const sectionRows = sortHubRowsByRecency(
            rowsInPatientProductHubSection(rows as PatientRequestRow[], sectionId)
          );
          const count = countInPatientProductHubSection(rows as PatientRequestRow[], sectionId);
          return (
            <HubSectionBlock
              key={sectionId}
              sectionDomId={`hub-section-${kindId}-${sectionId}`}
              title={section.title}
              subtitle={section.subtitle}
              count={count}
              listHref={patientProductHubListHref(basePath)}
              defaultCollapsed={sectionId === "archives" && count > HUB_DASHBOARD_PREVIEW}
              seeAllLabel={tHub("dashboard.seeAll")}
              showCountLabel={tHub("dashboard.showCount", { count })}
              sectionTier={
                productRequestPatient
                  ? patientProductHubSectionTierForId(sectionId as PatientProductHubSectionId)
                  : undefined
              }
            >
              {sectionRows.slice(0, HUB_DASHBOARD_PREVIEW).map((r) => (
                <li key={r.id}>{renderPatientCard(r, true)}</li>
              ))}
            </HubSectionBlock>
          );
        })}
      </>
    ) : (
      <>
        {PHARMA_SECTION_ORDER.map((sectionId) => {
          const section = pharmacistHubSections().find((s) => s.id === sectionId)!;
          const sectionRows = sortHubRowsByRecency(
            rowsInPharmacistProductHubSection(rows as PharmacistRequestRow[], sectionId)
          );
          const count = countInPharmacistProductHubSection(rows as PharmacistRequestRow[], sectionId);
          return (
            <HubSectionBlock
              key={sectionId}
              sectionDomId={`hub-section-${kindId}-${sectionId}`}
              title={section.title}
              subtitle={section.subtitle}
              count={count}
              listHref={pharmacistProductHubListHref(basePath)}
              defaultCollapsed={
                (sectionId === "archives" || sectionId === "awaiting_patient_validation") &&
                count > HUB_DASHBOARD_PREVIEW
              }
              seeAllLabel={tHub("dashboard.seeAll")}
              showCountLabel={tHub("dashboard.showCount", { count })}
            >
              {sectionRows.slice(0, HUB_DASHBOARD_PREVIEW).map((r) => (
                <li key={r.id}>{renderPharmaCard(r, true)}</li>
              ))}
            </HubSectionBlock>
          );
        })}
      </>
    );

  return (
    <div className="space-y-3">
      <DemandeStatDashboard
        rows={rowsWithStatus}
        buckets={buckets}
        basePath={basePath}
        density="compact"
        dashboardTitle={chrome.title}
        bucketGroups={statBucketGroupsForRole(role)}
        kindId={kindId}
        viewerRole={role}
      />

      <div
        className={clsx(
          "flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 text-[10px]",
          productRequestPatient ? patientProductHubSummaryBarClass : "border-border/70 bg-muted/15",
        )}
      >
        <span className="font-semibold tabular-nums text-foreground">{stats.total}</span>
        <span className="text-muted-foreground">
          {stats.total !== 1 ? tHub("dashboard.dossiers") : tHub("dashboard.dossier")}
        </span>
        <span className="text-border">·</span>
        <span className="font-semibold tabular-nums text-foreground">{stats.active}</span>
        <span className="text-muted-foreground">{tHub("dashboard.inProgress")}</span>
        {stats.unread > 0 ? (
          <>
            <span className="text-border">·</span>
            <span
              className={clsx(
                "inline-flex items-center gap-1 font-semibold",
                productRequestPatient ? "text-sky-800" : "text-primary",
              )}
            >
              <MessageCircle className="size-3" aria-hidden />
              {stats.unread}{" "}
              {stats.unread !== 1 ? tHub("dashboard.messages") : tHub("dashboard.message")}
            </span>
          </>
        ) : null}
      </div>

      {recent.length > 0 ? (
        <section
          className={clsx(
            "rounded-lg border p-2.5 shadow-sm",
            productRequestPatient ? patientProductHubRecentSectionClass : "border-border/80 bg-card",
          )}
        >
          <h2
            className={clsx(
              "text-[13px] font-bold",
              productRequestPatient ? "text-sky-950" : "text-foreground",
            )}
          >
            {tHub("dashboard.resumeQuickly")}
          </h2>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
            {recent.map((r) => (
              <li key={r.id} className="w-[min(100%,260px)] shrink-0 sm:w-[min(80%,280px)]">
                {role === "patient"
                  ? renderPatientCard(r as PatientRequestRow, true)
                  : renderPharmaCard(r as PharmacistRequestRow, true)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-2">{sectionBlocks}</div>

      <p className="text-center pt-1">
        <Link
          href={`${basePath}?vue=liste`}
          className={clsx(
            "inline-flex items-center gap-1 rounded-lg border bg-card px-3 py-2 text-xs font-semibold shadow-sm hover:bg-muted/40",
            productRequestPatient
              ? "border-sky-200/70 text-sky-900 hover:border-sky-300/70 hover:bg-sky-50/50"
              : "border-border text-primary",
          )}
        >
          {listAllLabel}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
