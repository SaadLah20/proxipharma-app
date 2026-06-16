import type { CatalogProductReportFieldKey, CatalogProductReportSnapshot } from "@/lib/catalog-product-report-types";

export type CatalogNationalProductFormValues = {
  name: string;
  product_type: "medicament" | "parapharmacie";
  price_pph: string;
  price_ppv: string;
  brand: string;
  laboratory: string;
  form: string;
  category: string;
  subcategory: string;
  photo_url: string;
  short_description: string;
  full_description: string;
  usage: string;
  advice: string;
};

export const CATALOG_NATIONAL_PRODUCT_FORM_FIELD_ORDER: CatalogProductReportFieldKey[] = [
  "name",
  "product_type",
  "price_pph",
  "price_ppv",
  "brand",
  "laboratory",
  "form",
  "category",
  "subcategory",
  "photo_url",
  "short_description",
  "full_description",
  "usage",
  "advice",
];

function snapshotString(snapshot: CatalogProductReportSnapshot, key: string): string {
  const raw = snapshot[key];
  if (raw == null) return "";
  if (typeof raw === "number") return String(raw);
  return String(raw);
}

export function catalogNationalProductFormFromSnapshot(
  snapshot: CatalogProductReportSnapshot
): CatalogNationalProductFormValues {
  return {
    name: snapshotString(snapshot, "name"),
    product_type: (snapshotString(snapshot, "product_type") || "parapharmacie") as CatalogNationalProductFormValues["product_type"],
    price_pph: snapshotString(snapshot, "price_pph"),
    price_ppv: snapshotString(snapshot, "price_ppv"),
    brand: snapshotString(snapshot, "brand"),
    laboratory: snapshotString(snapshot, "laboratory"),
    form: snapshotString(snapshot, "form"),
    category: snapshotString(snapshot, "category"),
    subcategory: snapshotString(snapshot, "subcategory"),
    photo_url: snapshotString(snapshot, "photo_url"),
    short_description: snapshotString(snapshot, "short_description"),
    full_description: snapshotString(snapshot, "full_description"),
    usage: snapshotString(snapshot, "usage"),
    advice: snapshotString(snapshot, "advice"),
  };
}

export function catalogNationalProductFormToRpcPayload(values: CatalogNationalProductFormValues): Record<string, string | null> {
  const trim = (s: string) => {
    const t = s.trim();
    return t || null;
  };

  return {
    name: values.name.trim(),
    product_type: values.product_type,
    price_pph: trim(values.price_pph),
    price_ppv: trim(values.price_ppv),
    brand: trim(values.brand),
    laboratory: trim(values.laboratory),
    form: trim(values.form),
    category: trim(values.category),
    subcategory: trim(values.subcategory),
    photo_url: trim(values.photo_url),
    short_description: trim(values.short_description),
    full_description: trim(values.full_description),
    usage: trim(values.usage),
    advice: trim(values.advice),
  };
}

export function validateCatalogNationalProductForm(values: CatalogNationalProductFormValues): string | null {
  if (!values.name.trim()) return "Le nom est obligatoire.";
  if (values.product_type === "parapharmacie" && !values.price_pph.trim()) {
    return "Le PPH est obligatoire pour la parapharmacie.";
  }
  if (values.product_type === "medicament" && !values.price_ppv.trim()) {
    return "Le PPV est obligatoire pour les médicaments.";
  }
  return null;
}

export function catalogReportModalFooterClassName() {
  return "flex shrink-0 flex-col-reverse gap-2 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-4";
}

export function catalogReportModalCancelBtnClassName() {
  return "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted/50 sm:h-8";
}

export function catalogReportModalPrimaryBtnClassName() {
  return "inline-flex h-9 min-w-0 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-50 sm:h-8 sm:max-w-[11rem]";
}
