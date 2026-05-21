/** Brouillon officine : retrait / écart post-validation. */
export type PharmacistRequestCatalogBlockDraft = {
  withdrawn_after_confirm?: boolean | null;
};

export type PharmacistRequestCatalogBlockAlt = {
  product_id: string;
};

/** Ligne demande (principale + alternatives embarquées). */
export type PharmacistRequestCatalogBlockRow = {
  id: string;
  product_id: string;
  is_selected_by_patient: boolean;
  withdrawn_after_confirm?: boolean | null;
  request_item_alternatives?:
    | ReadonlyArray<PharmacistRequestCatalogBlockAlt>
    | PharmacistRequestCatalogBlockAlt
    | null;
};

function normalizeAlternatives(
  raw: PharmacistRequestCatalogBlockRow["request_item_alternatives"]
): PharmacistRequestCatalogBlockAlt[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return Array.from(raw);
  const single = raw as PharmacistRequestCatalogBlockAlt;
  return [{ product_id: single.product_id }];
}

function effectiveWithdrawnAfterConfirm(
  row: PharmacistRequestCatalogBlockRow,
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>
): boolean {
  const fd = draft?.[row.id];
  return Boolean(row.withdrawn_after_confirm) || Boolean(fd?.withdrawn_after_confirm);
}

/**
 * Une occurrence de `product_id` bloque un nouvel ajout (proposé ou alternative)
 * tant que la ligne parente est encore **retenue** à la validation initiale
 * (`is_selected_by_patient`) et **non écartée** (`withdrawn_after_confirm`).
 */
export function pharmacistRequestLineProductOccupancyBlocks(
  row: PharmacistRequestCatalogBlockRow,
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>
): boolean {
  return Boolean(row.is_selected_by_patient) && !effectiveWithdrawnAfterConfirm(row, draft);
}

/** `true` si le produit catalogue est déjà présent sur une ligne/alternative encore bloquante. */
export function pharmacistRequestCatalogProductIdBlocked(
  productId: string,
  rows: readonly PharmacistRequestCatalogBlockRow[],
  draft?: Record<string, PharmacistRequestCatalogBlockDraft | undefined>
): boolean {
  for (const row of rows) {
    if (row.product_id === productId && pharmacistRequestLineProductOccupancyBlocks(row, draft)) {
      return true;
    }
    for (const alt of normalizeAlternatives(row.request_item_alternatives)) {
      if (alt.product_id === productId && pharmacistRequestLineProductOccupancyBlocks(row, draft)) {
        return true;
      }
    }
  }
  return false;
}

export function pharmacistRequestCatalogProductBlockMessageFr(
  requestStatus: string | null | undefined
): string {
  if (requestStatus != null && ["confirmed", "treated"].includes(requestStatus)) {
    return "Ce produit est déjà sur une ligne encore retenue et non écartée, ou en alternative sur une telle ligne. Écartez ou retirez l’autre occurrence, ou choisissez une autre référence.";
  }
  return "Ce produit figure déjà sur la réponse (ligne principale ou alternative encore retenue). Choisissez une autre référence, ou réutilisez-le seulement si l’autre ligne est non retenue ou écartée.";
}
