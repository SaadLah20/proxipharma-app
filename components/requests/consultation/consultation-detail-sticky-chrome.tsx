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
        "sticky top-0 z-30 -mx-0.5 space-y-2 bg-slate-50/95 pb-2 pt-0.5 backdrop-blur-sm supports-[backdrop-filter]:bg-slate-50/85 sm:-mx-0",
        className
      )}
    >
      {children}
    </div>
  );
}
