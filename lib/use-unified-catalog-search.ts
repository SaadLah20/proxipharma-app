"use client";

import { useEffect, useState } from "react";
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
  const [hits, setHits] = useState<UnifiedCatalogHit[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDebouncedQuery("");
      return;
    }
    const tid = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(tid);
  }, [query, enabled]);

  useEffect(() => {
    if (!enabled || !pharmacyId) {
      setHits([]);
      setLoading(false);
      return;
    }

    const sanitized = sanitizeProductSearchQuery(debouncedQuery);
    if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
      setHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
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

    return () => {
      cancelled = true;
    };
  }, [pharmacyId, debouncedQuery, enabled]);

  return { hits, debouncedQuery, loading };
}
