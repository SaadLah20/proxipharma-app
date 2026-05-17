import type { RequestKindConfig } from "@/lib/request-kinds/types";

export const consultationRequestKindConfig: RequestKindConfig = {
  id: "free_consultation",
  publicRefPrefix: "C",
  routes: {
    patientHubPath: "/dashboard/patient/consultations-libres",
    pharmacistHubPath: "/dashboard/pharmacien/consultations-libres",
    patientListPath: "/dashboard/patient/consultations-libres",
    pharmacistListPath: "/dashboard/pharmacien/consultations-libres",
    patientCreatePath: null,
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
    workflowEnabled: false,
    patientCreatesItems: false,
    pharmacistCreatesItemsOnRespond: true,
    maxPrescriptionPages: null,
    hasProductCatalogue: false,
  },
  copy: {
    labelFr: "Consultation libre",
    patientHubTitle: "Mes consultations libres",
    pharmacistHubTitle: "Consultations libres",
    patientNotEnabledMessage:
      "Le suivi détaillé des consultations libres arrive bientôt. Vous pouvez consulter l’historique du dossier ci-dessous.",
    pharmacistNotEnabledMessage:
      "Le traitement des consultations libres dans cet écran arrive bientôt.",
    workflow: {
      pharmacistProposedBadge: "Ajout officine",
      patientProposedBadge: "Ajout officine",
      pharmacistProposeSectionTitle: "Proposer un produit",
      pharmacistProposeSectionSubtitle: "Une ligne après la liste — motif et catalogue ci-dessous.",
      pharmacistProposeDefaultReason: "",
      pharmacistEmptyLinesHint: "Aucune ligne.",
      pharmacistPublishNeedLinesError: "Aucune ligne à renseigner.",
      pharmacistLinesSectionTitle: "Produits",
      patientArchiveEmptyLines: "Aucune ligne pour ce dossier.",
      patientArchiveClosedFooter: "Ce dossier est clos.",
      timelinePharmacistProposedOrigin: "Proposition par la pharmacie",
      patientSuiviProposedHint: "Proposition par la pharmacie.",
      patientSummaryKindLabel: "Consultation libre",
      patientSummaryRefShort: "Cons.",
      patientProductsSectionTitle: "Produits",
      patientWaitingSubmittedHint: "Demande en attente.",
      patientWaitingInReviewHint: "Examen en cours.",
      patientCancelWhileWaitingLabel: "Annuler",
    },
  },
};
