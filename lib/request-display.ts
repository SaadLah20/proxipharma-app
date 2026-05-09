/** Libellés demandés côté métier (patient & pharmacien). */
export const requestStatusFr: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Envoyée",
  in_review: "En cours de traitement",
  responded: "Répondue - à valider",
  confirmed: "Validée",
  processing: "En préparation officine",
  treated: "Traitée",
  in_progress_virtual: "En préparation",
  completed: "Clôturée",
  cancelled: "Annulée",
  abandoned: "Abandonnée",
  expired: "Expirée",
  partially_collected: "Clôturée",
  fully_collected: "Clôturée",
};

/** Libellé court pour badges (même vocabulaire, `in_review` = envoyée). */
export function requestStatusShortFr(status: string): string {
  return requestStatusFr[status] ?? status;
}

/** Côté officine : `confirmed` = validé par le patient ; l’étape « en préparation » peut être virtuelle ou réelle (`processing`). */
export function requestStatusShortFrPharmacien(status: string): string {
  if (status === "confirmed") return "Validée client";
  if (status === "responded") return "Répondue - attente client";
  return requestStatusShortFr(status);
}

/** Regroupe les demandes dans l’écran patient « Tableau de bord ». */
export const patientDashboardSections: {
  id: string;
  title: string;
  description: string;
  statuses: readonly string[];
}[] = [
  {
    id: "at_pharmacy",
    title: "Chez la pharmacie",
    description: "Envoyée, en traitement par l’officine.",
    statuses: ["submitted", "in_review"],
  },
  {
    id: "response_waiting",
    title: "À confirmer",
    description: "Réponse de l’officine à confirmer ou à refuser avant expiration (24 h).",
    statuses: ["responded"],
  },
  {
    id: "confirmed",
    title: "Confirmée",
    description: "Tu as validé ; la pharmacie n’a pas encore enregistré l’entrée officine préparation.",
    statuses: ["confirmed"],
  },
  {
    id: "supply_processing",
    title: "En préparation",
    description: "La pharmacie met à jour la commande après ta validation.",
    statuses: ["processing", "in_progress_virtual"],
  },
  {
    id: "treated_pickup",
    title: "Traitée · retrait",
    description: "Préparation déclarée ; suivi récupération des produits au comptoir.",
    statuses: ["treated"],
  },
  {
    id: "done",
    title: "Terminée",
    description: "Dossier clôturé côté pharmacie.",
    statuses: ["completed", "partially_collected", "fully_collected"],
  },
  {
    id: "closed_cancelled",
    title: "Annulées",
    description: "Annulées avant ou après la réponse de la pharmacie.",
    statuses: ["cancelled", "draft"],
  },
  {
    id: "closed_abandoned",
    title: "Abandonnées",
    description: "Annulées après validation, sans récupération de produit.",
    statuses: ["abandoned"],
  },
  {
    id: "closed_expired",
    title: "Expirées",
    description: "Sans réponse de ta part dans les 24 h après la réponse pharmacien.",
    statuses: ["expired"],
  },
];

/** Regroupe les demandes dans l’écran pharmacien « Tableau de bord ». */
export const pharmacistDashboardSections: {
  id: string;
  title: string;
  description: string;
  statuses: readonly string[];
}[] = [
  {
    id: "to_process",
    title: "À traiter",
    description: "Nouvelles demandes ou en cours de préparation.",
    statuses: ["submitted", "in_review"],
  },
  {
    id: "wait_patient",
    title: "En attente du client",
    description: "Réponse envoyée ; votre client doit confirmer.",
    statuses: ["responded"],
  },
  {
    id: "confirmed",
    title: "Validée client",
    description: "Aucune saisie « réservé / commandé » ou dossier officine pas encore entré en préparation.",
    statuses: ["confirmed"],
  },
  {
    id: "supply_processing_ph",
    title: "Préparation",
    description: "Réservations / commandes ou ajustements en cours après validation.",
    statuses: ["processing", "in_progress_virtual"],
  },
  {
    id: "treated_pickup_ph",
    title: "Traitée · comptoir",
    description: "Préparation déclarée ; retrait ligne par ligne au comptoir.",
    statuses: ["treated"],
  },
  {
    id: "done",
    title: "Terminée",
    description: "Dossier clôturé.",
    statuses: ["completed", "partially_collected", "fully_collected"],
  },
  {
    id: "closed_cancelled",
    title: "Annulées",
    description: "Annulées par le client (avant ou après réponse).",
    statuses: ["cancelled", "draft"],
  },
  {
    id: "closed_abandoned",
    title: "Abandonnées",
    description: "Validées puis annulées sans récupération.",
    statuses: ["abandoned"],
  },
  {
    id: "closed_expired",
    title: "Expirées",
    description: "Sans action du client dans les 24 h après votre réponse.",
    statuses: ["expired"],
  },
];

