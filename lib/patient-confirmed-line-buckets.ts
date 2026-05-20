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
  /** Note patient ligne (demande initiale / précision). */
  client_comment?: string | null;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
  patient_chosen_alternative_id?: string | null;
  counter_outcome: string;
  counter_cancel_reason?: string | null;
  counter_cancel_detail?: string | null;
  post_confirm_fulfillment?: string | null;
  withdrawn_after_confirm?: boolean | null;
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

/** Prix unitaire sur la branche retenue à la validation (principal ou alternative choisie). */
export function validatedBranchUnitPriceMad(row: PatientLineLike): number | null {
  const chosenId = row.patient_chosen_alternative_id ?? null;
  if (!chosenId) {
    const u = row.unit_price;
    if (u != null) {
      const n = Number(u);
      if (Number.isFinite(n)) return n;
    }
    const pph = oneProd(row.products)?.price_pph;
    if (pph == null || pph === "") return null;
    const pn = Number(pph);
    return Number.isFinite(pn) ? pn : null;
  }
  const alt = altRowsOf(row).find((a) => a.id === chosenId);
  const u = alt?.unit_price ?? null;
  if (u == null) return null;
  const n = Number(u);
  return Number.isFinite(n) ? n : null;
}

export function validatedQtyForPatientLine(row: PatientLineLike): number {
  return row.selected_qty ?? row.requested_qty;
}

/** Quantité stock / préparation sur la branche retenue (principal ou alternative choisie). */
export function effectiveAvailableQtyForPatientLine(row: PatientLineLike): number | null {
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (chosen) {
    const alt = altRowsOf(row).find((a) => a.id === chosen);
    if (alt?.available_qty != null) {
      const n = Number(alt.available_qty);
      return Number.isFinite(n) ? n : null;
    }
  }
  if (row.available_qty != null) {
    const n = Number(row.available_qty);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Qté affichée sur les cartes patient : choix validé (`selected_qty`), pas le stock officine seul. */
export function patientDisplayQtyForLine(row: PatientLineLike, _requestStatus?: string | null): number {
  return validatedQtyForPatientLine(row);
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

/** Vue « dossier validé par le patient » : 3 blocs (officine / commande / hors périmètre). */
/** Lignes retenues mais retirées après validation avec traçabilité (hors trois blocs de commande ouverte). */
export function patientWithdrawnAfterConfirmLines<T extends PatientLineLike>(items: T[]): T[] {
  return items.filter((r) => Boolean(r.is_selected_by_patient) && Boolean(r.withdrawn_after_confirm));
}

export function bucketPatientValidatedLinesThreeWays<T extends PatientLineLike>(items: T[]): {
  dispoOfficine: T[];
  aCommander: T[];
  horsPerimetre: T[];
  retireesApresValidation: T[];
} {
  const retireesApresValidation = patientWithdrawnAfterConfirmLines(items);
  const withoutRetired = items.filter((r) => !retireesApresValidation.some((x) => x.id === r.id));
  const b = groupPatientConfirmedLines(withoutRetired);
  const horsPerimetre = [...b.unavailableOrShortage, ...patientConfirmedLinesNotInBuckets(withoutRetired, b)];
  return { dispoOfficine: b.atPharmacy, aCommander: b.toOrder, horsPerimetre, retireesApresValidation };
}
