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
      return "Retirés";
    case "non_retenus":
      return "Non retenus";
    default:
      return id;
  }
}

export function patientClosedArchiveBucketAriaTitleFr(id: PatientClosedArchiveLineBucketId): string {
  switch (id) {
    case "recuperes":
      return "Produits récupérés au comptoir";
    case "ecartes":
      return "Produits retirés ou non récupérés";
    case "non_retenus":
      return "Produits non retenus lors de la validation";
  }
}

function cnClosedArchiveAccent(id: PatientClosedArchiveLineBucketId, part: "header" | "shell"): string {
  const base =
    part === "header"
      ? "border border-border/80 bg-card shadow-none"
      : "border border-border/80 bg-card shadow-none";
  switch (id) {
    case "recuperes":
      return `${base} border-l-[3px] border-l-emerald-500/75`;
    case "ecartes":
      return `${base} border-l-[3px] border-l-red-400/70`;
    case "non_retenus":
      return `${base} border-l-[3px] border-l-slate-400/80`;
  }
}

export function patientClosedArchiveBucketHeaderBarClass(id: PatientClosedArchiveLineBucketId): string {
  return cnClosedArchiveAccent(id, "header");
}

export function patientClosedArchiveBucketSectionShellClass(id: PatientClosedArchiveLineBucketId): string {
  return cnClosedArchiveAccent(id, "shell");
}

export function patientClosedArchiveBucketAccentTextClass(id: PatientClosedArchiveLineBucketId): string {
  switch (id) {
    case "recuperes":
      return "text-emerald-700";
    case "ecartes":
      return "text-red-800/90";
    case "non_retenus":
      return "text-muted-foreground";
  }
}

export function patientClosedArchiveBucketCountBadgeClass(): string {
  return "bg-muted/50 text-foreground ring-border/60";
}

/** @deprecated Préférer patientClosedArchiveBucketAccentTextClass */
export function patientClosedArchiveBucketHeaderClass(id: PatientClosedArchiveLineBucketId): string {
  return patientClosedArchiveBucketAccentTextClass(id);
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
  if (row.withdrawn_after_confirm) return "Retiré";
  return "Non récupéré";
}
