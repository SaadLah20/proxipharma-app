"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/** Charge le nom d’officine ; RLS pilote renvoie vide si pharmacie non accessible. */
export function usePharmacyPublicGate(pharmacyId: string, enabled: boolean) {
  const [pharmacyName, setPharmacyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!pharmacyId || !enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setUnavailable(false);

    const { data, error } = await supabase
      .from("pharmacies")
      .select("nom")
      .eq("id", pharmacyId)
      .maybeSingle();

    if (error || !data?.nom) {
      setPharmacyName("");
      setUnavailable(true);
    } else {
      setPharmacyName(data.nom);
      setUnavailable(false);
    }
    setLoading(false);
  }, [pharmacyId, enabled]);

  useEffect(() => {
    if (!pharmacyId || !enabled) return;
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load, pharmacyId, enabled]);

  return { pharmacyName, loading, unavailable };
}
