"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { pharmacistProductRequestDossierSectionShellClass } from "@/lib/pharmacist-product-request-line-ui";

/** Contour dossier sky — regroupe bandeau, lignes et actions (demandes produits pharmacien). */
export function PharmacistProductRequestDossierShell({
  active,
  className,
  children,
}: {
  active: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!active) {
    return <>{children}</>;
  }

  return (
    <section
      className={clsx(
        "touch-pan-y w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border-2 p-2.5 sm:p-3",
        pharmacistProductRequestDossierSectionShellClass,
        className,
      )}
    >
      {children}
    </section>
  );
}
