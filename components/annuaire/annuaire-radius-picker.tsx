"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Loader2, MapPinned } from "lucide-react";
import { clsx } from "clsx";

export const ANNUAIRE_RADIUS_KM_OPTIONS = [2, 5, 10, 25] as const;
export type AnnuaireRadiusKm = (typeof ANNUAIRE_RADIUS_KM_OPTIONS)[number];

export type AnnuaireRadiusMode = "all" | AnnuaireRadiusKm;

const MENU_MIN_W = 168;

function RadiusModeLabel({
  mode,
  variant,
  selected,
}: {
  mode: AnnuaireRadiusMode;
  variant: "button" | "menu";
  selected?: boolean;
}) {
  if (mode === "all") {
    return <span>Toutes</span>;
  }

  const maxClass =
    variant === "button"
      ? "font-medium text-amber-200/95"
      : selected
        ? "font-medium text-primary/70"
        : "font-medium text-muted-foreground";

  return (
    <span>
      {mode} km
      <span className={maxClass}> max</span>
    </span>
  );
}

type MenuPos = { top: number; left: number };

function computeMenuPos(anchor: HTMLElement | null): MenuPos {
  if (!anchor) return { top: 0, left: 8 };
  const rect = anchor.getBoundingClientRect();
  const left = Math.max(8, Math.min(rect.right - MENU_MIN_W, window.innerWidth - MENU_MIN_W - 8));
  return { top: rect.bottom + 6, left };
}

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
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const syncMenuPos = useCallback(() => {
    setMenuPos(computeMenuPos(rootRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    window.addEventListener("resize", syncMenuPos);
    window.addEventListener("scroll", syncMenuPos, true);
    return () => {
      window.removeEventListener("resize", syncMenuPos);
      window.removeEventListener("scroll", syncMenuPos, true);
    };
  }, [open, syncMenuPos]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        const menu = document.getElementById("annuaire-radius-menu");
        if (menu?.contains(e.target as Node)) return;
        setOpen(false);
      }
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

  const toggleOpen = () => {
    if (loading) return;
    if (open) {
      setOpen(false);
      return;
    }
    setMenuPos(computeMenuPos(rootRef.current));
    setOpen(true);
  };

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <ul
            id="annuaire-radius-menu"
            role="listbox"
            aria-label="Rayon de recherche"
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[200] min-w-[10.5rem] overflow-hidden rounded-xl border border-border/90 bg-card py-1 text-sm shadow-xl ring-1 ring-black/10"
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
                  <RadiusModeLabel mode={km} variant="menu" selected={mode === km} />
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={rootRef} className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          disabled={loading}
          onClick={toggleOpen}
          className={clsx(
            "inline-flex min-h-8 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold leading-none shadow-sm transition",
            "border-white/35 bg-white/15 text-white hover:bg-white/25",
            "disabled:cursor-wait disabled:opacity-70",
            open && "bg-white/25 ring-2 ring-white/40"
          )}
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" aria-hidden />
          ) : (
            <MapPinned className="size-3 shrink-0 opacity-90" aria-hidden />
          )}
          <span className="whitespace-nowrap">
            Rayon&nbsp;: <RadiusModeLabel mode={mode} variant="button" />
          </span>
          <ChevronDown className={clsx("size-3 opacity-80 transition", open && "rotate-180")} aria-hidden />
        </button>

        {mode !== "all" && inRadiusCount != null ? (
          <span className="sr-only">
            {inRadiusCount} officine{inRadiusCount !== 1 ? "s" : ""} dans le rayon
          </span>
        ) : null}
      </div>
      {menu}
    </>
  );
}
