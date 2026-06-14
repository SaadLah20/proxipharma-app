import type { PromoStatBucket } from "@/lib/promo/reservation-hub-buckets";

export type PromoHubListFilterSummaryInput = {
  activeBucket: PromoStatBucket | null;
  entityLabel: string | null;
  referenceQuery: string;
  sortNewestFirst: boolean;
  entityFieldLabel?: string;
  /** Défaut `true` — ne figure pas dans le résumé. */
  activeOnly?: boolean;
  includeArchivesLabel?: string;
};

export function promoHubListActiveFilterParts(input: PromoHubListFilterSummaryInput): string[] {
  const parts: string[] = [];
  if (input.activeBucket) {
    parts.push(`Statut : ${input.activeBucket.label}`);
  }
  if (input.entityLabel) {
    parts.push(`${input.entityFieldLabel ?? "Filtre"} : ${input.entityLabel}`);
  }
  if (input.referenceQuery.trim().length >= 2) {
    parts.push(`Référence : « ${input.referenceQuery.trim()} »`);
  }
  if (!input.sortNewestFirst) {
    parts.push("Tri : plus anciennes d'abord");
  }
  if (input.activeOnly === false && input.includeArchivesLabel) {
    parts.push(input.includeArchivesLabel);
  }
  return parts;
}

export function promoHubListActiveFiltersSummary(input: PromoHubListFilterSummaryInput): string | null {
  const parts = promoHubListActiveFilterParts(input);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function promoHubListHasActiveFilters(input: PromoHubListFilterSummaryInput): boolean {
  return promoHubListActiveFilterParts(input).length > 0;
}
