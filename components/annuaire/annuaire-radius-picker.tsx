"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPinned } from "lucide-react";
import { clsx } from "clsx";

export const ANNUAIRE_RADIUS_KM_OPTIONS = [2, 5, 10, 25] as const;
export type AnnuaireRadiusKm = (typeof ANNUAIRE_RADIUS_KM_OPTIONS)[number];

export type AnnuaireRadiusMode = "all" | AnnuaireRadiusKm;

const RADIUS_LABELS: Record<AnnuaireRadiusMode, string> = {
  all: "Toutes",
  2: "2 km max",
  5: "5 km",
  10: "10 km",
  25: "25 km",
};

export function AnnuaireRadiusPicker({
  mode,
  loading,
  inRadiusCount,
  onSelect,
}: {
  mode: AnnuaireRadiusMode;
  loading: boolean;
  inRadiusCount?: number;
  onSelect: (next: AnnuaireRadiusMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: AnnuaireRadiusMode) => {
    setOpen(false);
    onSelect(next);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold shadow-sm transition",
          "border-white/35 bg-white/15 text-white hover:bg-white/25",
          "disabled:cursor-wait disabled:opacity-70",
          open && "bg-white/25 ring-2 ring-white/40"
        )}
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
        ) : (
          <MapPinned className="size-3.5 shrink-0 opacity-90" aria-hidden />
        )}
        <span>Rayon&nbsp;: {RADIUS_LABELS[mode]}</span>
        <ChevronDown className={clsx("size-3.5 opacity-80 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Rayon de recherche"
          className="absolute right-0 z-50 mt-1.5 min-w-[10.5rem] overflow-hidden rounded-xl border border-border/90 bg-card py-1 text-sm shadow-lg ring-1 ring-black/5"
        >
          <li role="option" aria-selected={mode === "all"}>
            <button
              type="button"
              onClick={() => pick("all")}
              className={clsx(
                "w-full px-3 py-2 text-left text-xs font-medium hover:bg-muted/60",
                mode === "all" && "bg-primary/10 text-primary"
              )}
            >
              Toutes
            </button>
          </li>
          {ANNUAIRE_RADIUS_KM_OPTIONS.map((km) => (
            <li key={km} role="option" aria-selected={mode === km}>
              <button
                type="button"
                onClick={() => pick(km)}
                className={clsx(
                  "w-full px-3 py-2 text-left text-xs font-semibold hover:bg-muted/60",
                  mode === km && "bg-primary/10 text-primary"
                )}
              >
                {RADIUS_LABELS[km]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {mode !== "all" && inRadiusCount != null ? (
        <span className="sr-only">
          {inRadiusCount} officine{inRadiusCount !== 1 ? "s" : ""} dans le rayon
        </span>
      ) : null}
    </div>
  );
}
