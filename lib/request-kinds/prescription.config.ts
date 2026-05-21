import type { RequestKindConfig } from "@/lib/request-kinds/types";
import { PRESCRIPTION_ORDONNANCE_SOURCING_LABEL } from "@/lib/prescription-pharmacist-lines";

function prescriptionHeaderShellForStatus(status: string): string {
  const base = "mt-2 rounded-xl border-2 px-2.5 py-1.5 shadow-sm sm:px-3";
  if (["submitted", "in_review"].includes(status)) {
    return `${base} border-amber-400/50 bg-gradient-to-br from-amber-500/14 via-white to-orange-50/30 ring-1 ring-amber-300/45`;
  }
  if (status === "responded") {
    return `${base} border-amber-400/55 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/28 ring-1 ring-amber-200/55`;
  }
  if (["confirmed", "treated", "completed", "partially_collected", "fully_collected"].includes(status)) {
    return `${base} border-amber-300/55 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/25 ring-1 ring-amber-200/50`;
  }
  return `${base} border-amber-300/45 bg-gradient-to-b from-white to-amber-50/35 ring-1 ring-amber-200/45`;
}

export const prescriptionRequestKindConfig: RequestKindConfig = {
  id: "prescription",
  publicRefPrefix: "O",
  routes: {
    patientHubPath: "/dashboard/patient/ordonnances",
    pharmacistHubPath: "/dashboard/pharmacien/ordonnances",
    patientListPath: "/dashboard/patient/ordonnances",
    pharmacistListPath: "/dashboard/pharmacien/ordonnances",
    patientCreatePath: "/pharmacie/[id]/demande-ordonnance",
  },
  theme: {
    accent: "amber",
    headerLabelShort: "Ordonnance",
    patientBackLinkClass: "text-amber-900",
    pharmacistBackLinkClass: "text-amber-900",
    headerShellDefault:
      "mt-2 rounded-xl border-2 border-amber-300/50 bg-gradient-to-br from-amber-50/90 via-white to-orange-50/20 px-2.5 py-1.5 shadow-md shadow-amber-900/[0.06] ring-1 ring-amber-200/55 sm:px-3",
    headerShellForStatus: prescriptionHeaderShellForStatus,
  },
  capabilities: {
    workflowEnabled: true,
    patientCreatesItems: false,
    pharmacistCreatesItemsOnRespond: true,
    maxPrescriptionPages: 2,
    hasProductCatalogue: false,
  },
  copy: {
    labelFr: "Ordonnance",
    patientHubTitle: "Mes ordonnances",
    pharmacistHubTitle: "Ordonnances",
    patientNotEnabledMessage: "",
    pharmacistNotEnabledMessage: "",
    workflow: {
      pharmacistOrdonnanceLineBadge: "Ordonnance",
      pharmacistProposedBadge: "Proposé",
      patientProposedBadge: "Ordonnance",
      pharmacistProposeSectionTitle: "Produit ordonnance",
      pharmacistProposeSectionSubtitle: "Catalogue ci-dessous.",
      pharmacistProposeDefaultReason: "",
      pharmacistEmptyLinesHint: "Scan : + pour chaque produit, puis publier.",
      pharmacistPublishNeedLinesError:
        "Ajoutez au moins un produit ordonnance avant de publier la réponse.",
      pharmacistLinesSectionTitle: "Produits ordonnance",
      patientArchiveEmptyLines: "Aucun produit saisi sur cette ordonnance.",
      patientArchiveClosedFooter:
        "L’ordonnance est close. Les produits saisis et le scan restent consultables ci-dessous.",
      timelinePharmacistProposedOrigin: "Produit proposé par la pharmacie",
      patientLineOriginLabel: PRESCRIPTION_ORDONNANCE_SOURCING_LABEL,
      patientSuiviProposedHint: "Produit saisi par la pharmacie depuis votre ordonnance.",
      patientSummaryKindLabel: "Ordonnance",
      patientSummaryRefShort: "Ord.",
      patientProductsSectionTitle: "Produits ordonnance",
      patientWaitingSubmittedHint: "Ordonnance transmise — saisie et réponse par l’officine.",
      patientWaitingInReviewHint: "Saisie en cours — notification à la publication.",
      patientCancelWhileWaitingLabel: "Annuler l’ordonnance",
    },
  },
};
