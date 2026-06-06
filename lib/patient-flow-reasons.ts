/** Codes motifs annulation / abandon patient (pilote workflow produits — Q16). */
export const PATIENT_CANCEL_REASON_CODES = [
  "no_longer_needed",
  "found_elsewhere",
  "price",
  "delay",
  "mistake",
  "other",
] as const;

export type PatientCancelReasonCode = (typeof PATIENT_CANCEL_REASON_CODES)[number];

/** @deprecated Préférer `getPatientCancelReasonLabels(t)` côté patient i18n. */
export const PATIENT_CANCEL_REASON_LABELS: Record<PatientCancelReasonCode, string> = {
  no_longer_needed: "Je n'ai plus besoin de ces produits",
  found_elsewhere: "J'ai trouvé ailleurs",
  price: "Prix / budget",
  delay: "Délai trop long",
  mistake: "Erreur de demande",
  other: "Autre (préciser)",
};

export function getPatientCancelReasonLabels(
  t: (key: PatientCancelReasonCode) => string,
): Record<PatientCancelReasonCode, string> {
  return {
    no_longer_needed: t("no_longer_needed"),
    found_elsewhere: t("found_elsewhere"),
    price: t("price"),
    delay: t("delay"),
    mistake: t("mistake"),
    other: t("other"),
  };
}

export function isPatientCancelReasonCode(v: string): v is PatientCancelReasonCode {
  return (PATIENT_CANCEL_REASON_CODES as readonly string[]).includes(v);
}
