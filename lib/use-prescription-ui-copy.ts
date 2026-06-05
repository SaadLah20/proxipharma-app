"use client";

import { useTranslations } from "next-intl";
import { isConsultationRequestType } from "@/lib/consultation-ui-copy";
import {
  isPrescriptionRequestType,
  type PrescriptionUiCopy,
} from "@/lib/prescription-ui-copy";

export function usePrescriptionUiCopy(): PrescriptionUiCopy {
  const tPrescription = useTranslations("prescription");
  const tConsultation = useTranslations("consultation");

  return {
    principalTab: tPrescription("principalTab"),
    principalBadge: tPrescription("principalBadge"),
    qtyPrescribed: tPrescription("qtyPrescribed"),
    qtyPrescribedShort: tPrescription("qtyPrescribedShort"),
    pharmacyProposedProduct: tPrescription("pharmacyProposedProduct"),
    prepPrescription: tPrescription("prepPrescription"),
    prepPharmacy: tPrescription("prepPharmacy"),
    scanSent: tPrescription("scanSent"),
    respondedPrincipalTabLabel(requestType) {
      if (isConsultationRequestType(requestType)) return tConsultation("respondedTabConsultation");
      if (isPrescriptionRequestType(requestType)) return tPrescription("respondedTabPrescription");
      return tPrescription("respondedTabProduct");
    },
    respondedRequestedQtyLabel(requestType) {
      if (isConsultationRequestType(requestType)) return tConsultation("qtyProposed");
      if (isPrescriptionRequestType(requestType)) return tPrescription("qtyPrescribed");
      return tPrescription("respondedQtyProduct");
    },
    validatedOriginFallbackPatient(requestType) {
      if (isConsultationRequestType(requestType)) return "";
      if (isPrescriptionRequestType(requestType)) return tPrescription("validatedOriginPrescription");
      return tPrescription("validatedOriginProduct");
    },
    archiveClosedQtyLabel(requestType) {
      if (isConsultationRequestType(requestType)) return tConsultation("qtyRetained");
      if (isPrescriptionRequestType(requestType)) return tPrescription("archiveQtyPrescription");
      return tPrescription("archiveQtyProduct");
    },
  };
}
