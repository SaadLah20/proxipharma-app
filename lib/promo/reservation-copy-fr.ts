import type { PromoReservationStatus } from "@/lib/promo/types";

/** Libellés courtois côté patient (éviter « rejetée »). */
export const PROMO_RESERVATION_STATUS_PATIENT_FR: Record<
  PromoReservationStatus,
  { label: string; hint: string }
> = {
  submitted: {
    label: "Demande envoyée",
    hint: "Votre pharmacie va confirmer la disponibilité du pack.",
  },
  confirmed: {
    label: "Confirmée par l'officine",
    hint: "Présentez-vous à la date indiquée pour retirer votre pack.",
  },
  unavailable: {
    label: "Non disponible",
    hint: "L'officine n'a pas pu honorer cette réservation. Un message vous a été transmis.",
  },
  collected: {
    label: "Récupérée",
    hint: "Merci — votre pack a bien été retiré.",
  },
  cancelled: {
    label: "Annulée",
    hint: "Cette demande n'est plus active.",
  },
};

export const PROMO_RESERVATION_STATUS_PHARMACIST_FR: Record<PromoReservationStatus, string> = {
  submitted: "À traiter",
  confirmed: "Confirmée",
  unavailable: "Non disponible",
  collected: "Récupérée",
  cancelled: "Annulée",
};
