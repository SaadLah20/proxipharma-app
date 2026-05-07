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

/** Patient : « Validée par vous » tant que la pharmacie n’a pas commencé la préparation ; « En traitement » une fois l’officine active (voir `status_for_dashboard`). */
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
    label: "Validée par vous",
    hint: "Vous avez validé ; la pharmacie n’a pas encore indiqué de réservation ou commande sur la ligne.",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "En traitement",
    hint: "La pharmacie a commencé à mettre à jour la commande (réservé ou commandé sur au moins une ligne).",
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

/** Pharmacien : « Validée par le client » tant que vous n’avez pas commencé la préparation ; « En traitement » après première action (réservé / commandé). */
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
    label: "Validée par le client",
    hint: "Le client a validé ; aucune réservation / commande saisie par vous sur les lignes concernées.",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "En traitement",
    hint: "Réservation ou commande renseignée sur au moins une ligne.",
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
