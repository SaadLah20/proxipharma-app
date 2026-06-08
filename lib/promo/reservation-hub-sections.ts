import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoReservationStatus } from "@/lib/promo/types";

export type PromoReservationHubRow = {
  id: string;
  status: PromoReservationStatus;
  pickup_date: string;
  pickup_time: string | null;
  public_ref: string | null;
  updated_at: string;
  offer_id?: string;
  pharmacy_id?: string;
  patient_id?: string;
  offer: { title: string; discount_percent?: number } | null;
  pharmacy?: { nom: string; ville?: string | null } | null;
  patient?: { full_name: string | null } | null;
  /** Lignes du pack pour l’aperçu sur les cartes hub. */
  pack_lines?: PromoLineWithPrice[];
};

export type PromoHubSectionId = "at_pharmacy" | "action_required" | "archives";

export type PromoHubSection = {
  id: PromoHubSectionId;
  title: string;
  subtitle?: string;
  statuses: readonly PromoReservationStatus[];
};

export const PATIENT_PROMO_HUB_SECTIONS_FR: PromoHubSection[] = [
  {
    id: "at_pharmacy",
    title: "Chez l'officine",
    subtitle: "En attente de confirmation pharmacie.",
    statuses: ["submitted"],
  },
  {
    id: "action_required",
    title: "Passage prévu",
    subtitle: "Pack confirmé — présentez-vous à la date indiquée.",
    statuses: ["confirmed"],
  },
  {
    id: "archives",
    title: "Historique",
    subtitle: "Récupérées, indisponibles ou annulées.",
    statuses: ["collected", "unavailable", "cancelled"],
  },
];

export const PHARMACIST_PROMO_HUB_SECTIONS_FR: PromoHubSection[] = [
  {
    id: "action_required",
    title: "À traiter",
    subtitle: "Confirmer ou décliner les nouvelles demandes.",
    statuses: ["submitted"],
  },
  {
    id: "at_pharmacy",
    title: "Confirmées",
    subtitle: "Packs réservés en attente de retrait client.",
    statuses: ["confirmed"],
  },
  {
    id: "archives",
    title: "Terminées",
    subtitle: "Récupérées, refusées ou annulées.",
    statuses: ["collected", "unavailable", "cancelled"],
  },
];

const PATIENT_SECTION_ORDER: PromoHubSectionId[] = ["action_required", "at_pharmacy", "archives"];
const PHARMACIST_SECTION_ORDER: PromoHubSectionId[] = ["action_required", "at_pharmacy", "archives"];

export function promoHubSectionsForRole(role: "patient" | "pharmacien"): PromoHubSection[] {
  return role === "patient" ? PATIENT_PROMO_HUB_SECTIONS_FR : PHARMACIST_PROMO_HUB_SECTIONS_FR;
}

export function promoHubSectionOrderForRole(role: "patient" | "pharmacien"): PromoHubSectionId[] {
  return role === "patient" ? PATIENT_SECTION_ORDER : PHARMACIST_SECTION_ORDER;
}

export function rowsInPromoHubSection(rows: PromoReservationHubRow[], sectionId: PromoHubSectionId, role: "patient" | "pharmacien") {
  const section = promoHubSectionsForRole(role).find((s) => s.id === sectionId);
  if (!section) return [];
  const allow = new Set(section.statuses);
  return rows.filter((r) => allow.has(r.status));
}

export function countInPromoHubSection(rows: PromoReservationHubRow[], sectionId: PromoHubSectionId, role: "patient" | "pharmacien") {
  return rowsInPromoHubSection(rows, sectionId, role).length;
}

export function promoHubListHref(basePath: string, bucketKey?: string): string {
  const params = new URLSearchParams({ vue: "liste" });
  if (bucketKey) params.set("statut", bucketKey);
  return `${basePath}?${params.toString()}`;
}
