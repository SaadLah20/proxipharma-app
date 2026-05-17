import type { RequestKindConfig } from "@/lib/request-kinds/types";

function productHeaderShellForStatus(status: string): string {
  const base = "mt-2 rounded-xl border-2 px-2.5 py-1.5 shadow-sm sm:px-3";
  if (["submitted", "in_review"].includes(status)) {
    return `${base} border-sky-400/40 bg-gradient-to-br from-sky-500/12 via-white to-teal-50/25 ring-1 ring-sky-300/35`;
  }
  if (status === "responded") {
    return `${base} border-amber-400/45 bg-gradient-to-br from-amber-50/55 via-white to-orange-50/25 ring-1 ring-amber-200/50`;
  }
  if (["confirmed", "treated", "completed", "partially_collected", "fully_collected"].includes(status)) {
    return `${base} border-teal-300/50 bg-gradient-to-br from-emerald-50/45 via-white to-teal-50/30 ring-1 ring-teal-200/45`;
  }
  return `${base} border-slate-300/45 bg-gradient-to-b from-white to-slate-50/50 ring-1 ring-slate-200/50`;
}

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
    patientBackLinkClass: "text-sky-800",
    pharmacistBackLinkClass: "text-sky-800",
    headerShellDefault:
      "mt-2 rounded-xl border-2 border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 px-2.5 py-1.5 shadow-md shadow-sky-900/[0.06] ring-1 ring-sky-200/55 sm:px-3",
    headerShellForStatus: productHeaderShellForStatus,
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
      patientWaitingSubmittedHint:
        "Votre liste est en file d’attente : un pharmacien la traitera et vous répondra avec les disponibilités et les éventuelles alternatives.",
      patientWaitingInReviewHint:
        "Un pharmacien examine votre liste. Vous serez averti dès que la réponse (disponibilités, alternatives le cas échéant) sera prête.",
      patientCancelWhileWaitingLabel: "Annuler la demande",
    },
  },
};
