"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { pharmacistDossierShellContentGapClass } from "@/lib/pharmacist-product-dossier-shell";
import { pharmacistProductRequestDossierSectionShellClass } from "@/lib/pharmacist-product-request-line-ui";

/** Contour dossier workflow — regroupe bandeau, lignes et actions (produits / ordonnances pharmacien). */
export function PharmacistProductRequestDossierShell({
  active,
  className,
  sectionShellClass = pharmacistProductRequestDossierSectionShellClass,
  children,
}: {
  active: boolean;
  className?: string;
  sectionShellClass?: string;
  children: ReactNode;
}) {
  if (!active) {
    return <>{children}</>;
  }

  return (
    <section
      className={clsx(
        "touch-pan-y w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border-2 p-2.5 sm:p-3",
        pharmacistDossierShellContentGapClass,
        sectionShellClass,
        className,
      )}
    >
      {children}
    </section>
  );
}
