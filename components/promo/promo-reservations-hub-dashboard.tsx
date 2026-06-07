"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import {
  PatientPromoReservationHubCard,
  PharmacistPromoReservationHubCard,
} from "@/components/promo/promo-reservation-hub-card";
import { PromoStatDashboard } from "@/components/promo/promo-stat-dashboard";
import {
  promoDashboardBucketsForRole,
  promoStatBucketGroupsForRole,
} from "@/lib/promo/reservation-hub-buckets";
import {
  PROMO_HUB_DASHBOARD_PREVIEW,
  pickRecentActivePromoRows,
  promoHubDashboardQuickStats,
  sortPromoHubRowsByRecency,
} from "@/lib/promo/reservation-hub-dashboard";
import {
  countInPromoHubSection,
  promoHubListHref,
  promoHubSectionOrderForRole,
  promoHubSectionsForRole,
  rowsInPromoHubSection,
  type PromoHubSectionId,
  type PromoReservationHubRow,
} from "@/lib/promo/reservation-hub-sections";
import type { AppLocale } from "@/lib/i18n/config";
import { patientPromoDashboardBuckets } from "@/lib/i18n/promo-hub-buckets";
import {
  patientPromoHubDashboardAccent,
  patientPromoHubListLinkClass,
  patientPromoHubRecentSectionClass,
  patientPromoHubRecentSectionTitleClass,
  patientPromoHubSectionBadgeClass,
  patientPromoHubSectionHeaderBorderClass,
  patientPromoHubSectionShellClass,
  patientPromoHubSectionTierForId,
  patientPromoHubSectionTitleClass,
  patientPromoHubSummaryBarClass,
  type PatientPromoHubDashboardAccent,
} from "@/lib/patient-promo-hub-dashboard-ui";
import type { PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";

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
  hubAccent,
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
  hubAccent?: PatientPromoHubDashboardAccent | null;
}) {
  if (count === 0) return null;

  const body = <ul className="space-y-1.5">{children}</ul>;
  const shellClass =
    sectionTier && hubAccent
      ? patientPromoHubSectionShellClass(sectionTier)
      : "border-border/80 bg-card shadow-sm";
  const countBadgeClass =
    sectionTier && hubAccent
      ? patientPromoHubSectionBadgeClass(sectionTier)
      : "bg-muted text-foreground";
  const headerBorderClass =
    sectionTier && hubAccent
      ? patientPromoHubSectionHeaderBorderClass(sectionTier)
      : "border-border/60";
  const titleClass =
    sectionTier && hubAccent
      ? patientPromoHubSectionTitleClass(sectionTier)
      : "text-[13px] font-bold text-foreground";

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
        {count > PROMO_HUB_DASHBOARD_PREVIEW ? (
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
        {defaultCollapsed && count > PROMO_HUB_DASHBOARD_PREVIEW ? (
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

export function PromoReservationsHubDashboard({
  role,
  rows,
  basePath,
}: {
  role: "patient" | "pharmacien";
  rows: PromoReservationHubRow[];
  basePath: string;
}) {
  const locale = useLocale() as AppLocale;
  const tHub = useTranslations("hub");
  const tPromo = useTranslations("promo");

  const hubAccent = patientPromoHubDashboardAccent(role);
  const buckets =
    role === "patient"
      ? patientPromoDashboardBuckets(tPromo)
      : promoDashboardBucketsForRole(role);
  const stats = promoHubDashboardQuickStats(rows, buckets);
  const recent = pickRecentActivePromoRows(rows, 5, role);
  const sections = promoHubSectionsForRole(role);
  const sectionOrder = promoHubSectionOrderForRole(role);

  const listAllLabel =
    role === "patient" ? tPromo("dashboard.allReservations") : "Toutes les réservations";

  const dashboardTitle =
    role === "patient" ? tPromo("dashboard.title") : "Réservations packs promo";
  const dashboardSubtitle =
    role === "patient" ? tPromo("dashboard.subtitle") : "5 statuts — suivi des demandes sur vos offres.";

  return (
    <div className="space-y-3">
      <PromoStatDashboard
        rows={rows}
        buckets={buckets}
        basePath={basePath}
        density="compact"
        dashboardTitle={dashboardTitle}
        dashboardSubtitle={dashboardSubtitle}
        bucketGroups={promoStatBucketGroupsForRole(role)}
        hubAccent={hubAccent}
      />

      <div
        className={clsx(
          "flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-2 text-[10px]",
          hubAccent ? patientPromoHubSummaryBarClass : "border-border/70 bg-muted/15",
        )}
      >
        <span className="font-semibold tabular-nums text-foreground">{stats.total}</span>
        <span className="text-muted-foreground">
          {stats.total !== 1 ? tHub("dashboard.dossiers") : tHub("dashboard.dossier")}
        </span>
        <span className="text-border">·</span>
        <span className="font-semibold tabular-nums text-foreground">{stats.active}</span>
        <span className="text-muted-foreground">{tHub("dashboard.inProgress")}</span>
      </div>

      {recent.length > 0 ? (
        <section
          className={clsx(
            "rounded-lg border p-2.5 shadow-sm",
            hubAccent ? patientPromoHubRecentSectionClass : "border-border/80 bg-card",
          )}
        >
          <h2
            className={clsx(
              "text-[13px] font-bold",
              hubAccent ? patientPromoHubRecentSectionTitleClass() : "text-foreground",
            )}
          >
            {tHub("dashboard.resumeQuickly")}
          </h2>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
            {recent.map((r) => (
              <li key={r.id} className="w-[min(100%,260px)] shrink-0 sm:w-[min(80%,280px)]">
                {role === "patient" ? (
                  <PatientPromoReservationHubCard row={r} locale={locale} compact />
                ) : (
                  <PharmacistPromoReservationHubCard row={r} compact />
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="space-y-2">
        {sectionOrder.map((sectionId) => {
          const section = sections.find((s) => s.id === sectionId)!;
          const sectionRows = sortPromoHubRowsByRecency(rowsInPromoHubSection(rows, sectionId, role));
          const count = countInPromoHubSection(rows, sectionId, role);
          const sectionTitle =
            role === "patient" ? tPromo(`dashboard.sections.${sectionId}.title`) : section.title;
          const sectionSubtitle =
            role === "patient" ? tPromo(`dashboard.sections.${sectionId}.subtitle`) : section.subtitle;

          return (
            <HubSectionBlock
              key={sectionId}
              sectionDomId={`promo-hub-section-${sectionId}`}
              title={sectionTitle}
              subtitle={sectionSubtitle}
              count={count}
              listHref={promoHubListHref(basePath)}
              defaultCollapsed={sectionId === "archives" && count > PROMO_HUB_DASHBOARD_PREVIEW}
              seeAllLabel={tHub("dashboard.seeAll")}
              showCountLabel={tHub("dashboard.showCount", { count })}
              sectionTier={
                hubAccent ? patientPromoHubSectionTierForId(sectionId as PromoHubSectionId) : undefined
              }
              hubAccent={hubAccent}
            >
              {sectionRows.slice(0, PROMO_HUB_DASHBOARD_PREVIEW).map((r) => (
                <li key={r.id}>
                  {role === "patient" ? (
                    <PatientPromoReservationHubCard row={r} locale={locale} compact />
                  ) : (
                    <PharmacistPromoReservationHubCard row={r} compact />
                  )}
                </li>
              ))}
            </HubSectionBlock>
          );
        })}
      </div>

      <p className="pt-1 text-center">
        <Link
          href={`${basePath}?vue=liste`}
          className={clsx(
            "inline-flex items-center gap-1 rounded-lg border bg-card px-3 py-2 text-xs font-semibold shadow-sm hover:bg-muted/40",
            hubAccent ? patientPromoHubListLinkClass() : "border-border text-primary",
          )}
        >
          {listAllLabel}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </p>
    </div>
  );
}
