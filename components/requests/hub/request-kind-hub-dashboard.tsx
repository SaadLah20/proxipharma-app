"use client";

import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import type { PatientRequestRow, PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { dashboardBucketsForKind, hubDashboardChrome } from "@/lib/request-kinds/hub-and-terminal-copy";
import { statBucketGroupsForRole, PATIENT_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import { patientDashboardBucketLabels } from "@/lib/i18n/request-kind-patient-copy";
import type { RequestKindId } from "@/lib/request-kinds/types";
import { useTranslations } from "next-intl";

export function RequestKindHubDashboard({
  kindId,
  role,
  rows,
  basePath,
  preserveSearchParams,
  usePlatformAccent = false,
}: {
  kindId: RequestKindId;
  role: "patient" | "pharmacien";
  rows: PatientRequestRow[] | PharmacistRequestRow[];
  basePath: string;
  unreadById?: Record<string, boolean>;
  preserveSearchParams?: Record<string, string>;
  /** Charte globale Pharmeto (onglet Tous) au lieu de la couleur parcours produits. */
  usePlatformAccent?: boolean;
}) {
  const tHub = useTranslations("hub");
  const baseBuckets =
    role === "patient"
      ? PATIENT_DASHBOARD_BUCKETS.map((b) => {
          const labels = patientDashboardBucketLabels(tHub, kindId);
          const copy = labels[b.key];
          return copy ? { ...b, label: copy.label, hint: copy.hint } : b;
        })
      : dashboardBucketsForKind(kindId, role);
  const chrome = hubDashboardChrome(kindId, role);
  const rowsWithStatus = rows.map((r) => ({ ...r, status_for_dashboard: r.status }));

  return (
    <DemandeStatDashboard
      rows={rowsWithStatus}
      buckets={baseBuckets}
      basePath={basePath}
      density="compact"
      dashboardTitle={chrome.title}
      bucketGroups={statBucketGroupsForRole(role)}
      kindId={usePlatformAccent ? undefined : kindId}
      viewerRole={role}
      preserveSearchParams={preserveSearchParams}
    />
  );
}
