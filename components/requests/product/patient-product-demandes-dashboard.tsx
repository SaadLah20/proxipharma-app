"use client";

import type { PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestKindHubDashboard } from "@/components/requests/hub/request-kind-hub-dashboard";

/** @deprecated Préférer `RequestKindHubDashboard` depuis le hub par type. */
export function PatientProductDemandesDashboard({
  rows,
  basePath,
  unreadById,
}: {
  rows: PatientRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
}) {
  return (
    <RequestKindHubDashboard
      kindId="product_request"
      role="patient"
      rows={rows}
      basePath={basePath}
      unreadById={unreadById}
    />
  );
}
