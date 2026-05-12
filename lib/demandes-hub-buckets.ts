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

/** Patient : « Validée par vous » sans réservation/commande sur les lignes ; « En préparation officine » = statut dérivé `in_progress_virtual` (voir `status_for_dashboard`). */
export const PATIENT_DASHBOARD_BUCKETS: DemandeStatBucket[] = [
  {
    key: "envoyees",
    label: "Envoyées",
    hint: "En attente de réponse pharmacie.",
    statuses: ["submitted", "in_review"],
  },
  {
    key: "repondues",
    label: "À confirmer",
    hint: "Répondue - à valider : confirmez ou refusez sous 24 h.",
    statuses: ["responded"],
  },
  {
    key: "validees_traitees",
    label: "Validée par vous",
    hint: "Vous avez validé ; aucune réservation/commande enregistrée sur les lignes retenues (ou attente validation préparation).",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "En préparation officine",
    hint: "Réservation / commande en cours sur au moins une ligne retenue ; le dossier reste « validé » jusqu’à ouverture du comptoir.",
    statuses: ["in_progress_virtual"],
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

/** Pharmacien : « Validée par le client » sans réservation/commande sur les lignes ; puis suivi résa./commande avant « Traitée · comptoir ». */
export const PHARMACIST_DASHBOARD_BUCKETS: DemandeStatBucket[] = [
  {
    key: "envoyees",
    label: "Envoyées",
    hint: "À prendre en charge.",
    statuses: ["submitted", "in_review"],
  },
  {
    key: "repondues",
    label: "Attente client",
    hint: "Réponse envoyée : le client doit confirmer sous 24 h.",
    statuses: ["responded"],
  },
  {
    key: "validees_traitees",
    label: "Validée par le client",
    hint: "Validé côté client sans réservation/commande sur les lignes retenues (ou avant validation « préparation terminée »).",
    statuses: ["confirmed"],
  },
  {
    key: "en_preparation",
    label: "Résa. / commande",
    hint: "Réservations, commandes ou ajustements après validation ; statut dossier encore « validé client ».",
    statuses: ["in_progress_virtual"],
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
