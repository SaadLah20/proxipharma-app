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
      pharmacistProposedBadge: "Saisi ordonnance",
      patientProposedBadge: "Saisi ordonnance",
      pharmacistProposeSectionTitle: "Produit de l’ordonnance",
      pharmacistProposeSectionSubtitle: "Saisie depuis le scan — motif et catalogue ci-dessous.",
      pharmacistProposeDefaultReason: "Saisie depuis ordonnance",
      pharmacistEmptyLinesHint:
        "Saisissez les produits lus sur l’ordonnance (section « Produit de l’ordonnance »), puis publiez la réponse.",
      pharmacistPublishNeedLinesError:
        "Ajoutez au moins un produit lu sur l’ordonnance (section « Produit de l’ordonnance »).",
      pharmacistLinesSectionTitle: "Produits de l’ordonnance",
      patientArchiveEmptyLines: "Aucun produit n’a été saisi sur cette ordonnance.",
      patientArchiveClosedFooter:
        "L’ordonnance est close. Les produits saisis par la pharmacie et le scan restent consultables ci-dessous.",
      timelinePharmacistProposedOrigin: "Produit saisi depuis l’ordonnance",
      patientSuiviProposedHint: "Produit saisi par la pharmacie depuis votre ordonnance.",
    },
  },
};
