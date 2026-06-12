"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_CATALOG_SEARCH_MIN_CHARS, sanitizeProductSearchQuery } from "@/lib/product-catalog-search";
import { searchPharmacyCatalog } from "@/lib/pharmacy-catalog-search";
import type { UnifiedCatalogHit } from "@/lib/pharmacy-catalog-types";

const SEARCH_DEBOUNCE_MS = 280;

/** Recherche catalogue unifiée (global + privé officine) avec debounce. */
export function useUnifiedCatalogSearch(
  pharmacyId: string | null | undefined,
  query: string,
  enabled: boolean
) {
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [hits, setHits] = useState<UnifiedCatalogHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const tid = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(tid);
  }, [query, enabled]);

  const activeDebouncedQuery = enabled ? debouncedQuery : "";
  const sanitized = useMemo(
    () => sanitizeProductSearchQuery(activeDebouncedQuery),
    [activeDebouncedQuery]
  );
  const searchActive =
    enabled &&
    Boolean(pharmacyId) &&
    sanitized.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS;

  useEffect(() => {
    if (!searchActive || !pharmacyId) return;

    let cancelled = false;
    const tid = window.setTimeout(() => {
      setLoading(true);
      void (async () => {
        try {
          const data = await searchPharmacyCatalog(supabase, pharmacyId, sanitized);
          if (!cancelled) setHits(data);
        } catch {
          if (!cancelled) setHits([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [pharmacyId, sanitized, searchActive]);

  return {
    hits: searchActive ? hits : [],
    debouncedQuery: activeDebouncedQuery,
    loading: searchActive && loading,
  };
}
