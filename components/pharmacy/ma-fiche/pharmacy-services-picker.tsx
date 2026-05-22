"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import type { PharmacyServiceCatalogRow } from "@/lib/pharmacy-profile-types";

export function PharmacyServicesPicker({
  catalog,
  selected,
  onToggle,
}: {
  catalog: PharmacyServiceCatalogRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (catalog.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun service disponible pour le moment.</p>;
  }

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {catalog.map((s) => {
        const on = selected.has(s.id);
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onToggle(s.id)}
              className={clsx(
                "flex w-full min-h-12 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition",
                on
                  ? "border-emerald-400/80 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-400/40"
                  : "border-border bg-card text-foreground hover:bg-muted/30"
              )}
            >
              <span
                className={clsx(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  on ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/40 bg-muted/20"
                )}
                aria-hidden
              >
                {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
              <span className="leading-snug">{s.label_fr}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
