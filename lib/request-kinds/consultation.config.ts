import type { RequestKindConfig } from "@/lib/request-kinds/types";

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
    patientBackLinkClass: "text-violet-900",
    pharmacistBackLinkClass: "text-violet-900",
    headerShellDefault:
      "mt-2 rounded-xl border-2 border-violet-300/45 bg-gradient-to-br from-violet-50/90 via-white to-fuchsia-50/20 px-2.5 py-1.5 shadow-md shadow-violet-900/[0.06] ring-1 ring-violet-200/55 sm:px-3",
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
