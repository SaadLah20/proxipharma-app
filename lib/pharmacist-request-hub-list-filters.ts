import type { DemandeStatBucket } from "@/lib/demandes-hub-buckets";

export type PharmacistHubListFilterSummaryInput = {
  activeBucket: DemandeStatBucket | null;
  patientLabel: string | null;
  referenceQuery: string;
  sortNewestFirst: boolean;
};

export function pharmacistHubListActiveFilterParts(input: PharmacistHubListFilterSummaryInput): string[] {
  const parts: string[] = [];
  if (input.activeBucket) {
    parts.push(`Statut : ${input.activeBucket.label}`);
  }
  if (input.patientLabel) {
    parts.push(`Patient : ${input.patientLabel}`);
  }
  if (input.referenceQuery.trim().length >= 2) {
    parts.push(`Référence : « ${input.referenceQuery.trim()} »`);
  }
  if (!input.sortNewestFirst) {
    parts.push("Tri : plus anciennes d’abord");
  }
  return parts;
}

export function pharmacistHubListActiveFiltersSummary(input: PharmacistHubListFilterSummaryInput): string | null {
  const parts = pharmacistHubListActiveFilterParts(input);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function pharmacistHubListHasActiveFilters(input: PharmacistHubListFilterSummaryInput): boolean {
  return pharmacistHubListActiveFilterParts(input).length > 0;
}
