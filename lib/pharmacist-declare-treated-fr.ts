import {
  effectiveAvailabilityForPatientLine,
  type PatientLineLike,
  validatedProductLabel,
  validatedQtyForPatientLine,
} from "@/lib/patient-confirmed-line-buckets";

export type PharmacistDeclareTreatedLineFr = {
  id: string;
  name: string;
  qty: number;
  statusNote?: string | null;
};

export type PharmacistDeclareTreatedSummaryFr = {
  reservedLines: PharmacistDeclareTreatedLineFr[];
  orderedLines: PharmacistDeclareTreatedLineFr[];
  otherLines: PharmacistDeclareTreatedLineFr[];
};

type DraftLike = {
  withdrawn_after_confirm?: boolean;
  availability_status?: string | null;
  fulfillment_draft?: "unset" | "reserved" | "ordered" | "arrived_reserved";
};

function fulfillmentStatusNoteFr(
  eff: string | null | undefined,
  pcf: string | null | undefined
): string | null {
  if (eff === "to_order") {
    if (pcf === "arrived_reserved") return "Reçu en officine";
    if (pcf === "ordered") return "Commandé";
    return "À commander";
  }
  if (eff === "available" || eff === "partially_available") {
    if (pcf === "reserved") return "Réservé";
    return "À réserver";
  }
  return null;
}

type ItemLike = PatientLineLike & {
  id: string;
  is_selected_by_patient?: boolean | null;
  withdrawn_after_confirm?: boolean | null;
};

export function buildPharmacistDeclareTreatedSummary(
  items: ItemLike[],
  draft: Record<string, DraftLike | undefined>,
  requestType: string | null | undefined
): PharmacistDeclareTreatedSummaryFr {
  const reservedLines: PharmacistDeclareTreatedLineFr[] = [];
  const orderedLines: PharmacistDeclareTreatedLineFr[] = [];
  const otherLines: PharmacistDeclareTreatedLineFr[] = [];

  for (const row of items) {
    if (!row.is_selected_by_patient) continue;
    const f = draft[row.id];
    const withdrawn = Boolean(row.withdrawn_after_confirm) || Boolean(f?.withdrawn_after_confirm);
    if (withdrawn) continue;

    const eff =
      (f?.availability_status as string | null | undefined) ??
      effectiveAvailabilityForPatientLine(row);
    const pcf = f?.fulfillment_draft ?? row.post_confirm_fulfillment ?? "unset";
    void requestType;
    const line: PharmacistDeclareTreatedLineFr = {
      id: row.id,
      name: validatedProductLabel(row),
      qty: validatedQtyForPatientLine(row),
      statusNote: fulfillmentStatusNoteFr(eff, pcf),
    };

    if (eff === "available" || eff === "partially_available") {
      reservedLines.push(line);
    } else if (eff === "to_order") {
      orderedLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  return { reservedLines, orderedLines, otherLines };
}

/** Dernière ligne active écartée : aucun produit restant et aucun retrait comptoir. */
export function pharmacistWithdrawWouldAbandonNoPickup(
  items: ItemLike[],
  draft: Record<string, DraftLike | undefined>,
  withdrawRowId: string
): boolean {
  let activeAfter = 0;
  let pickedUp = 0;

  for (const row of items) {
    if (!row.is_selected_by_patient) continue;
    const f = draft[row.id];
    const withdrawn =
      row.id === withdrawRowId ? true : Boolean(row.withdrawn_after_confirm) || Boolean(f?.withdrawn_after_confirm);
    if (!withdrawn) activeAfter += 1;
    if ((row.counter_outcome ?? "unset") === "picked_up") pickedUp += 1;
  }

  return activeAfter === 0 && pickedUp === 0;
}

/** Nombre de lignes retenues encore actives (hors écart). */
export function pharmacistActiveRetainedLineCount(
  items: ItemLike[],
  draft: Record<string, DraftLike | undefined>
): number {
  let n = 0;
  for (const row of items) {
    if (!row.is_selected_by_patient) continue;
    const f = draft[row.id];
    if (Boolean(row.withdrawn_after_confirm) || Boolean(f?.withdrawn_after_confirm)) continue;
    n += 1;
  }
  return n;
}

/** Abandon sans retrait comptoir : au moins une ligne active, aucun picked_up. */
export function pharmacistAbandonNoPickupEligible(
  items: ItemLike[],
  draft: Record<string, DraftLike | undefined>
): { eligible: boolean; activeRetained: number; pickedUpCount: number } {
  let pickedUpCount = 0;
  for (const row of items) {
    if (!row.is_selected_by_patient) continue;
    if ((row.counter_outcome ?? "unset") === "picked_up") pickedUpCount += 1;
  }
  const activeRetained = pharmacistActiveRetainedLineCount(items, draft);
  return {
    eligible: activeRetained > 0 && pickedUpCount < 1,
    activeRetained,
    pickedUpCount,
  };
}
