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

/** Hub unifié : tous les types de dossier surlignent l’onglet Demandes / Mes demandes. */
export function requestTypeToBottomNavTabId(_requestType: string | null | undefined): BottomNavTabId | null {
  return "requests";
}

export function PlatformBottomNavDossierTabProvider({ children }: { children: ReactNode }) {
  const [dossierTabId, setDossierTabId] = useState<BottomNavTabId | null>(null);
  const value = useMemo(() => ({ dossierTabId, setDossierTabId }), [dossierTabId]);
  return <BottomNavDossierTabContext.Provider value={value}>{children}</BottomNavDossierTabContext.Provider>;
}

export function useBottomNavDossierTab() {
  return useContext(BottomNavDossierTabContext);
}

/** Aligne l’onglet footer sur le hub demandes unifié. */
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
