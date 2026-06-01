import type { RequestKindConfig } from "@/lib/request-kinds/types";
import { uiHeaderShell } from "@/lib/ui-surfaces";

export const productRequestKindConfig: RequestKindConfig = {
  id: "product_request",
  publicRefPrefix: "D",
  routes: {
    patientHubPath: "/dashboard/demandes",
    pharmacistHubPath: "/dashboard/pharmacien/demandes",
    patientListPath: "/dashboard/demandes",
    pharmacistListPath: "/dashboard/pharmacien/demandes",
    patientCreatePath: null,
  },
  theme: {
    accent: "sky",
    headerLabelShort: "Demande prod.",
    patientBackLinkClass: "text-foreground",
    pharmacistBackLinkClass: "text-foreground",
    headerShellDefault: uiHeaderShell,
    headerShellForStatus: () => uiHeaderShell,
  },
  capabilities: {
    workflowEnabled: true,
    patientCreatesItems: true,
    pharmacistCreatesItemsOnRespond: false,
    maxPrescriptionPages: null,
    hasProductCatalogue: true,
  },
  copy: {
    labelFr: "Demande de produits",
    patientHubTitle: "Mes demandes de produits",
    pharmacistHubTitle: "Demandes de produits",
    patientNotEnabledMessage: "",
    pharmacistNotEnabledMessage: "",
    workflow: {
      pharmacistProposedBadge: "Ajout officine",
      patientProposedBadge: "Ajout officine",
      pharmacistProposeSectionTitle: "Proposer un produit",
      pharmacistProposeSectionSubtitle: "Une ligne après la liste — motif et catalogue ci-dessous.",
      pharmacistProposeDefaultReason: "",
      pharmacistEmptyLinesHint: "Aucune ligne produit.",
      pharmacistPublishNeedLinesError: "Aucune ligne produit à renseigner.",
      pharmacistLinesSectionTitle: "Produits",
      patientArchiveEmptyLines: "Aucune ligne pour cette demande.",
      patientArchiveClosedFooter:
        "Le dossier est clos côté officine. Les montants et libellés reflètent l’état au moment de la clôture.",
      timelinePharmacistProposedOrigin: "Produit proposé par la pharmacie",
      patientSuiviProposedHint: "Proposition par la pharmacie (ajout officine).",
      patientSummaryKindLabel: "Demande de produits",
      patientSummaryRefShort: "Dem.",
      patientProductsSectionTitle: "Produits",
      patientWaitingSubmittedHint: "En file d’attente — réponse dès traitement par l’officine.",
      patientWaitingInReviewHint: "Examen en cours — notification à la publication.",
      patientCancelWhileWaitingLabel: "Annuler la demande",
    },
  },
};
