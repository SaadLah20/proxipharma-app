import { useTranslations } from "next-intl";
import { useConsultationUiCopy } from "@/lib/use-consultation-ui-copy";

/** Libellé court lignes / scan pour récap dossier patient. */
export function usePatientLineCountLabel() {
  const tHub = useTranslations("hub.listChrome");
  const consultationCopy = useConsultationUiCopy();

  return (requestType: string, status: string, lineCount: number): string => {
    if (requestType === "prescription" && ["submitted", "in_review"].includes(status)) {
      return tHub("scanSent");
    }
    if (requestType === "prescription" && lineCount > 0) {
      return tHub("productsEntered", { count: lineCount });
    }
    if (requestType === "free_consultation") {
      if (["submitted", "in_review"].includes(status)) return consultationCopy.consultationSent;
      if (lineCount > 0) return tHub("productsProposed", { count: lineCount });
      return consultationCopy.consultation;
    }
    return tHub("lines", { count: lineCount });
  };
}
