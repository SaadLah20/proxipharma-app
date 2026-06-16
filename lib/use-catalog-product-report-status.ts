"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchActiveCatalogProductReports } from "@/lib/catalog-product-report-api";
import type { ActiveCatalogProductReportSummary } from "@/lib/catalog-product-report-types";
import { useCatalogProductReportRefresh } from "@/lib/catalog-product-report-status-provider";
import { supabase } from "@/lib/supabase";

function stableUniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))].sort();
}

export function useCatalogProductReportStatus(productIds: string[], refreshKeyOverride?: number) {
  const { refreshKey: contextRefreshKey } = useCatalogProductReportRefresh();
  const refreshKey = refreshKeyOverride ?? contextRefreshKey;
  const [map, setMap] = useState<Map<string, ActiveCatalogProductReportSummary>>(new Map());
  const [loading, setLoading] = useState(false);
  const idsKey = useMemo(() => stableUniqueIds(productIds).join(","), [productIds]);
  const requestSeq = useRef(0);

  const reload = useCallback(async () => {
    const ids = stableUniqueIds(productIds);
    if (ids.length === 0) {
      setMap(new Map());
      return;
    }

    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const rows = await fetchActiveCatalogProductReports(supabase, ids);
      if (seq !== requestSeq.current) return;
      const next = new Map<string, ActiveCatalogProductReportSummary>();
      for (const row of rows) {
        next.set(row.product_id, row);
      }
      setMap(next);
    } catch {
      if (seq !== requestSeq.current) return;
      setMap(new Map());
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [productIds]);

  useEffect(() => {
    const tid = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(tid);
  }, [reload, idsKey, refreshKey]);

  const getActiveReport = useCallback(
    (productId: string) => map.get(productId) ?? null,
    [map]
  );

  return { map, loading, reload, getActiveReport };
}
