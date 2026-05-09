import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";

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
