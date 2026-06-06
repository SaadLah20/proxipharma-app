"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PatientDemandeProduitsCatalogProduct } from "@/lib/patient-demande-produits-draft";
import {
  defaultProductCatalogExplorerFilters,
  productCatalogFiltersKey,
  type ProductCatalogExplorerFilters,
} from "@/lib/product-catalog-filters";
import {
  PRODUCT_CATALOG_EXPLORER_PAGE_SIZE,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  PRODUCT_CATALOG_SELECT,
  productBrandDisplayIlikePattern,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";

const CATALOG_SELECT = PRODUCT_CATALOG_SELECT;

export function useProductCatalogExplorer(
  enabled: boolean,
  filterQuery: string,
  filters: ProductCatalogExplorerFilters = defaultProductCatalogExplorerFilters(),
) {
  const [products, setProducts] = useState<PatientDemandeProduitsCatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const queryKeyRef = useRef("");
  const fetchInFlightRef = useRef(false);

  const filtersKey = productCatalogFiltersKey(filters);

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!enabled) return;

      const sanitized = sanitizeProductSearchQuery(filterQuery);
      const queryKey = `${sanitized}|${filtersKey}`;

      if (reset) {
        offsetRef.current = 0;
        queryKeyRef.current = queryKey;
        setLoading(true);
        setError(null);
        setHasMore(true);
        fetchInFlightRef.current = true;
      } else {
        if (queryKeyRef.current !== queryKey) return;
        if (fetchInFlightRef.current) return;
        setLoadingMore(true);
        fetchInFlightRef.current = true;
      }

      const from = reset ? 0 : offsetRef.current;
      const to = from + PRODUCT_CATALOG_EXPLORER_PAGE_SIZE - 1;

      let q = supabase
        .from("products")
        .select(CATALOG_SELECT)
        .eq("is_active", true)
        .order("name");

      if (filters.productType !== "all") {
        q = q.eq("product_type", filters.productType);
      }

      const brandPattern = filters.brand ? productBrandDisplayIlikePattern(filters.brand) : null;
      if (brandPattern) {
        q = q.ilike("brand", brandPattern);
      }

      if (sanitized.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
        q = q.or(productNameOrLaboratoryIlikeOr(sanitized));
      }

      const { data, error: fetchErr } = await q.range(from, to);

      if (queryKeyRef.current !== queryKey) {
        setLoadingMore(false);
        fetchInFlightRef.current = false;
        return;
      }

      if (fetchErr) {
        setError(fetchErr.message);
        if (reset) setProducts([]);
        setLoading(false);
        setLoadingMore(false);
        setHasMore(false);
        fetchInFlightRef.current = false;
        return;
      }

      const rows = (data as PatientDemandeProduitsCatalogProduct[]) ?? [];

      if (reset) {
        setProducts(rows);
        setLoading(false);
      } else {
        setProducts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...rows.filter((p) => !seen.has(p.id))];
        });
        setLoadingMore(false);
      }

      offsetRef.current = from + rows.length;
      setHasMore(rows.length >= PRODUCT_CATALOG_EXPLORER_PAGE_SIZE);
      fetchInFlightRef.current = false;
    },
    [enabled, filterQuery, filters, filtersKey],
  );

  useEffect(() => {
    if (!enabled) return;
    const debounceMs = filterQuery.trim().length > 0 ? 300 : 0;
    const timer = window.setTimeout(() => void fetchPage(true), debounceMs);
    return () => window.clearTimeout(timer);
  }, [enabled, filterQuery, filtersKey, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || fetchInFlightRef.current) return;
    void fetchPage(false);
  }, [loading, loadingMore, hasMore, fetchPage]);

  return { products, loading, loadingMore, error, hasMore, loadMore };
}
