import { countInPromoBucket, type PromoStatBucket } from "@/lib/promo/reservation-hub-buckets";
import type { PromoReservationHubRow } from "@/lib/promo/reservation-hub-sections";

export const PROMO_HUB_DASHBOARD_PREVIEW = 3;

const TERMINAL_PROMO_STATUSES = new Set(["collected", "unavailable", "cancelled"]);

export function sortPromoHubRowsByRecency(rows: PromoReservationHubRow[]): PromoReservationHubRow[] {
  return [...rows].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
}

/** Jusqu'à 5 réservations récentes (priorité statuts actifs). */
export function pickRecentActivePromoRows(rows: PromoReservationHubRow[], limit = 5, role: "patient" | "pharmacien" = "patient") {
  const cap = Math.min(5, Math.max(1, limit));
  const scored = rows.map((row) => {
    let score = new Date(row.updated_at).getTime();
    if (role === "pharmacien") {
      if (row.status === "submitted") score += 6e14;
      if (row.status === "confirmed") score += 5e14;
    } else {
      if (row.status === "confirmed") score += 5e14;
      if (row.status === "submitted") score += 4e14;
    }
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((s) => s.row);
}

export function promoHubDashboardQuickStats(
  rows: PromoReservationHubRow[],
  buckets: PromoStatBucket[],
): { total: number; active: number } {
  const total = rows.length;
  const archiveCount = buckets
    .filter((b) => b.statuses.every((s) => TERMINAL_PROMO_STATUSES.has(s)))
    .reduce((sum, b) => sum + countInPromoBucket(rows, b), 0);
  return { total, active: Math.max(0, total - archiveCount) };
}
