import { useTranslations } from "next-intl";

/** Clé next-intl `demandes.statusBadges.*` pour un statut dossier patient. */
export function patientRequestStatusBadgeKey(status: string): string | null {
  switch (status) {
    case "draft":
      return "draft";
    case "submitted":
      return "submitted";
    case "in_review":
      return "inReview";
    case "responded":
      return "responded";
    case "confirmed":
      return "confirmed";
    case "processing":
      return "processing";
    case "treated":
      return "treated";
    case "completed":
    case "partially_collected":
    case "fully_collected":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "abandoned":
      return "abandoned";
    case "expired":
      return "expired";
    case "in_progress_virtual":
      return "inProgressVirtual";
    default:
      return null;
  }
}

/** Libellé badge statut dossier patient (FR / AR via next-intl). */
export function usePatientRequestStatusLabel(status: string): string {
  const t = useTranslations("demandes.statusBadges");
  const key = patientRequestStatusBadgeKey(status);
  if (key) return t(key);
  return status;
}
