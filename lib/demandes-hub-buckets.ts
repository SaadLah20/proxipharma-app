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
    hint: "À valider sous 24 h, sinon la demande expire.",
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
    hint: "Après validation, sans récupération.",
    statuses: ["abandoned"],
  },
  {
    key: "expirees",
    label: "Expirées",
    hint: "Sans réponse dans les 24 h après la pharmacie.",
    statuses: ["expired"],
  },
  {
    key: "annulees",
    label: "Annulées",
    hint: "Avant ou après réponse, sans validation.",
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
    hint: "Le client a 24 h pour répondre, sinon expiration.",
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
    hint: "Validées puis arrêt sans récupération.",
    statuses: ["abandoned"],
  },
  {
    key: "expirees",
    label: "Expirées",
    hint: "Aucune action client sous 24 h après votre réponse.",
    statuses: ["expired"],
  },
  {
    key: "annulees",
    label: "Annulées",
    hint: "Annulation client (avant ou après réponse).",
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
