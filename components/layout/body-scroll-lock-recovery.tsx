"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { resetBodyScrollLock } from "@/lib/ui-body-scroll-lock";

/** Rétablit le scroll page après changement de route si un lock modale est resté accroché. */
export function BodyScrollLockRecovery() {
  const pathname = usePathname();

  useEffect(() => {
    resetBodyScrollLock();
  }, [pathname]);

  return null;
}
