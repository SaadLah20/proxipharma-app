/** Source d'un hit catalogue unifié (global Pharmeto ou privé officine). */
export type CatalogProductSource = "global" | "pharmacy";

export type PharmacyCatalogProductStatus = "active" | "unpublished" | "archived_published" | "archived_hidden";

export type UnifiedCatalogHit = {
  source: CatalogProductSource;
  id: string;
  name: string;
  product_type: string;
  brand: string | null;
  laboratory: string | null;
  photo_url: string | null;
  price_pph: number | null;
  price_ppv: number | null;
  full_description: string | null;
};

export type PharmacyCatalogProductRow = {
  id: string;
  pharmacy_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  name: string;
  product_type: "medicament" | "parapharmacie";
  price_pph: number | null;
  price_ppv: number | null;
  brand: string | null;
  laboratory: string | null;
  photo_url: string | null;
  short_description: string | null;
  full_description: string | null;
  form: string | null;
  category: string | null;
  subcategory: string | null;
  status: PharmacyCatalogProductStatus;
  promoted_product_id: string | null;
  promoted_at: string | null;
};

export type PharmacyCatalogProductFormValues = {
  name: string;
  product_type: "medicament" | "parapharmacie";
  price_pph: string;
  price_ppv: string;
  brand: string;
  laboratory: string;
  photo_url: string;
  short_description: string;
  full_description: string;
};

export function catalogHitKey(hit: { source: CatalogProductSource; id: string }): string {
  return `${hit.source}:${hit.id}`;
}

export function parseCatalogHitKey(key: string): { source: CatalogProductSource; id: string } | null {
  const idx = key.indexOf(":");
  if (idx <= 0) return null;
  const source = key.slice(0, idx) as CatalogProductSource;
  if (source !== "global" && source !== "pharmacy") return null;
  return { source, id: key.slice(idx + 1) };
}

export function emptyPharmacyCatalogProductForm(prefillName = ""): PharmacyCatalogProductFormValues {
  return {
    name: prefillName,
    product_type: "parapharmacie",
    price_pph: "",
    price_ppv: "",
    brand: "",
    laboratory: "",
    photo_url: "",
    short_description: "",
    full_description: "",
  };
}

export function pharmacyCatalogStatusLabelFr(status: PharmacyCatalogProductStatus): string {
  switch (status) {
    case "active":
      return "Privé";
    case "unpublished":
      return "Dépublié";
    case "archived_published":
      return "Archivé (catalogue national)";
    case "archived_hidden":
      return "Masqué";
    default:
      return status;
  }
}
