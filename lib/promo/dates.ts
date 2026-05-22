import { MAX_PICKUP_DAYS_AHEAD } from "@/lib/promo/types";

const TZ = "Africa/Casablanca";

export function todayIsoCasablanca(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function maxPickupDateIso(fromToday = todayIsoCasablanca()): string {
  const [y, m, d] = fromToday.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + MAX_PICKUP_DAYS_AHEAD);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatPromoValidityFr(from: string, until: string): string {
  const a = new Date(`${from}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const b = new Date(`${until}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  return `${a} → ${b}`;
}
