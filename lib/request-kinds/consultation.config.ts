import type { RequestKindConfig } from "@/lib/request-kinds/types";
import { uiHeaderShell } from "@/lib/ui-surfaces";

export const consultationRequestKindConfig: RequestKindConfig = {
  id: "free_consultation",
  publicRefPrefix: "C",
  routes: {
    patientHubPath: "/dashboard/patient/consultations-libres",
    pharmacistHubPath: "/dashboard/pharmacien/consultations-libres",
    patientListPath: "/dashboard/patient/consultations-libres",
    pharmacistListPath: "/dashboard/pharmacien/consultations-libres",
    patientCreatePath: "/pharmacie/[id]/consultation-libre",
  },
  theme: {
    accent: "violet",
    headerLabelShort: "Consultation",
    patientBackLinkClass: "text-foreground",
    pharmacistBackLinkClass: "text-foreground",
    headerShellDefault: uiHeaderShell,
  },
  capabilities: {
    workflowEnabled: true,
    patientCreatesItems: false,
    pharmacistCreatesItemsOnRespond: true,
    maxPrescriptionPages: null,
    hasProductCatalogue: true,
  },
  copy: {
    labelFr: "Consultation libre",
    patientHubTitle: "Mes consultations libres",
    pharmacistHubTitle: "Consultations libres",
    patientNotEnabledMessage: "",
    pharmacistNotEnabledMessage: "",
    workflow: {
      pharmacistProposedBadge: "Produit",
      patientProposedBadge: "",
      pharmacistProposeSectionTitle: "Ajouter des produits",
      pharmacistProposeSectionSubtitle: "Catalogue · disponibilité · publier au patient.",
      pharmacistProposeDefaultReason: "",
      pharmacistEmptyLinesHint: "Ajoutez des produits puis publiez la réponse.",
      pharmacistPublishNeedLinesError: "Ajoutez au moins un produit avant de publier la réponse.",
      pharmacistLinesSectionTitle: "Produits",
      patientArchiveEmptyLines: "Aucun produit sur cette consultation.",
      patientArchiveClosedFooter:
        "La consultation est close. Votre message, les photos et les produits restent consultables ci-dessous.",
      timelinePharmacistProposedOrigin: "Produit ajouté après consultation",
      patientSuiviProposedHint: "",
      patientSummaryKindLabel: "Consultation libre",
      patientSummaryRefShort: "Cons.",
      patientProductsSectionTitle: "Produits",
      patientWaitingSubmittedHint: "Message transmis — échange ou produits via l’officine.",
      patientWaitingInReviewHint: "Examen en cours — notification à la publication.",
      patientCancelWhileWaitingLabel: "Annuler la consultation",
    },
  },
};
