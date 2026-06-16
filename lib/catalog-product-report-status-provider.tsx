"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type CatalogProductReportStatusContextValue = {
  refreshKey: number;
  bumpRefresh: () => void;
};

const CatalogProductReportStatusRefreshContext = createContext<CatalogProductReportStatusContextValue>({
  refreshKey: 0,
  bumpRefresh: () => {},
});

export function CatalogProductReportStatusRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const value = useMemo(() => ({ refreshKey, bumpRefresh }), [refreshKey, bumpRefresh]);
  return (
    <CatalogProductReportStatusRefreshContext.Provider value={value}>
      {children}
    </CatalogProductReportStatusRefreshContext.Provider>
  );
}

export function useCatalogProductReportRefresh() {
  return useContext(CatalogProductReportStatusRefreshContext);
}
