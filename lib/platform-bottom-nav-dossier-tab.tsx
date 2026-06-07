"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BottomNavTabId } from "@/lib/platform-bottom-nav";

type BottomNavDossierTabContextValue = {
  dossierTabId: BottomNavTabId | null;
  setDossierTabId: (tabId: BottomNavTabId | null) => void;
};

const BottomNavDossierTabContext = createContext<BottomNavDossierTabContextValue>({
  dossierTabId: null,
  setDossierTabId: () => {},
});

export function requestTypeToBottomNavTabId(requestType: string | null | undefined): BottomNavTabId | null {
  if (!requestType || requestType === "product_request") return "products";
  if (requestType === "prescription") return "prescriptions";
  if (requestType === "free_consultation") return "consultations";
  return null;
}

export function PlatformBottomNavDossierTabProvider({ children }: { children: ReactNode }) {
  const [dossierTabId, setDossierTabId] = useState<BottomNavTabId | null>(null);
  const value = useMemo(() => ({ dossierTabId, setDossierTabId }), [dossierTabId]);
  return <BottomNavDossierTabContext.Provider value={value}>{children}</BottomNavDossierTabContext.Provider>;
}

export function useBottomNavDossierTab() {
  return useContext(BottomNavDossierTabContext);
}

/** Aligne l’onglet footer sur le type de dossier (ordonnance, consultation, produits). */
export function useSyncBottomNavDossierTab(requestType: string | null | undefined): void {
  const { setDossierTabId } = useBottomNavDossierTab();

  useEffect(() => {
    setDossierTabId(requestTypeToBottomNavTabId(requestType));
    return () => setDossierTabId(null);
  }, [requestType, setDossierTabId]);
}

/** Aligne l’onglet footer sur une section hub (ex. packs promo). */
export function useSyncBottomNavTab(tabId: BottomNavTabId | null): void {
  const { setDossierTabId } = useBottomNavDossierTab();

  useEffect(() => {
    setDossierTabId(tabId);
    return () => setDossierTabId(null);
  }, [tabId, setDossierTabId]);
}
