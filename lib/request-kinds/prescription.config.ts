import type { RequestKindConfig } from "@/lib/request-kinds/types";

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
      pharmacistProposedBadge: "Ordonnance",
      patientProposedBadge: "Ordonnance",
      pharmacistProposeSectionTitle: "Produit ordonnance",
      pharmacistProposeSectionSubtitle: "Saisie depuis le scan — catalogue ci-dessous.",
      pharmacistProposeDefaultReason: "Saisie depuis ordonnance",
      pharmacistEmptyLinesHint:
        "Ouvrez l’ordonnance (agrandir), utilisez le bouton + pour saisir chaque produit. Ils apparaissent dans « Produits ordonnance » ci-dessous.",
      pharmacistPublishNeedLinesError:
        "Ajoutez au moins un produit ordonnance avant de publier la réponse.",
      pharmacistLinesSectionTitle: "Produits ordonnance",
      patientArchiveEmptyLines: "Aucun produit saisi sur cette ordonnance.",
      patientArchiveClosedFooter:
        "L’ordonnance est close. Les produits saisis et le scan restent consultables ci-dessous.",
      timelinePharmacistProposedOrigin: "Produit saisi depuis l’ordonnance",
      patientSuiviProposedHint: "Produit saisi par la pharmacie depuis votre ordonnance.",
      patientSummaryKindLabel: "Ordonnance",
      patientSummaryRefShort: "Ord.",
      patientProductsSectionTitle: "Produits ordonnance",
      patientWaitingSubmittedHint:
        "Votre ordonnance est transmise : la pharmacie la lit et saisira les produits. Vous serez notifié dès que la réponse sera publiée.",
      patientWaitingInReviewHint:
        "Un pharmacien examine votre ordonnance et saisit les produits. Vous serez averti dès que la réponse sera prête.",
      patientCancelWhileWaitingLabel: "Annuler l’ordonnance",
    },
  },
};
