/** Libellés demandés côté métier (patient & pharmacien). */
export const requestStatusFr: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Envoyée",
  in_review: "En cours de traitement",
  responded: "Répondue - à valider",
  confirmed: "Validée",
  /** @deprecated Ancien statut DB ; conservé pour l’historique. */
  processing: "En préparation officine (historique)",
  treated: "Traitée",
  in_progress_virtual: "Suivi résa. / commande (affichage historique)",
  completed: "Clôturée",
  cancelled: "Annulée",
  abandoned: "Abandonnée",
  expired: "Expirée",
  partially_collected: "Clôturée",
  fully_collected: "Clôturée",
};

/** Titre lisible pour une ligne d’historique dossier (patient). */
export function requestHistoryPatientHeadline(oldStatus: string | null, newStatus: string): string {
  const o = oldStatus;
  const n = newStatus;
  if (!o) {
    if (n === "submitted") return "Demande envoyée à la pharmacie.";
    if (n === "in_review") return "La pharmacie traite votre demande.";
    return `Étape enregistrée : ${requestStatusFr[n] ?? n}.`;
  }
  if (o === "submitted" && n === "in_review") return "La pharmacie ouvre le dossier.";
  if (o === "in_review" && n === "responded") return "La pharmacie a répondu : à valider de votre côté.";
  if (o === "responded" && n === "confirmed") return "Vous avez validé la proposition et votre passage.";
  if (o === "responded" && n === "expired") return "Délai dépassé sans validation de votre part.";
  if (o === "responded" && n === "abandoned") return "Vous avez abandonné cette demande.";
  if (o === "confirmed" && n === "treated") return "La pharmacie a terminé la préparation ; passage au comptoir possible.";
  if (o === "confirmed" && n === "processing") return "La pharmacie suit la préparation (étape intermédiaire).";
  if (o === "processing" && n === "treated") return "Préparation terminée côté officine.";
  if (o === "treated" && n === "completed") return "Dossier clôturé après les retraits au comptoir.";
  if (o === "treated" && n === "partially_collected") return "Clôture enregistrée (retrait partiel).";
  if (o === "treated" && n === "fully_collected") return "Clôture enregistrée (tout récupéré).";
  if (n === "cancelled") return "La demande a été annulée.";
  if (n === "abandoned") return "La demande a été abandonnée.";
  if (n === "expired") return "La demande a expiré.";
  return `Évolution du dossier : ${requestStatusFr[o] ?? o} → ${requestStatusFr[n] ?? n}.`;
}

/** Titre lisible pour une ligne d’historique dossier (pharmacien). */
export function requestHistoryPharmacistHeadline(oldStatus: string | null, newStatus: string): string {
  const o = oldStatus;
  const n = newStatus;
  if (!o) {
    if (n === "submitted") return "Nouvelle demande reçue.";
    return `État : ${requestStatusFr[n] ?? n}.`;
  }
  if (o === "submitted" && n === "in_review") return "Prise en charge interne.";
  if (o === "in_review" && n === "responded") return "Réponse publiée au patient.";
  if (o === "responded" && n === "confirmed") return "Le patient a validé la sélection.";
  if (o === "responded" && n === "expired") return "Délai dépassé : expirée faute de validation du patient.";
  if (o === "responded" && n === "abandoned") return "Abandon enregistré côté patient après votre réponse.";
  if (o === "confirmed" && n === "treated") return "Dossier déclaré prêt (comptoir).";
  if (o === "treated" && n === "completed") return "Dossier clôturé après comptoir.";
  if (n === "cancelled") return "Demande annulée.";
  if (n === "abandoned") return "Demande abandonnée par le patient.";
  if (n === "expired") return "Demande expirée côté patient.";
  const from = requestStatusFr[o] ?? "étape précédente";
  const to = requestStatusFr[n] ?? "nouvelle étape";
  return `Le dossier passe de « ${from} » à « ${to} ».`;
}

/** Libellé court pour badges (même vocabulaire, `in_review` = envoyée). */
export function requestStatusShortFr(status: string): string {
  return requestStatusFr[status] ?? status;
}

/** Côté officine : `confirmed` = validé par le patient jusqu’à déclaration `treated` ; le statut virtuel `in_progress_virtual` n’est plus utilisé dans les hubs. */
export function requestStatusShortFrPharmacien(status: string): string {
  if (status === "confirmed") return "Validée client";
  if (status === "responded") return "Répondue - attente client";
  return requestStatusShortFr(status);
}

/** @deprecated Utiliser `PATIENT_DASHBOARD_BUCKETS` / `PHARMACIST_DASHBOARD_BUCKETS` dans `lib/demandes-hub-buckets.ts`. */

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

const STATUS_BADGE_BASE =
  "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-tight";

/** Badge visuel par statut — seule zone où la couleur suit le statut métier. */
export function requestStatusBadgeClass(status: string): string {
  switch (status) {
    case "submitted":
    case "in_review":
      return `${STATUS_BADGE_BASE} border-sky-200 bg-sky-50 text-sky-900`;
    case "responded":
      return `${STATUS_BADGE_BASE} border-amber-200 bg-amber-50 text-amber-900`;
    case "confirmed":
      return `${STATUS_BADGE_BASE} border-violet-200 bg-violet-50 text-violet-900`;
    case "processing":
      return `${STATUS_BADGE_BASE} border-indigo-200 bg-indigo-50 text-indigo-900`;
    case "treated":
      return `${STATUS_BADGE_BASE} border-cyan-200 bg-cyan-50 text-cyan-900`;
    case "in_progress_virtual":
      return `${STATUS_BADGE_BASE} border-violet-200 bg-violet-50 text-violet-900`;
    case "completed":
    case "partially_collected":
    case "fully_collected":
      return `${STATUS_BADGE_BASE} border-emerald-200 bg-emerald-50 text-emerald-900`;
    case "cancelled":
    case "abandoned":
    case "expired":
      return `${STATUS_BADGE_BASE} border-slate-200 bg-slate-100 text-slate-800`;
    case "draft":
      return `${STATUS_BADGE_BASE} border-border bg-muted/50 text-muted-foreground`;
    default:
      return `${STATUS_BADGE_BASE} border-border bg-muted/50 text-foreground`;
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

/** Badge cartes produit — ligne hors liste patient (écrans pharmacien, aligné patient « Ajout officine »). */
export const pharmacistProposedProductBadgeFr = "Ajout officine";

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
  /** Ajustements structurés après validation (`pharma_adjust_confirmed`, etc.) */
  if (r.startsWith("audit_v1:")) {
    if (role === "patient") return "La pharmacie";
    return "Vous (pharmacie)";
  }
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