const PATIENT_CLOSED_STATUSES = new Set([
  "cancelled",
  "abandoned",
  "expired",
  "completed",
  "partially_collected",
  "fully_collected",
  "draft",
]);

/** Détail patient : aucun bloc d’action (formulaire confirmation, etc.). */
export function patientRequestHasNoActions(status: string): boolean {
  return PATIENT_CLOSED_STATUSES.has(status);
}

const PHARMACIST_HARD_STOP_STATUSES = new Set(["cancelled", "abandoned", "expired"]);

export function pharmacistRequestIsHardStopped(status: string): boolean {
  return PHARMACIST_HARD_STOP_STATUSES.has(status);
}

export function pharmacistRequestIsClosedSuccess(status: string): boolean {
  return status === "completed" || status === "partially_collected" || status === "fully_collected";
}

/** Badge visuel par statut (couleurs type produit). */
export function requestStatusBadgeClass(status: string): string {
  switch (status) {
    case "submitted":
    case "in_review":
      return "bg-sky-100 text-sky-950 ring-1 ring-sky-200/80";
    case "responded":
      return "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80";
    case "confirmed":
      return "bg-violet-100 text-violet-950 ring-1 ring-violet-200/80";
    case "processing":
      return "bg-indigo-100 text-indigo-950 ring-1 ring-indigo-200/80";
    case "treated":
      return "bg-cyan-100 text-cyan-950 ring-1 ring-cyan-200/80";
    case "in_progress_virtual":
      return "bg-indigo-100 text-indigo-950 ring-1 ring-indigo-200/80";
    case "completed":
    case "partially_collected":
    case "fully_collected":
      return "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200/80";
    case "cancelled":
    case "abandoned":
    case "expired":
      return "bg-slate-200 text-slate-800 ring-1 ring-slate-300/90";
    case "draft":
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
    default:
      return "bg-gray-100 text-gray-800 ring-1 ring-gray-200";
  }
}

export const requestTypeFr: Record<string, string> = {
  prescription: "Ordonnance",
  product_request: "Demande",
  free_consultation: "Consultation libre",
};

/** Q20 — origine de la ligne produit sur la demande. */
export const requestItemLineSourceFr: Record<string, string> = {
  patient_request: "Demandé par vous",
  pharmacist_proposed: "Proposé par la pharmacie",
};

export function formatShortId(id: string) {
  return id.replace(/-/g, "").slice(0, 8);
}

export const availabilityStatusFr: Record<string, string> = {
  available: "Disponible",
  partially_available: "Partiellement disponible",
  unavailable: "Indisponible",
  to_order: "À commander",
  market_shortage: "Rupture du marché",
};

export const counterOutcomeFr: Record<string, string> = {
  unset: "Pas encore récupéré",
  picked_up: "Récupéré",
  cancelled_at_counter: "Annulé",
  deferred_next_visit: "À récupérer plus tard",
};

/** Libellé patient selon la raison d'annulation (si counter_outcome = cancelled_at_counter). */
export function counterOutcomePatientLabel(
  outcome: string,
  cancelReason: string | null | undefined
): string {
  if (outcome !== "cancelled_at_counter") return counterOutcomeFr[outcome] ?? outcome;
  if (cancelReason === "client_request") return "Annulé à votre demande";
  if (cancelReason === "pharmacy_unable") return "Annulé par la pharmacie";
  return "Annulé";
}

/**
 * Devine l'auteur d'un événement historique à partir du champ `reason`.
 * Les conventions de prefix sont stables côté SQL : `patient_*` = patient,
 * `pharmacist_*` / `pharma_*` / `counter_*` / `publication_*` = pharmacie,
 * `auto_*` / `data_migration_*` / null = système / batch.
 */
export function historyActorLabel(role: "patient" | "pharmacien", reason: string | null | undefined): string {
  const r = (reason ?? "").trim();
  const isPatient =
    r.startsWith("patient_") ||
    r.startsWith("audit_v1:patient_");
  const isPharmacy =
    r.startsWith("pharmacist_") ||
    r.startsWith("pharmacy_") ||
    r.startsWith("pharma_") ||
    r.startsWith("counter_") ||
    r.startsWith("publication_") ||
    r.startsWith("audit_v1:pharma_");
  const isSystem =
    r.startsWith("auto_") ||
    r.startsWith("data_migration") ||
    r === "request_created_with_status" ||
    r === "" ||
    r === "pharmacien_ui";
  if (role === "patient") {
    if (isPatient) return "Vous";
    if (isPharmacy) return "La pharmacie";
    if (isSystem) return "Système";
    return "—";
  }
  if (isPatient) return "Le patient";
  if (isPharmacy) return "Vous (pharmacie)";
  if (isSystem) return "Système";
  return "—";
}
