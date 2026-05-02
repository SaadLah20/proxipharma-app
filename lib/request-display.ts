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
