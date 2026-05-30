import type { RequestKindConfig } from "@/lib/request-kinds/types";
import { neutralHeaderShell } from "@/lib/design-system/request-kind-accent";

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
    patientBackLinkClass: "text-primary font-medium underline underline-offset-2",
    pharmacistBackLinkClass: "text-primary font-medium underline underline-offset-2",
    headerShellDefault: neutralHeaderShell,
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
      pharmacistProposedBadge: "Proposé",
      patientProposedBadge: "Proposé par la pharmacie",
      pharmacistProposeSectionTitle: "Saisir les produits proposés",
      pharmacistProposeSectionSubtitle: "Catalogue · dispo · publier.",
      pharmacistProposeDefaultReason: "Proposition suite à consultation",
      pharmacistEmptyLinesHint: "Saisir les produits puis publier.",
      pharmacistPublishNeedLinesError: "Ajoutez au moins un produit avant de publier la réponse.",
      pharmacistLinesSectionTitle: "Produits proposés",
      patientArchiveEmptyLines: "Aucun produit n’a été proposé sur cette consultation.",
      patientArchiveClosedFooter:
        "La consultation est close. Votre message, les photos et les produits proposés restent consultables ci-dessous.",
      timelinePharmacistProposedOrigin: "Produit proposé après consultation",
      patientSuiviProposedHint: "Produit proposé par la pharmacie suite à votre consultation.",
      patientSummaryKindLabel: "Consultation libre",
      patientSummaryRefShort: "Cons.",
      patientProductsSectionTitle: "Produits proposés",
      patientWaitingSubmittedHint: "Message transmis — échange ou produits via l’officine.",
      patientWaitingInReviewHint: "Examen en cours — notification à la publication.",
      patientCancelWhileWaitingLabel: "Annuler la consultation",
    },
  },
};
