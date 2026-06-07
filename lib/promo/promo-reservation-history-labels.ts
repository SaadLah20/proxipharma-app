import type { PromoReservationStatus } from "@/lib/promo/types";
import { promoReservationLabel } from "@/lib/promo/reservation-status-ui";

export type PromoReservationHistoryRow = {
  id: string;
  old_status: PromoReservationStatus | null;
  new_status: PromoReservationStatus;
  note: string | null;
  created_at: string;
};

export function promoReservationHistoryEventLabel(
  row: PromoReservationHistoryRow,
  role: "patient" | "pharmacien",
): string {
  const to = promoReservationLabel(row.new_status, role);
  if (!row.old_status) return to;
  const from = promoReservationLabel(row.old_status, role);
  return `${from} → ${to}`;
}

export const PROMO_TERMINAL_STATUSES: readonly PromoReservationStatus[] = [
  "collected",
  "unavailable",
  "cancelled",
];

export function isPromoReservationTerminalStatus(status: PromoReservationStatus): boolean {
  return PROMO_TERMINAL_STATUSES.includes(status);
}
