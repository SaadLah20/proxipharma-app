import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";

/** Ligne catalogue proposée par l’officine (badge / mentions patient alignés sur les cartes). */
export function isPatientAjoutOfficineLine(row: { line_source?: string | null }): boolean {
  return row.line_source === "pharmacist_proposed";
}

/** True si la ligne a été insérée après validation patient (`line_added_after_confirm` dans le journal). */
export function isRequestItemAddedAfterPatientConfirmation(
  itemId: string,
  bundles: { amendments: unknown }[]
): boolean {
  for (const b of bundles) {
    const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
    for (const e of arr) {
      if (e.kind === "line_added_after_confirm" && e.request_item_id === itemId) return true;
    }
  }
  return false;
}

/** Dernier canal enregistré lors d’un écart post-validation (pour réutiliser le consentement au « Annuler l’écart »). */
export function lastWithdrawClientChannelForRequestItem(
  itemId: string,
  bundles: { created_at: string; amendments: unknown }[]
): string | null {
  let best: { t: string; ch: string } | null = null;
  for (const b of bundles) {
    const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
    for (const e of arr) {
      if (e.kind !== "withdraw_after_confirm" || e.request_item_id !== itemId) continue;
      const ch = e.client_confirmation_channel?.trim();
      if (!ch) continue;
      const t = b.created_at;
      if (!best || t > best.t) best = { t, ch };
    }
  }
  return best?.ch ?? null;
}
