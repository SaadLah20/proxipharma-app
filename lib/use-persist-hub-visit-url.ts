"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { saveHubLastVisitUrl } from "@/lib/hub-last-visit-url";

/** Enregistre la vue hub courante (onglet + filtres URL) pour restauration via le footer. */
export function usePersistHubVisitUrl(hubBasePath: string): void {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    saveHubLastVisitUrl(hubBasePath, pathname, searchParams.toString());
  }, [hubBasePath, pathname, searchParams]);
}
