"use client";

import { clsx } from "clsx";

/** Bandeau « X résultats » au-dessus de la liste filtrée (hub demandes produits). */
export function ProductHubListResultsBar({
  filteredCount,
  totalCount,
  className,
}: {
  filteredCount: number;
  totalCount: number;
  className?: string;
}) {
  const filtered = filteredCount !== totalCount;
  return (
    <p
      className={clsx(
        "rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] font-semibold tabular-nums text-foreground",
        className
      )}
      role="status"
    >
      {filteredCount === 0
        ? "Aucun dossier affiché"
        : `${filteredCount} dossier${filteredCount > 1 ? "s" : ""} affiché${filteredCount > 1 ? "s" : ""}`}
      {filtered && totalCount > 0 ? ` sur ${totalCount} au total` : !filtered && totalCount > 0 ? " (liste complète)" : ""}
    </p>
  );
}
