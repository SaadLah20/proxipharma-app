/** Regroupement des lignes sur une demande produits clôturée (archive patient). */

export type PatientClosedArchiveLineBucketId = "recuperes" | "ecartes" | "non_retenus";

export const PATIENT_CLOSED_ARCHIVE_BUCKET_ORDER: PatientClosedArchiveLineBucketId[] = [
  "recuperes",
  "ecartes",
  "non_retenus",
];

export function patientClosedArchiveBucketTitleFr(id: PatientClosedArchiveLineBucketId): string {
  switch (id) {
    case "recuperes":
      return "Récupérés";
    case "ecartes":
      return "Écartés";
    case "non_retenus":
      return "Non retenus";
    default:
      return id;
  }
}

type ClosedArchiveLineLike = {
  is_selected_by_patient: boolean;
  counter_outcome?: string | null;
  withdrawn_after_confirm?: boolean | null;
};

export function patientClosedArchiveLineBucket<T extends ClosedArchiveLineLike>(
  row: T
): PatientClosedArchiveLineBucketId {
  if (!row.is_selected_by_patient) return "non_retenus";
  if ((row.counter_outcome ?? "unset") === "picked_up") return "recuperes";
  return "ecartes";
}

export function bucketPatientClosedArchiveLines<T extends ClosedArchiveLineLike>(
  items: T[]
): Record<PatientClosedArchiveLineBucketId, T[]> {
  const buckets: Record<PatientClosedArchiveLineBucketId, T[]> = {
    recuperes: [],
    ecartes: [],
    non_retenus: [],
  };
  for (const row of items) {
    buckets[patientClosedArchiveLineBucket(row)].push(row);
  }
  return buckets;
}

export function patientClosedArchiveClosureLabelFr(row: ClosedArchiveLineLike): string {
  if ((row.counter_outcome ?? "unset") === "picked_up") return "Récupéré";
  if (row.withdrawn_after_confirm) return "Écarté";
  return "Non récupéré";
}
