"use client";

import { useTranslations } from "next-intl";
import { isConsultationRequestType } from "@/lib/consultation-ui-copy";

export function useConsultationUiCopy() {
  const t = useTranslations("consultation");

  return {
    qtyProposed: t("qtyProposed"),
    qtyProposedShort: t("qtyProposedShort"),
    qtyRetained: t("qtyRetained"),
    respondedTabPrincipal: t("respondedTabPrincipal"),
    consultationSent: t("consultationSent"),
    consultation: t("consultation"),
    respondedPrincipalTabLabelConsultation(requestType: string | null | undefined): string {
      return isConsultationRequestType(requestType) ? t("respondedTabPrincipal") : "";
    },
    proposedQtyLabel: t("qtyProposed"),
    retainedQtyLabel: t("qtyRetained"),
  };
}
