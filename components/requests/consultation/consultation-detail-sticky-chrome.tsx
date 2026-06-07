"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";

/** En-tête consultation (récap dossier + onglets) figé en haut au scroll, comme les autres parcours. */
export function ConsultationDetailStickyChrome({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "sticky top-0 z-30 space-y-2 bg-violet-50/75 pb-2 pt-0.5 backdrop-blur-sm supports-[backdrop-filter]:bg-violet-50/65",
        className
      )}
    >
      {children}
    </div>
  );
}
