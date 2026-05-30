import type { RequestKindConfig } from "@/lib/request-kinds/types";
import { PRESCRIPTION_ORDONNANCE_SOURCING_LABEL } from "@/lib/prescription-pharmacist-lines";
import { neutralHeaderShell, neutralHeaderShellForStatus } from "@/lib/design-system/request-kind-accent";

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
    patientBackLinkClass: "text-primary font-medium underline underline-offset-2",
    pharmacistBackLinkClass: "text-primary font-medium underline underline-offset-2",
    headerShellDefault: neutralHeaderShell,
    headerShellForStatus: neutralHeaderShellForStatus,
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
