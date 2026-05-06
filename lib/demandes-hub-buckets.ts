/**
 * Blocs « tableau de bord » : comptage par groupe de statuts + navigation liste filtrée.
 * Périmètre actuel : demandes de produits uniquement (pas de filtre par type).
 */

export type DemandeStatBucketKey =
  | "envoyees"
  | "repondues"
  | "validees_traitees"
  | "en_preparation"
  | "cloturees"
  | "abandonnees"
  | "expirees"
  | "annulees";

export type DemandeStatBucket = {
  key: DemandeStatBucketKey;
  /** Titre affiché sur le bloc */
  label: string;
  /** Sous-texte optionnel (1 info clé) */
  hint?: string;
  statuses: readonly string[];
};

/** Patient : « Validée » regroupe le statut confirmé (en attente clôture côté pharmacie). */
export const PATIENT_DASHBOARD_BUCKETS: DemandeStatBucket[] = [
  {
    key: "envoyees",
    label: "Envoyées",
    hint: "En attente de réponse pharmacie.",
    statuses: ["submitted", "in_review"],
  },
  {
    key: "repondues",
    label: "Répondues",
    hint: "À traiter de ton côté.",
    statuses: ["responded"],
  },
  {
    key: "validees_traitees",
    label: "Validées",
    hint: "Validation faite, attente de prise en charge.",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "En préparation",
    hint: "Traitement officine démarré.",
    statuses: ["in_progress_virtual"],
  },
  {
    key: "cloturees",
    label: "Clôturées",
    hint: "Dossier terminé.",
    statuses: ["completed", "partially_collected", "fully_collected"],
  },
  {
    key: "abandonnees",
    label: "Abandonnées",
    statuses: ["abandoned"],
  },
  {
    key: "expirees",
    label: "Expirées",
    statuses: ["expired"],
  },
  {
    key: "annulees",
    label: "Annulées",
    statuses: ["cancelled", "draft"],
  },
];

/** Pharmacien : même découpage ; « Traitées » = confirmées par le patient (préparation). */
export const PHARMACIST_DASHBOARD_BUCKETS: DemandeStatBucket[] = [
  {
    key: "envoyees",
    label: "Envoyées",
    hint: "À prendre en charge.",
    statuses: ["submitted", "in_review"],
  },
  {
    key: "repondues",
    label: "Répondues",
    hint: "En attente du client.",
    statuses: ["responded"],
  },
  {
    key: "validees_traitees",
    label: "Validées",
    hint: "Validées par le client, non démarrées.",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "En préparation",
    hint: "Traitement comptoir en cours.",
    statuses: ["in_progress_virtual"],
  },
  {
    key: "cloturees",
    label: "Clôturées",
    statuses: ["completed", "partially_collected", "fully_collected"],
  },
  {
    key: "abandonnees",
    label: "Abandonnées",
    statuses: ["abandoned"],
  },
  {
    key: "expirees",
    label: "Expirées",
    statuses: ["expired"],
  },
  {
    key: "annulees",
    label: "Annulées",
    statuses: ["cancelled", "draft"],
  },
];

export function bucketForStatusParam(param: string | null, buckets: DemandeStatBucket[] = PATIENT_DASHBOARD_BUCKETS): DemandeStatBucket | null {
  if (!param) return null;
  return buckets.find((b) => b.key === param) ?? null;
}

export function countInBucket(rows: { status: string; status_for_dashboard?: string }[], bucket: DemandeStatBucket): number {
  const set = new Set(bucket.statuses);
  return rows.filter((r) => set.has((r.status_for_dashboard ?? r.status))).length;
}
