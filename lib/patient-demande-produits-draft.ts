/**
 * Brouillon panier « demande produits » patient (sessionStorage), partagé entre
 * la page principale et le catalogue complet.
 */

export type PatientDemandeProduitsDraftLine = {
  product_id: string;
  name: string;
  photo_url: string | null;
  qty: number;
  /** Prix unitaire officine (source de vérité affichage / total). */
  unit_price?: number | null;
  /** @deprecated Ancien brouillon — migré vers unit_price à la lecture. */
  price_pph?: number | null;
  client_comment?: string;
};

export function draftLineUnitPrice(line: PatientDemandeProduitsDraftLine): number | null {
  if (line.unit_price != null && !Number.isNaN(Number(line.unit_price))) {
    return Number(line.unit_price);
  }
  if (line.price_pph != null && !Number.isNaN(Number(line.price_pph))) {
    return Number(line.price_pph);
  }
  return null;
}

export type PatientDemandeProduitsCatalogProduct = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
};

function draftKey(pharmacyId: string, requestId?: string): string {
  if (requestId) return `proxipharma:edit-request-lines:${requestId}`;
  return `proxipharma:demande-produits:${pharmacyId}`;
}

const catalogueReturnEditKey = (requestId: string) => `proxipharma:catalogue-return-edit:${requestId}`;

/** À appeler après ajout depuis le catalogue en modification d’une demande existante. */
export function markPatientDemandeCatalogueReturnEdit(requestId: string): void {
  if (typeof window === "undefined" || !requestId) return;
  try {
    sessionStorage.setItem(catalogueReturnEditKey(requestId), "1");
  } catch {
    /* quota / mode privé */
  }
}

export function peekPatientDemandeCatalogueReturnEdit(requestId: string): boolean {
  if (typeof window === "undefined" || !requestId) return false;
  try {
    return sessionStorage.getItem(catalogueReturnEditKey(requestId)) === "1";
  } catch {
    return false;
  }
}

export function clearPatientDemandeCatalogueReturnEdit(requestId: string): void {
  if (typeof window === "undefined" || !requestId) return;
  try {
    sessionStorage.removeItem(catalogueReturnEditKey(requestId));
  } catch {
    /* ignore */
  }
}

export function readPatientDemandeProduitsDraft(
  pharmacyId: string,
  requestId?: string
): PatientDemandeProduitsDraftLine[] {
  if (typeof window === "undefined" || !pharmacyId) return [];
  try {
    const raw = sessionStorage.getItem(draftKey(pharmacyId, requestId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is PatientDemandeProduitsDraftLine =>
        row != null &&
        typeof row === "object" &&
        typeof (row as PatientDemandeProduitsDraftLine).product_id === "string" &&
        typeof (row as PatientDemandeProduitsDraftLine).name === "string" &&
        typeof (row as PatientDemandeProduitsDraftLine).qty === "number"
    );
  } catch {
    return [];
  }
}

export function writePatientDemandeProduitsDraft(
  pharmacyId: string,
  lines: PatientDemandeProduitsDraftLine[],
  requestId?: string
): void {
  if (typeof window === "undefined" || !pharmacyId) return;
  try {
    sessionStorage.setItem(draftKey(pharmacyId, requestId), JSON.stringify(lines));
  } catch {
    /* quota / mode privé */
  }
}

export function clearPatientDemandeProduitsDraft(pharmacyId: string, requestId?: string): void {
  if (typeof window === "undefined" || !pharmacyId) return;
  try {
    sessionStorage.removeItem(draftKey(pharmacyId, requestId));
  } catch {
    /* ignore */
  }
}

/** Map brouillon → lignes édition resubmit (composant patient). */
export function draftLineToResubmitLine(line: PatientDemandeProduitsDraftLine): PatientDemandeProduitsDraftLine & {
  client_comment: string;
} {
  return {
    ...line,
    client_comment: line.client_comment ?? "",
  };
}

export function mergeCatalogProductsIntoDraft(
  existing: PatientDemandeProduitsDraftLine[],
  products: PatientDemandeProduitsCatalogProduct[],
  resolvePhoto: (url: string | null | undefined) => string | null,
  resolveUnitPrice?: (p: PatientDemandeProduitsCatalogProduct) => number | null
): PatientDemandeProduitsDraftLine[] {
  const inCart = new Set(existing.map((l) => l.product_id));
  const added: PatientDemandeProduitsDraftLine[] = [];
  for (const p of products) {
    if (inCart.has(p.id)) continue;
    inCart.add(p.id);
    added.push({
      product_id: p.id,
      name: p.name,
      photo_url: resolvePhoto(p.photo_url),
      qty: 1,
      unit_price: resolveUnitPrice?.(p) ?? p.price_pph ?? null,
    });
  }
  return [...existing, ...added];
}

/** Filtre local nom / laboratoire (catalogue complet). */
export function filterCatalogProductsLocal(
  products: PatientDemandeProduitsCatalogProduct[],
  query: string
): PatientDemandeProduitsCatalogProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => {
    const name = p.name.toLowerCase();
    const lab = (p.laboratory ?? "").toLowerCase();
    return name.includes(q) || lab.includes(q);
  });
}
