/**
 * Blocs « tableau de bord » : comptage par groupe de statuts + navigation liste filtrée.
 * Périmètre actuel : demandes de produits uniquement (pas de filtre par type).
 */

export type DemandeStatBucketKey =
  | "envoyees"
  | "repondues"
  | "validees_traitees"
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

/** Patient : après validation le dossier reste `confirmed` jusqu’à « traitée » ; réservation/commande ne change plus de bloc tableau de bord. */
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
    hint: "Vous avez validé ; la pharmacie suit réservations / commandes sur les lignes retenues jusqu’à déclaration « traitée ».",
    statuses: ["confirmed"],
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

/** Pharmacien : « Validée par le client » couvre toute la phase `confirmed` ; « Traitée » ouvre le suivi comptoir. */
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
    hint: "Dossier au statut validé client : saisie réservé / commandé, ajustements, jusqu’à déclaration « traitée ».",
    statuses: ["confirmed"],
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
  /** Ancre URL historique : fusionné dans « validée » après retrait du statut virtuel `in_progress_virtual`. */
  if (param === "en_preparation") {
    return buckets.find((b) => b.key === "validees_traitees") ?? null;
  }
  return buckets.find((b) => b.key === param) ?? null;
}

export function countInBucket(rows: { status: string; status_for_dashboard?: string }[], bucket: DemandeStatBucket): number {
  const set = new Set(bucket.statuses);
  return rows.filter((r) => set.has((r.status_for_dashboard ?? r.status))).length;
}

/** Regroupement indicatif des tuiles statut (tableau de bord patient / pharmacien). */
export type DemandeStatBucketGroup = {
  id: string;
  label: string;
  bucketKeys: readonly DemandeStatBucketKey[];
};

export const PATIENT_STAT_BUCKET_GROUPS: DemandeStatBucketGroup[] = [
  {
    id: "at_pharmacy",
    label: "Chez la pharmacie",
    bucketKeys: ["envoyees", "validees_traitees"],
  },
  {
    id: "your_action",
    label: "À votre action",
    bucketKeys: ["repondues", "traitee_retrait"],
  },
  {
    id: "archives",
    label: "Archives",
    bucketKeys: ["cloturees", "abandonnees", "expirees", "annulees"],
  },
];

export const PHARMACIST_STAT_BUCKET_GROUPS: DemandeStatBucketGroup[] = [
  {
    id: "at_pharmacy",
    label: "Chez l'officine",
    bucketKeys: ["envoyees", "validees_traitees", "traitee_retrait"],
  },
  {
    id: "at_patient",
    label: "Chez le client",
    bucketKeys: ["repondues"],
  },
  {
    id: "archives",
    label: "Archives",
    bucketKeys: ["cloturees", "abandonnees", "expirees", "annulees"],
  },
];

export function statBucketGroupsForRole(role: "patient" | "pharmacien"): DemandeStatBucketGroup[] {
  return role === "patient" ? PATIENT_STAT_BUCKET_GROUPS : PHARMACIST_STAT_BUCKET_GROUPS;
}
