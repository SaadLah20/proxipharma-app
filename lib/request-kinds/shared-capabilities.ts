/**
 * Capacités et regroupements de statuts communs aux trois types de demande.
 * Source unique pour les hubs : {@link ../demandes-hub-buckets.ts}.
 */

export {
  PATIENT_DASHBOARD_BUCKETS,
  PHARMACIST_DASHBOARD_BUCKETS,
  bucketForStatusParam,
  countInBucket,
  type DemandeStatBucket,
  type DemandeStatBucketKey,
} from "@/lib/demandes-hub-buckets";

/** Statuts terminaux / archives (lecture seule côté patient produits). */
export const SHARED_ARCHIVE_STATUSES = [
  "cancelled",
  "abandoned",
  "expired",
  "completed",
  "partially_collected",
  "fully_collected",
] as const;

/** Phases post-réponse patient avec passage en officine. */
export const SHARED_PLANNED_VISIT_STATUSES = [
  "confirmed",
  "treated",
  "completed",
  "partially_collected",
  "fully_collected",
] as const;

export function sharedShowPlannedVisitBlock(status: string): boolean {
  if (["cancelled", "abandoned", "expired"].includes(status)) return false;
  return (SHARED_PLANNED_VISIT_STATUSES as readonly string[]).includes(status);
}

/** Aligné sur `public._request_uses_product_line_workflow` (Supabase). */
export function requestUsesProductLineWorkflow(requestType: string | null | undefined): boolean {
  return (
    requestType === "product_request" ||
    requestType === "prescription" ||
    requestType === "free_consultation"
  );
}
