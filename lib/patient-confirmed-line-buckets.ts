/** Regroupe les lignes « produits » côté patient une fois la demande validée (confirmed+). */

export type PatientLineLike = {
  id: string;
  requested_qty: number;
  selected_qty: number | null;
  is_selected_by_patient: boolean;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  expected_availability_date: string | null;
  pharmacist_comment: string | null;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
  patient_chosen_alternative_id?: string | null;
  counter_outcome: string;
  counter_cancel_reason?: string | null;
  counter_cancel_detail?: string | null;
  post_confirm_fulfillment?: string | null;
  products?: { name?: string | null; price_pph?: number | string | null } | { name?: string | null; price_pph?: number | string | null }[] | null;
  request_item_alternatives?:
    | Array<{
        id: string;
        availability_status: string | null;
        available_qty: number | null;
        unit_price: number | null;
        expected_availability_date: string | null;
        products?: { name?: string | null; price_pph?: number | string | null } | { name?: string | null; price_pph?: number | string | null }[] | null;
      }>
    | {
        id: string;
        availability_status: string | null;
        available_qty: number | null;
        unit_price: number | null;
        expected_availability_date: string | null;
        products?: { name?: string | null; price_pph?: number | string | null } | { name?: string | null; price_pph?: number | string | null }[] | null;
      }
    | null;
};

type LineAltRow = {
  id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  expected_availability_date: string | null;
  products?: { name?: string | null; price_pph?: number | string | null } | { name?: string | null; price_pph?: number | string | null }[] | null;
};

function altRowsOf(line: PatientLineLike): LineAltRow[] {
  const raw = line.request_item_alternatives;
  if (!raw) return [];
  return Array.isArray(raw) ? (raw as LineAltRow[]) : [raw as LineAltRow];
}

function oneProd(p: PatientLineLike["products"]) {
  if (!p) return undefined;
  return Array.isArray(p) ? p[0] : p;
}

/** Branche retenue par le patient (principal ou alternative choisie). */
export function effectiveAvailabilityForPatientLine(row: PatientLineLike): string | null {
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (!chosen) return row.availability_status ?? null;
  const alts = altRowsOf(row);
  const alt = alts.find((a) => a.id === chosen);
  return alt?.availability_status ?? row.availability_status ?? null;
}

export function effectiveEtaForPatientLine(row: PatientLineLike): string | null {
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (!chosen) return row.expected_availability_date ?? null;
  const alts = altRowsOf(row);
  const alt = alts.find((a) => a.id === chosen);
  return alt?.expected_availability_date ?? row.expected_availability_date ?? null;
}

export type PatientConfirmedBuckets<T extends PatientLineLike = PatientLineLike> = {
  atPharmacy: T[];
  toOrder: T[];
  unavailableOrShortage: T[];
};

/**
 * Après validation patient : classe les lignes pour l’affichage en 3 blocs.
 * — Officine : sélection avec dispo / partiellement dispo
 * — À commander : sélection « à commander »
 * — Indispo / rupture : réponse pharmacie sur la branche concernée (souvent non retenue par le patient)
 */
export function groupPatientConfirmedLines<T extends PatientLineLike>(items: T[]): PatientConfirmedBuckets<T> {
  const atPharmacy: T[] = [];
  const toOrder: T[] = [];
  const unavailableOrShortage: T[] = [];

  for (const row of items) {
    const eff = effectiveAvailabilityForPatientLine(row);
    const selected = row.is_selected_by_patient;

    if (eff === "unavailable" || eff === "market_shortage") {
      unavailableOrShortage.push(row);
      continue;
    }

    if (selected) {
      if (eff === "to_order") {
        toOrder.push(row);
        continue;
      }
      if (eff === "available" || eff === "partially_available") {
        atPharmacy.push(row);
        continue;
      }
    }
  }

  return { atPharmacy, toOrder, unavailableOrShortage };
}

export function validatedProductLabel(row: PatientLineLike): string {
  const chosenId = row.patient_chosen_alternative_id ?? null;
  if (!chosenId) return oneProd(row.products)?.name ?? "Produit";
  const alt = altRowsOf(row).find((a) => a.id === chosenId);
  return oneProd(alt?.products)?.name ?? oneProd(row.products)?.name ?? "Produit";
}

export function patientConfirmedLinesNotInBuckets<T extends PatientLineLike>(
  items: T[],
  b: PatientConfirmedBuckets<T>
): T[] {
  const used = new Set<string>([
    ...b.atPharmacy.map((r) => r.id),
    ...b.toOrder.map((r) => r.id),
    ...b.unavailableOrShortage.map((r) => r.id),
  ]);
  return items.filter((i) => !used.has(i.id));
}
