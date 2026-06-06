"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchDistinctParapharmacyBrands,
  type DistinctBrandRow,
} from "@/lib/pharmacy-pricing/api";

export function useCatalogDistinctBrands(enabled: boolean) {
  const [brands, setBrands] = useState<DistinctBrandRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await fetchDistinctParapharmacyBrands(supabase);
        if (!cancelled) setBrands(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Erreur chargement marques");
          setBrands([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { brands, loading, error };
}
