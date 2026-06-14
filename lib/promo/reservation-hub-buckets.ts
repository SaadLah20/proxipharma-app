import type { PromoReservationStatus } from "@/lib/promo/types";

export type PromoStatBucketKey = "soumise" | "confirmee" | "recuperee" | "indisponible" | "annulee";

export type PromoStatBucket = {
  key: PromoStatBucketKey;
  label: string;
  hint?: string;
  statuses: readonly PromoReservationStatus[];
};

export type PromoStatBucketGroup = {
  id: string;
  label: string;
  bucketKeys: readonly PromoStatBucketKey[];
  subtitle?: string;
};

export const PATIENT_PROMO_DASHBOARD_BUCKETS_FR: PromoStatBucket[] = [
  {
    key: "soumise",
    label: "Demande envoyée",
    hint: "L'officine va confirmer la disponibilité du pack.",
    statuses: ["submitted"],
  },
  {
    key: "confirmee",
    label: "Confirmée",
    hint: "Présentez-vous à la date indiquée pour retirer votre pack.",
    statuses: ["confirmed"],
  },
  {
    key: "recuperee",
    label: "Récupérée",
    hint: "Pack retiré en officine.",
    statuses: ["collected"],
  },
  {
    key: "indisponible",
    label: "Non disponible",
    hint: "L'officine n'a pas pu honorer cette réservation.",
    statuses: ["unavailable"],
  },
  {
    key: "annulee",
    label: "Annulée",
    hint: "Cette demande n'est plus active.",
    statuses: ["cancelled"],
  },
];

export const PHARMACIST_PROMO_DASHBOARD_BUCKETS_FR: PromoStatBucket[] = [
  {
    key: "soumise",
    label: "À traiter",
    hint: "Confirmer ou décliner la demande de réservation.",
    statuses: ["submitted"],
  },
  {
    key: "confirmee",
    label: "Confirmées",
    hint: "Pack réservé — le client passe à la date prévue.",
    statuses: ["confirmed"],
  },
  {
    key: "recuperee",
    label: "Récupérées",
    hint: "Pack retiré par le client.",
    statuses: ["collected"],
  },
  {
    key: "indisponible",
    label: "Non disponibles",
    hint: "Demande déclinée avec motif.",
    statuses: ["unavailable"],
  },
  {
    key: "annulee",
    label: "Annulées",
    hint: "Réservation annulée par le client ou l'officine.",
    statuses: ["cancelled"],
  },
];

export const PATIENT_PROMO_STAT_BUCKET_GROUPS: PromoStatBucketGroup[] = [
  {
    id: "en_cours",
    label: "En cours",
    bucketKeys: ["soumise", "confirmee"],
  },
  {
    id: "archives",
    label: "Historique",
    bucketKeys: ["recuperee", "indisponible", "annulee"],
  },
];

export const PHARMACIST_PROMO_STAT_BUCKET_GROUPS: PromoStatBucketGroup[] = [
  {
    id: "a_suivre",
    label: "À suivre",
    bucketKeys: ["soumise", "confirmee"],
  },
  {
    id: "archives",
    label: "Terminées",
    bucketKeys: ["recuperee", "indisponible", "annulee"],
  },
];

export function promoStatBucketGroupsForRole(role: "patient" | "pharmacien"): PromoStatBucketGroup[] {
  return role === "patient" ? PATIENT_PROMO_STAT_BUCKET_GROUPS : PHARMACIST_PROMO_STAT_BUCKET_GROUPS;
}

export function promoDashboardBucketsForRole(role: "patient" | "pharmacien"): PromoStatBucket[] {
  return role === "patient" ? PATIENT_PROMO_DASHBOARD_BUCKETS_FR : PHARMACIST_PROMO_DASHBOARD_BUCKETS_FR;
}

export function bucketForPromoStatusParam(
  param: string | null,
  buckets: PromoStatBucket[] = PATIENT_PROMO_DASHBOARD_BUCKETS_FR,
): PromoStatBucket | null {
  if (!param) return null;
  return buckets.find((b) => b.key === param) ?? null;
}

export function countInPromoBucket(rows: { status: string }[], bucket: PromoStatBucket): number {
  const set = new Set(bucket.statuses);
  return rows.filter((r) => set.has(r.status as PromoReservationStatus)).length;
}

export function filterPromoHubListRows<T extends { status: string }>(
  rows: T[],
  opts: { bucketStatuses: readonly PromoReservationStatus[] | null },
): T[] {
  if (!opts.bucketStatuses) return rows;
  const allow = new Set(opts.bucketStatuses);
  return rows.filter((r) => allow.has(r.status as PromoReservationStatus));
}

export const PATIENT_PROMO_ARCHIVE_BUCKET_KEYS = ["recuperee", "indisponible", "annulee"] as const;

const PATIENT_PROMO_ARCHIVE_BUCKET_KEY_SET = new Set<string>(PATIENT_PROMO_ARCHIVE_BUCKET_KEYS);

export function isPatientPromoArchiveBucketKey(key: PromoStatBucketKey): boolean {
  return PATIENT_PROMO_ARCHIVE_BUCKET_KEY_SET.has(key);
}

/** Statuts groupe « En cours » (liste patient « actives seulement »). */
export function patientPromoActiveStatuses(
  buckets: PromoStatBucket[] = PATIENT_PROMO_DASHBOARD_BUCKETS_FR,
): readonly PromoReservationStatus[] {
  return buckets
    .filter((b) => !isPatientPromoArchiveBucketKey(b.key))
    .flatMap((b) => b.statuses);
}
