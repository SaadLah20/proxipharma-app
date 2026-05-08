/**
 * Blocs « tableau de bord » : comptage par groupe de statuts + navigation liste filtrée.
 * Périmètre actuel : demandes de produits uniquement (pas de filtre par type).
 */

export type DemandeStatBucketKey =
  | "envoyees"
  | "repondues"
  | "validees_traitees"
  | "en_preparation"
  | "traitee_retrait"
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
    hint: "Vous avez validé ; la pharmacie ne vous a pas encore déclaré en préparation active sur le dossier.",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "En préparation officine",
    hint: "Réservation / commande ou ajustements après validation.",
    statuses: ["in_progress_virtual", "processing"],
  },
  {
    key: "traitee_retrait",
    label: "Traitée · retrait",
    hint: "Préparation officine terminée ; retrait ou suivi au comptoir.",
    statuses: ["treated"],
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
    hint: "Le dossier figure encore tout juste validé côté client (pas encore votre entrée officine préparation).",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "En préparation",
    hint: "Réservations, commandes ou ajustements en cours après validation client.",
    statuses: ["in_progress_virtual", "processing"],
  },
  {
    key: "traitee_retrait",
    label: "Traitée · comptoir",
    hint: "Vous déclarez la préparation terminée ; retrait ligne à ligne jusqu’à clôture.",
    statuses: ["treated"],
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
