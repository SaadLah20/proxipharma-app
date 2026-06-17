/** Chrome compact des titres de sections bucket — dossier patient et pharmacien (sans hauteur ajoutée). */

import { clsx } from "clsx";

export const patientDossierBucketTitleClass =
  "min-w-0 flex-1 truncate text-sm font-bold leading-none text-foreground";

export const patientDossierBucketHeaderShellClass =
  "border border-border/80 bg-card shadow-none";

export const patientDossierBucketHeaderPaddingClass = "px-2.5 py-1.5";

export const patientDossierBucketCountBadgeClass =
  "bg-muted/50 text-foreground ring-border/60";

/** Titre sections repliées (`<details>`) — même typo que les buckets. */
export const patientDossierCollapsibleTitleClass = "text-sm font-bold leading-none";

/** Fond neutre + bordure gauche indicative extraite de la barre bucket legacy. */
export function patientDossierBucketHeaderShellForPatient(fullHeaderBarClass: string): string {
  const leftAccent = fullHeaderBarClass
    .split(/\s+/)
    .filter((token) => token.startsWith("border-l-"))
    .join(" ");
  return clsx(patientDossierBucketHeaderShellClass, leftAccent);
}
