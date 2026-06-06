"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchPharmacistPricingConfig, fetchPharmacyPricingConfigPublic } from "./api";
import { resolveLineUnitPrice, resolvePharmacyUnitPrice } from "./resolve";
import type { PharmacyPricingConfig, ProductPricingInput } from "./types";

export function usePharmacyPricing(pharmacyId: string | undefined) {
  const [config, setConfig] = useState<PharmacyPricingConfig | null>(null);
  const [loading, setLoading] = useState(Boolean(pharmacyId));

  const reload = useCallback(async () => {
    if (!pharmacyId) {
      setConfig(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const row = await fetchPharmacistPricingConfig(supabase);
      if (row && row.pharmacy_id === pharmacyId) {
        setConfig(row);
      } else if (row) {
        setConfig(row);
      } else {
        setConfig({
          pharmacy_id: pharmacyId,
          settings: { parapharmacy_mode: "at_pph", parapharmacy_margin_pct: 0 },
          brand_rules: [],
          product_overrides: [],
        });
      }
    } catch {
      setConfig({
        pharmacy_id: pharmacyId,
        settings: { parapharmacy_mode: "at_pph", parapharmacy_margin_pct: 0 },
        brand_rules: [],
        product_overrides: [],
      });
    } finally {
      setLoading(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    const tid = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(tid);
  }, [reload]);

  const resolve = useCallback(
    (product: ProductPricingInput | null | undefined) => resolvePharmacyUnitPrice(config, product),
    [config]
  );

  const resolveLine = useCallback(
    (
      product: ProductPricingInput | null | undefined,
      unitPriceOnLine?: number | null
    ) => resolveLineUnitPrice(config, product, unitPriceOnLine),
    [config]
  );

  return useMemo(
    () => ({ config, loading, reload, resolve, resolveLine }),
    [config, loading, reload, resolve, resolveLine]
  );
}

/** Charge la config pricing pour une officine (parcours patient / catalogue public). */
export function usePharmacyPricingForPatient(pharmacyId: string | undefined) {
  const [config, setConfig] = useState<PharmacyPricingConfig | null>(null);
  const [loading, setLoading] = useState(Boolean(pharmacyId));

  useEffect(() => {
    if (!pharmacyId) {
      const tid = window.setTimeout(() => {
        setConfig(null);
        setLoading(false);
      }, 0);
      return () => window.clearTimeout(tid);
    }
    let cancelled = false;
    const loadingTid = window.setTimeout(() => setLoading(true), 0);
    void (async () => {
      try {
        const row = await fetchPharmacyPricingConfigPublic(supabase, pharmacyId);
        if (cancelled) return;
        if (!row) {
          setConfig({
            pharmacy_id: pharmacyId,
            settings: { parapharmacy_mode: "at_pph", parapharmacy_margin_pct: 0 },
            brand_rules: [],
            product_overrides: [],
          });
          return;
        }
        setConfig(row);
      } catch {
        if (!cancelled) {
          setConfig({
            pharmacy_id: pharmacyId,
            settings: { parapharmacy_mode: "at_pph", parapharmacy_margin_pct: 0 },
            brand_rules: [],
            product_overrides: [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTid);
    };
  }, [pharmacyId]);

  const resolve = useCallback(
    (product: ProductPricingInput | null | undefined) => resolvePharmacyUnitPrice(config, product),
    [config]
  );

  return useMemo(() => ({ config, loading, resolve }), [config, loading, resolve]);
}
