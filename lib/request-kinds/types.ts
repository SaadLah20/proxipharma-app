/** Types de demande alignés sur `public.request_type_enum`. */
export type RequestKindId = "product_request" | "prescription" | "free_consultation";

export type RequestKindAccent = "sky" | "amber" | "violet";

export type RequestKindRoutes = {
  patientHubPath: string;
  pharmacistHubPath: string;
  patientListPath: string;
  pharmacistListPath: string;
  patientCreatePath: string | null;
};

export type RequestKindTheme = {
  accent: RequestKindAccent;
  /** Libellé court dans le bandeau (ex. « Demande prod. »). */
  headerLabelShort: string;
  patientBackLinkClass: string;
  pharmacistBackLinkClass: string;
  /** Classes Tailwind du bandeau par défaut (hors statut dynamique produit pharma). */
  headerShellDefault: string;
  /**
   * Coquille du bandeau selon le statut (produits pharmacien).
   * Si absent, `headerShellDefault` est utilisé.
   */
  headerShellForStatus?: (status: string) => string;
};

export type RequestKindCapabilities = {
  /** Workflow détail patient/pharmacien activé pour ce type. */
  workflowEnabled: boolean;
  patientCreatesItems: boolean;
  pharmacistCreatesItemsOnRespond: boolean;
  maxPrescriptionPages: number | null;
  hasProductCatalogue: boolean;
};

/** Libellés workflow lignes produit (demande produits vs ordonnance). */
export type RequestKindWorkflowCopy = {
  /** Badge ligne principale ordonnance (saisie scan), distinct de « ajout officine » produit. */
  pharmacistOrdonnanceLineBadge?: string;
  pharmacistProposedBadge: string;
  patientProposedBadge: string;
  pharmacistProposeSectionTitle: string;
  pharmacistProposeSectionSubtitle: string;
  pharmacistProposeDefaultReason: string;
  pharmacistEmptyLinesHint: string;
  pharmacistPublishNeedLinesError: string;
  pharmacistLinesSectionTitle: string;
  patientArchiveEmptyLines: string;
  patientArchiveClosedFooter: string;
  timelinePharmacistProposedOrigin: string;
  patientSuiviProposedHint: string;
  /** Bandeau récap patient (ex. « Ordonnance », « Demande de produits »). */
  patientSummaryKindLabel: string;
  /** Préfixe court réf. dans le bandeau (ex. « Ord. », « Dem. »). */
  patientSummaryRefShort: string;
  patientProductsSectionTitle: string;
  patientWaitingSubmittedHint: string;
  patientWaitingInReviewHint: string;
  patientCancelWhileWaitingLabel: string;
};

export type RequestKindCopy = {
  labelFr: string;
  patientHubTitle: string;
  pharmacistHubTitle: string;
  patientNotEnabledMessage: string;
  pharmacistNotEnabledMessage: string;
  workflow: RequestKindWorkflowCopy;
};

export type RequestKindConfig = {
  id: RequestKindId;
  publicRefPrefix: "D" | "O" | "C";
  routes: RequestKindRoutes;
  theme: RequestKindTheme;
  capabilities: RequestKindCapabilities;
  copy: RequestKindCopy;
};
