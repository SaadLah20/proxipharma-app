"use client";

import { useTranslations } from "next-intl";
import { PromoStatDashboard } from "@/components/promo/promo-stat-dashboard";
import {
  promoDashboardBucketsForRole,
  promoStatBucketGroupsForRole,
} from "@/lib/promo/reservation-hub-buckets";
import type { PromoReservationHubRow } from "@/lib/promo/reservation-hub-sections";
import { patientPromoDashboardBuckets } from "@/lib/i18n/promo-hub-buckets";
import { patientPromoHubDashboardAccent } from "@/lib/patient-promo-hub-dashboard-ui";

/** Tableau de bord packs — aligné `RequestKindHubDashboard` : tuiles statuts uniquement. */
export function PromoReservationsHubDashboard({
  role,
  rows,
  basePath,
}: {
  role: "patient" | "pharmacien";
  rows: PromoReservationHubRow[];
  basePath: string;
}) {
  const tPromo = useTranslations("promo");

  const hubAccent = patientPromoHubDashboardAccent(role);
  const buckets =
    role === "patient"
      ? patientPromoDashboardBuckets(tPromo)
      : promoDashboardBucketsForRole(role);

  const dashboardTitle =
    role === "patient" ? tPromo("dashboard.title") : "Réservations packs promo";

  return (
    <PromoStatDashboard
      rows={rows}
      buckets={buckets}
      basePath={basePath}
      density="compact"
      dashboardTitle={dashboardTitle}
      bucketGroups={promoStatBucketGroupsForRole(role)}
      hubAccent={hubAccent}
    />
  );
}
