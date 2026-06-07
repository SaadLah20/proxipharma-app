/**
 * Accent violet discret — parcours patient « consultation libre » (tous statuts hub).
 * Opacités basses pour ne pas surcharger les pages (comme amber ordonnances).
 */

import { consultationRequestPublicTheme as t } from "@/lib/request-kinds/consultation-request-public-theme";

/** Contour page / section dossier consultation (8 statuts patient). */
export const patientConsultationRequestDossierSectionShellClass =
  "border-violet-200/60 bg-gradient-to-br from-violet-50/45 via-white to-fuchsia-50/18 ring-1 ring-violet-200/40";

/** Carte ligne dans un bucket (validée, traitée, archive, répondue…). */
export const patientConsultationRequestLineCardClass =
  "w-full min-w-0 rounded-lg border border-violet-200/60 bg-card px-2 py-2.5 shadow-sm ring-1 ring-violet-100/35";

export function isPatientConsultationRequestType(requestType: string | null | undefined): boolean {
  return requestType === "free_consultation";
}

export function patientConsultationRequestDossierHeaderShellClass(): string {
  return "rounded-xl border border-violet-200/60 bg-card shadow-sm ring-1 ring-violet-100/40";
}

export { t as patientConsultationRequestPublicTheme };
