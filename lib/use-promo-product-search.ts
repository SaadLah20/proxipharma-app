"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { PromoCatalogProduct } from "@/lib/promo/catalog";
import {
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  PRODUCT_CATALOG_SELECT,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";

export const PROMO_PRODUCT_SEARCH_PAGE_SIZE = 48;

export function usePromoProductSearch(query: string, enabled = true) {
  const [products, setProducts] = useState<PromoCatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const queryKeyRef = useRef("");
  const fetchInFlightRef = useRef(false);

  const sanitized = sanitizeProductSearchQuery(query);
  const searchActive = enabled && sanitized.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS;

  const fetchPage = useCallback(
    async (reset: boolean) => {
      if (!searchActive) {
        if (reset) {
          setProducts([]);
          setLoading(false);
          setLoadingMore(false);
          setHasMore(false);
          setError(null);
        }
        return;
      }

      const queryKey = sanitized;

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
      const to = from + PROMO_PRODUCT_SEARCH_PAGE_SIZE - 1;

      const { data, error: fetchErr } = await supabase
        .from("products")
        .select(PRODUCT_CATALOG_SELECT)
        .eq("is_active", true)
        .or(productNameOrLaboratoryIlikeOr(sanitized))
        .order("name")
        .range(from, to);

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

      const rows = (data as PromoCatalogProduct[]) ?? [];

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
      setHasMore(rows.length >= PROMO_PRODUCT_SEARCH_PAGE_SIZE);
      fetchInFlightRef.current = false;
    },
    [sanitized, searchActive],
  );

  useEffect(() => {
    if (!searchActive) {
      setProducts([]);
      setLoading(false);
      setLoadingMore(false);
      setHasMore(false);
      setError(null);
      return;
    }
    const timer = window.setTimeout(() => void fetchPage(true), 300);
    return () => window.clearTimeout(timer);
  }, [searchActive, sanitized, fetchPage]);

  const loadMore = useCallback(() => {
    if (!searchActive || loading || loadingMore || !hasMore || fetchInFlightRef.current) return;
    void fetchPage(false);
  }, [searchActive, loading, loadingMore, hasMore, fetchPage]);

  return { products, loading, loadingMore, error, hasMore, loadMore, searchActive, minChars: PRODUCT_CATALOG_SEARCH_MIN_CHARS };
}
