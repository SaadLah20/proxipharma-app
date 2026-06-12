/** Brouillon officine : retrait / écart post-validation. */
export type PharmacistRequestCatalogBlockDraft = {
  withdrawn_after_confirm?: boolean | null;
};

export type PharmacistRequestCatalogBlockAlt = {
  product_id?: string | null;
  pharmacy_product_id?: string | null;
  line_product_kind?: string | null;
};

/** Ligne demande (principale + alternatives embarquées). */
export type PharmacistRequestCatalogBlockRow = {
  id: string;
  product_id?: string | null;
  pharmacy_product_id?: string | null;
  line_product_kind?: string | null;
  is_selected_by_patient: boolean;
  withdrawn_after_confirm?: boolean | null;
  request_item_alternatives?:
    | ReadonlyArray<PharmacistRequestCatalogBlockAlt>
    | PharmacistRequestCatalogBlockAlt
    | null;
};

export type CatalogLineRef = {
  source: "global" | "pharmacy";
  id: string;
};

export function catalogLineRefFromRow(row: PharmacistRequestCatalogBlockRow): CatalogLineRef | null {
  if (row.line_product_kind === "pharmacy" && row.pharmacy_product_id) {
    return { source: "pharmacy", id: row.pharmacy_product_id };
  }
  if (row.product_id) {
    return { source: "global", id: row.product_id };
  }
  return null;
}

export function catalogLineRefFromAlt(alt: PharmacistRequestCatalogBlockAlt): CatalogLineRef | null {
  if (alt.line_product_kind === "pharmacy" && alt.pharmacy_product_id) {
    return { source: "pharmacy", id: alt.pharmacy_product_id };
  }
  if (alt.product_id) {
    return { source: "global", id: alt.product_id };
  }
  return null;
}

export function catalogLineRefKey(ref: CatalogLineRef): string {
  return `${ref.source}:${ref.id}`;
}

function normalizeAlternatives(
  raw: PharmacistRequestCatalogBlockRow["request_item_alternatives"]
): PharmacistRequestCatalogBlockAlt[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return Array.from(raw);
  const single = raw as PharmacistRequestCatalogBlockAlt;
  return [single];
}

function effectiveWithdrawnAfterConfirm(
  row: PharmacistRequestCatalogBlockRow,
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>
): boolean {
  const fd = draft?.[row.id];
  return Boolean(row.withdrawn_after_confirm) || Boolean(fd?.withdrawn_after_confirm);
}

const POST_PATIENT_VALIDATION_STATUSES = new Set(["confirmed", "treated", "completed"]);

/**
 * Une occurrence de produit bloque un nouvel ajout tant que la ligne parente est encore active.
 */
export function pharmacistRequestLineProductOccupancyBlocks(
  row: PharmacistRequestCatalogBlockRow,
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>,
  requestStatus?: string | null
): boolean {
  if (effectiveWithdrawnAfterConfirm(row, draft)) return false;
  const postPatientValidation =
    requestStatus != null && POST_PATIENT_VALIDATION_STATUSES.has(requestStatus);
  if (!postPatientValidation) return true;
  return Boolean(row.is_selected_by_patient);
}

/** `true` si la référence catalogue est déjà présente sur une ligne/alternative bloquante. */
export function pharmacistRequestCatalogRefBlocked(
  ref: CatalogLineRef,
  rows: readonly PharmacistRequestCatalogBlockRow[],
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>,
  requestStatus?: string | null
): boolean {
  const key = catalogLineRefKey(ref);
  for (const row of rows) {
    const rowRef = catalogLineRefFromRow(row);
    if (
      rowRef &&
      catalogLineRefKey(rowRef) === key &&
      pharmacistRequestLineProductOccupancyBlocks(row, draft, requestStatus)
    ) {
      return true;
    }
    for (const alt of normalizeAlternatives(row.request_item_alternatives)) {
      const altRef = catalogLineRefFromAlt(alt);
      if (
        altRef &&
        catalogLineRefKey(altRef) === key &&
        pharmacistRequestLineProductOccupancyBlocks(row, draft, requestStatus)
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Compatibilité : blocage par product_id global uniquement. */
export function pharmacistRequestCatalogProductIdBlocked(
  productId: string,
  rows: readonly PharmacistRequestCatalogBlockRow[],
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>,
  requestStatus?: string | null
): boolean {
  return pharmacistRequestCatalogRefBlocked(
    { source: "global", id: productId },
    rows,
    draft,
    requestStatus
  );
}

export function pharmacistRequestCatalogProductBlockMessageFr(
  requestStatus: string | null | undefined
): string {
  if (requestStatus != null && ["confirmed", "treated"].includes(requestStatus)) {
    return "Ce produit est déjà sur une ligne encore retenue et non retirée, ou en alternative sur une telle ligne. Retirez l’autre occurrence, ou choisissez une autre référence.";
  }
  return "Ce produit figure déjà sur la réponse (ligne principale ou alternative encore retenue). Choisissez une autre référence, ou réutilisez-le seulement si l’autre ligne est non retenue ou retirée.";
}

/** Clés source:id déjà occupées sur le dossier. */
export function occupiedCatalogRefKeysFromRows(
  rows: readonly PharmacistRequestCatalogBlockRow[],
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>,
  requestStatus?: string | null
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!pharmacistRequestLineProductOccupancyBlocks(row, draft, requestStatus)) continue;
    const rowRef = catalogLineRefFromRow(row);
    if (rowRef) keys.add(catalogLineRefKey(rowRef));
    for (const alt of normalizeAlternatives(row.request_item_alternatives)) {
      const altRef = catalogLineRefFromAlt(alt);
      if (altRef) keys.add(catalogLineRefKey(altRef));
    }
  }
  return keys;
}
