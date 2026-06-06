import { useTranslations } from "next-intl";

/** Libellé court singulier pour « dernier dossier » sur carte officine. */
export function usePatientLastDossierStatusHint() {
  const tAccount = useTranslations("account.lastDossierStatus");

  return (status: string | null): string | null => {
    if (!status) return null;
    if (["completed", "partially_collected", "fully_collected"].includes(status)) {
      return tAccount("closed");
    }
    if (status === "submitted") return tAccount("submitted");
    if (status === "cancelled") return tAccount("cancelled");
    if (status === "expired") return tAccount("expired");
    if (status === "abandoned") return tAccount("abandoned");
    if (tAccount.has(status)) return tAccount(status);
    return null;
  };
}
