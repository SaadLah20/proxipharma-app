/** Filtre type catalogue patient (explorateur). */
export type ProductCatalogTypeFilter = "all" | "parapharmacie" | "medicament";

export type ProductCatalogExplorerFilters = {
  productType: ProductCatalogTypeFilter;
  /** Libellé marque affiché (colonne `products.brand`, correspond au picker). */
  brand: string | null;
};

export const PRODUCT_CATALOG_TYPE_FILTERS: ProductCatalogTypeFilter[] = [
  "all",
  "parapharmacie",
  "medicament",
];

export function defaultProductCatalogExplorerFilters(): ProductCatalogExplorerFilters {
  return { productType: "all", brand: null };
}

export function productCatalogFiltersKey(filters: ProductCatalogExplorerFilters): string {
  return `${filters.productType}|${filters.brand?.trim() ?? ""}`;
}

export function brandFilterApplicable(productType: ProductCatalogTypeFilter): boolean {
  return productType !== "medicament";
}
