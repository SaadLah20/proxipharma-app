import type { PromoReservationStatus } from "@/lib/promo/types";
import { PROMO_RESERVATION_STATUS_PATIENT_FR, PROMO_RESERVATION_STATUS_PHARMACIST_FR } from "@/lib/promo/reservation-copy-fr";

export function promoReservationBadgeClass(status: PromoReservationStatus): string {
  switch (status) {
    case "submitted":
      return "bg-sky-50 text-sky-950 ring-1 ring-sky-200/80";
    case "confirmed":
      return "bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200/80";
    case "unavailable":
      return "bg-rose-50 text-rose-950 ring-1 ring-rose-200/80";
    case "collected":
      return "bg-violet-50 text-violet-950 ring-1 ring-violet-200/80";
    case "cancelled":
      return "bg-muted text-muted-foreground ring-1 ring-border/80";
    default:
      return "bg-muted text-foreground ring-1 ring-border/80";
  }
}

export function promoReservationLabel(status: PromoReservationStatus, role: "patient" | "pharmacien"): string {
  return role === "patient"
    ? PROMO_RESERVATION_STATUS_PATIENT_FR[status].label
    : PROMO_RESERVATION_STATUS_PHARMACIST_FR[status];
}

export function promoReservationHint(status: PromoReservationStatus): string {
  return PROMO_RESERVATION_STATUS_PATIENT_FR[status].hint;
}

export const PROMO_RESERVATION_BUCKETS = [
  { key: "a_traiter", label: "À traiter", statuses: ["submitted"] as PromoReservationStatus[] },
  { key: "confirmees", label: "Confirmées", statuses: ["confirmed"] as PromoReservationStatus[] },
  { key: "terminees", label: "Terminées", statuses: ["collected", "unavailable", "cancelled"] as PromoReservationStatus[] },
] as const;
