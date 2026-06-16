import type { CatalogProductReportFieldKey } from "@/lib/catalog-product-report-types";

export const CATALOG_PRODUCT_REPORT_FIELD_KEYS: CatalogProductReportFieldKey[] = [
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

export function catalogProductReportFieldLabelFr(key: CatalogProductReportFieldKey): string {
  switch (key) {
    case "name":
      return "Nom";
    case "product_type":
      return "Type";
    case "price_pph":
      return "PPH";
    case "price_ppv":
      return "PPV";
    case "brand":
      return "Marque";
    case "laboratory":
      return "Laboratoire";
    case "form":
      return "Forme";
    case "category":
      return "Catégorie";
    case "subcategory":
      return "Sous-catégorie";
    case "photo_url":
      return "Photo";
    case "short_description":
      return "Description courte";
    case "full_description":
      return "Description complète";
    case "usage":
      return "Usage";
    case "advice":
      return "Conseil";
    default:
      return key;
  }
}

export function catalogProductReportFieldPlaceholderFr(key: CatalogProductReportFieldKey): string {
  switch (key) {
    case "name":
      return "Nom corrigé…";
    case "product_type":
      return "medicament ou parapharmacie";
    case "price_pph":
    case "price_ppv":
      return "ex. 45,00 DH";
    case "photo_url":
      return "URL ou description de la photo correcte…";
    default:
      return "Valeur corrigée ou commentaire…";
  }
}
