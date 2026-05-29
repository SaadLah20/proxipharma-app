import type { DemandeStatBucket } from "@/lib/demandes-hub-buckets";

export type PatientHubListFilterSummaryInput = {
  activeBucket: DemandeStatBucket | null;
  pharmacyLabel: string | null;
  referenceQuery: string;
  sortNewestFirst: boolean;
};

/** Libellés courts pour le résumé quand le panneau filtres est masqué. */
export function patientHubListActiveFilterParts(input: PatientHubListFilterSummaryInput): string[] {
  const parts: string[] = [];
  if (input.activeBucket) {
    parts.push(`Statut : ${input.activeBucket.label}`);
  }
  if (input.pharmacyLabel) {
    parts.push(`Pharmacie : ${input.pharmacyLabel}`);
  }
  if (input.referenceQuery.trim().length >= 2) {
    parts.push(`Référence : « ${input.referenceQuery.trim()} »`);
  }
  if (!input.sortNewestFirst) {
    parts.push("Tri : plus anciennes d’abord");
  }
  return parts;
}

export function patientHubListActiveFiltersSummary(input: PatientHubListFilterSummaryInput): string | null {
  const parts = patientHubListActiveFilterParts(input);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function patientHubListHasActiveFilters(input: PatientHubListFilterSummaryInput): boolean {
  return patientHubListActiveFilterParts(input).length > 0;
}
