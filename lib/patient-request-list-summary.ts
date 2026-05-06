/** Données embarquées Supabase pour la liste patient. */
export type PatientRequestItemRow = {
  requested_qty: number;
  selected_qty: number | null;
  available_qty: number | null;
  unit_price: number | string | null;
  is_selected_by_patient?: boolean | null;
  line_source?: string | null;
  patient_chosen_alternative_id?: string | null;
  counter_outcome?: string | null;
  availability_status?: string | null;
  products?: { price_pph?: number | string | null } | { price_pph?: number | string | null }[] | null;
  request_item_alternatives?: Array<{
    id: string;
    unit_price: number | string | null;
  }> | null;
};

function catalogPph(row: PatientRequestItemRow): number | null {
  const raw = row.products;
  if (!raw) return null;
  const first = Array.isArray(raw) ? raw[0] : raw;
  const n = first?.price_pph != null ? Number(first.price_pph) : NaN;
  if (Number.isNaN(n) || n <= 0) return null;
  return n;
}

export function summarizeRequestForPatientCard(items: PatientRequestItemRow[] | null | undefined): {
  lineCount: number;
  principalCount: number;
  proposedCount: number;
  alternativesCount: number;
  selectedPrincipalCount: number;
  selectedProposedCount: number;
  selectedAlternativesCount: number;
  selectedPendingPickupCount: number;
  selectedPickedUpCount: number;
  selectedCancelledCount: number;
  selectedToOrderPendingCount: number;
  totalInitialDh: number | null;
  totalSelectedDh: number | null;
  hasExecutionProgress: boolean;
} {
  const rows = Array.isArray(items) ? items : [];
  const selectedRows = rows.filter((r) => r.is_selected_by_patient !== false);

  let principalCount = 0;
  let proposedCount = 0;
  let alternativesCount = 0;
  let selectedPrincipalCount = 0;
  let selectedProposedCount = 0;
  let selectedAlternativesCount = 0;
  let selectedPendingPickupCount = 0;
  let selectedPickedUpCount = 0;
  let selectedCancelledCount = 0;
  let selectedToOrderPendingCount = 0;

  let totalInitial = 0;
  let hasInitialPrice = false;
  let totalSelected = 0;
  let hasSelectedPrice = false;
  let hasExecutionProgress = false;

  for (const it of rows) {
    const outcomeAll = it.counter_outcome ?? "unset";
    if (outcomeAll !== "unset") hasExecutionProgress = true;
    if (outcomeAll === "cancelled_at_counter") selectedCancelledCount += 1;
    const isProposed = it.line_source === "pharmacist_proposed";
    if (isProposed) proposedCount += 1;
    else principalCount += 1;
    alternativesCount += Array.isArray(it.request_item_alternatives) ? it.request_item_alternatives.length : 0;

    if (isProposed) continue;
    const p =
      it.unit_price != null && Number(it.unit_price) > 0
        ? Number(it.unit_price)
        : (catalogPph(it) ?? Number.NaN);
    if (Number.isNaN(p) || p <= 0) continue;
    const qtyRaw = it.requested_qty;
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    totalInitial += p * qty;
    hasInitialPrice = true;
  }

  for (const it of selectedRows) {
    const chosenAltId = it.patient_chosen_alternative_id ?? null;
    const altRows = Array.isArray(it.request_item_alternatives) ? it.request_item_alternatives : [];
    if (chosenAltId) {
      selectedAlternativesCount += 1;
    } else if (it.line_source === "pharmacist_proposed") {
      selectedProposedCount += 1;
    } else {
      selectedPrincipalCount += 1;
    }

    const outcome = it.counter_outcome ?? "unset";
    if (outcome === "picked_up") selectedPickedUpCount += 1;
    else if (outcome !== "cancelled_at_counter") selectedPendingPickupCount += 1;

    if (it.availability_status === "to_order" && (outcome === "unset" || outcome === "deferred_next_visit")) {
      selectedToOrderPendingCount += 1;
    }

    let unitPrice: number | null = null;
    if (chosenAltId) {
      const chosenAlt = altRows.find((a) => a.id === chosenAltId);
      const altPrice = chosenAlt?.unit_price != null ? Number(chosenAlt.unit_price) : NaN;
      if (!Number.isNaN(altPrice) && altPrice > 0) unitPrice = altPrice;
    } else {
      const basePrice =
        it.unit_price != null && Number(it.unit_price) > 0
          ? Number(it.unit_price)
          : (catalogPph(it) ?? Number.NaN);
      if (!Number.isNaN(basePrice) && basePrice > 0) unitPrice = basePrice;
    }
    if (unitPrice == null) continue;
    const qtyRaw = it.selected_qty ?? it.available_qty ?? it.requested_qty;
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    totalSelected += unitPrice * qty;
    hasSelectedPrice = true;
  }

  return {
    lineCount: rows.length || 0,
    principalCount,
    proposedCount,
    alternativesCount,
    selectedPrincipalCount,
    selectedProposedCount,
    selectedAlternativesCount,
    selectedPendingPickupCount,
    selectedPickedUpCount,
    selectedCancelledCount,
    selectedToOrderPendingCount,
    totalInitialDh: hasInitialPrice ? Math.round(totalInitial * 100) / 100 : null,
    totalSelectedDh: hasSelectedPrice ? Math.round(totalSelected * 100) / 100 : null,
    hasExecutionProgress,
  };
}
