/** Textes d’aide — note par produit (patient) et échange officine (pharmacien). */

export const PATIENT_PRODUCT_LINE_COMMENT_PLACEHOLDER_FR =
  "Ex. allergie (pénicilline), usage enfant ou diabète, ou si la grande taille manque, accepter la petite en alternative…";

export const PHARMACIST_LINE_NOTE_PLACEHOLDER_REPLY_FR =
  "Répondez au patient (ex. conseil d’utilisation, contre-indication, posologie)…";

export const PHARMACIST_LINE_NOTE_PLACEHOLDER_NEW_FR =
  "Note pour le patient (ex. conseil d’utilisation, mode d’emploi)…";

export function pharmacistLineNotePlaceholderFr(hasPatientMessage: boolean): string {
  return hasPatientMessage
    ? PHARMACIST_LINE_NOTE_PLACEHOLDER_REPLY_FR
    : PHARMACIST_LINE_NOTE_PLACEHOLDER_NEW_FR;
}
