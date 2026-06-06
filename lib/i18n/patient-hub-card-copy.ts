import { useTranslations } from "next-intl";

export function usePatientHubCardCopy() {
  const t = useTranslations("hub.card");
  const tDossier = useTranslations("demandes.dossierBand");

  return {
    lastActivity: (when: string) => t("lastActivity", { when }),
    message: t("message"),
    messageUnreadTitle: t("messageUnreadTitle"),
    pharmacyFallback: tDossier("pharmacyFallback"),
  };
}
