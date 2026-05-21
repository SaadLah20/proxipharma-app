import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";

/** Badge cartes + historique pour une ligne insérée après validation patient. */
export const POST_CONFIRM_LINE_ADDED_BADGE_FR = "Ajouté après validation";

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

export function buildLineAddedAfterConfirmAmendment(args: {
  requestItemId: string;
  productName: string;
  qty: number;
  mode: "ordonnance" | "proposed";
  channel: string;
  motive: string;
}): SupplyAmendmentEntryJson {
  const nm = args.productName.trim() || "Produit";
  const detail =
    args.mode === "ordonnance"
      ? `${nm} : produit ordonnance ajouté après validation (${args.qty} unité(s)).`
      : `${nm} : proposition après validation (${args.qty} unité(s)).`;
  return {
    kind: "line_added_after_confirm",
    request_item_id: args.requestItemId,
    summary: `${nm} ajouté avec accord patient`,
    detail,
    client_confirmation_channel: args.channel.trim(),
    client_motive: args.motive.trim() === "" ? null : args.motive.trim(),
  };
}
