"use client";

import type { PharmacistRequestRow } from "@/components/requests/demande-hub-ui";
import { RequestKindHubDashboard } from "@/components/requests/hub/request-kind-hub-dashboard";

/** @deprecated Préférer `RequestKindHubDashboard` depuis le hub par type. */
export function PharmacistProductDemandesDashboard({
  rows,
  basePath,
  unreadById,
}: {
  rows: PharmacistRequestRow[];
  basePath: string;
  unreadById: Record<string, boolean>;
}) {
  return (
    <RequestKindHubDashboard
      kindId="product_request"
      role="pharmacien"
      rows={rows}
      basePath={basePath}
      unreadById={unreadById}
    />
  );
}
