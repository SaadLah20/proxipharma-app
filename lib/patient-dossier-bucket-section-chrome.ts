/** Chrome compact des titres de sections bucket — dossier patient (sans hauteur ajoutée). */

import { clsx } from "clsx";

export const patientDossierBucketTitleClass =
  "min-w-0 flex-1 truncate text-sm font-bold leading-none text-foreground";

export const patientDossierBucketTitlePharmacistClass =
  "min-w-0 flex-1 truncate text-[12px] font-bold leading-none text-foreground sm:text-[13px]";

export const patientDossierBucketHeaderShellClass =
  "border border-border/80 bg-card shadow-none";

export const patientDossierBucketHeaderPaddingClass = "px-2.5 py-1.5";

export const patientDossierBucketCountBadgeClass =
  "bg-muted/50 text-foreground ring-border/60";

/** Titre sections repliées (`<details>`) — même typo que les buckets patient. */
export const patientDossierCollapsibleTitleClass = "text-sm font-bold leading-none";

/** Combine fond neutre patient + bordure gauche indicative extraite de la barre pharmacien. */
export function patientDossierBucketHeaderShellForPatient(fullHeaderBarClass: string): string {
  const leftAccent = fullHeaderBarClass
    .split(/\s+/)
    .filter((token) => token.startsWith("border-l-"))
    .join(" ");
  return clsx(patientDossierBucketHeaderShellClass, leftAccent);
}
