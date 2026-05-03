export const requestStatusFr: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Envoyée",
  in_review: "En traitement",
  responded: "Réponse reçue",
  confirmed: "Confirmée par toi",
  completed: "Terminée",
  cancelled: "Annulée",
  abandoned: "Abandonnée",
  expired: "Expirée",
  partially_collected: "Retrait (ancien)",
  fully_collected: "Retrait (ancien)",
};

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
    title: "Réponse reçue",
    description: "Le pharmacien a répondu — action de ta part.",
    statuses: ["responded"],
  },
  {
    id: "confirmed",
    title: "Confirmée",
    description: "Tu as validé ; passage ou retrait à prévoir.",
    statuses: ["confirmed"],
  },
  {
    id: "done",
    title: "Terminée",
    description: "Dossier clôturé côté pharmacie.",
    statuses: ["completed", "partially_collected", "fully_collected"],
  },
  {
    id: "closed",
    title: "Sans suite",
    description: "Brouillon, annulée, expirée ou abandonnée.",
    statuses: ["draft", "cancelled", "abandoned", "expired"],
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
    title: "En attente du patient",
    description: "Réponse envoyée ; le patient doit confirmer.",
    statuses: ["responded"],
  },
  {
    id: "confirmed",
    title: "Confirmée par le patient",
    description: "Préparation / comptoir.",
    statuses: ["confirmed"],
  },
  {
    id: "done",
    title: "Terminée",
    description: "Dossier clôturé.",
    statuses: ["completed", "partially_collected", "fully_collected"],
  },
  {
    id: "closed",
    title: "Sans suite",
    description: "Non poursuivie ou expirée.",
    statuses: ["draft", "cancelled", "abandoned", "expired"],
  },
];

const PATIENT_CLOSED_STATUSES = new Set(["cancelled", "abandoned", "expired", "completed", "partially_collected", "fully_collected", "draft"]);

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
  product_request: "Produits",
  free_consultation: "Consultation libre",
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
  unset: "Pas encore vu au comptoir",
  picked_up: "Récupéré",
  cancelled_at_counter: "Non récupéré / annulé",
  deferred_next_visit: "À récupérer plus tard",
};
