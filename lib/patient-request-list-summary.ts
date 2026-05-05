/** Données embarquées Supabase pour la liste patient. */
export type PatientRequestItemRow = {
  requested_qty: number;
  selected_qty: number | null;
  available_qty: number | null;
  unit_price: number | string | null;
  is_selected_by_patient?: boolean | null;
};

export function summarizeRequestForPatientCard(items: PatientRequestItemRow[] | null | undefined): {
  lineCount: number;
  /** Somme prix × qté lorsque prix connu ; `null` si aucune ligne prix connue */
  totalDh: number | null;
} {
  const rows = Array.isArray(items) ? items : [];
  const billableLines = rows.filter((r) => r.is_selected_by_patient !== false);
  let total = 0;
  let priced = false;
  for (const it of billableLines) {
    const p = it.unit_price != null ? Number(it.unit_price) : NaN;
    if (Number.isNaN(p) || p <= 0) continue;
    const qtyRaw = it.selected_qty ?? it.available_qty ?? it.requested_qty;
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    total += p * qty;
    priced = true;
  }
  return {
    lineCount: rows.length || 0,
    totalDh: priced ? Math.round(total * 100) / 100 : null,
  };
}
