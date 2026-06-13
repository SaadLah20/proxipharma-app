"use client";

import { createContext, useContext, type ReactNode } from "react";

const PatientHubCatalogPriceVisibilityContext = createContext<Record<string, boolean>>({});

export function PatientHubCatalogPriceVisibilityProvider({
  visibilityByPharmacyId,
  children,
}: {
  visibilityByPharmacyId: Record<string, boolean>;
  children: ReactNode;
}) {
  return (
    <PatientHubCatalogPriceVisibilityContext.Provider value={visibilityByPharmacyId}>
      {children}
    </PatientHubCatalogPriceVisibilityContext.Provider>
  );
}

/** Préférence officine brute (true = afficher les prix catalogue avant réponse). Défaut true. */
export function usePharmacyCatalogPriceShowFlag(pharmacyId: string | null | undefined): boolean {
  const map = useContext(PatientHubCatalogPriceVisibilityContext);
  if (!pharmacyId) return true;
  return map[pharmacyId] ?? true;
}
