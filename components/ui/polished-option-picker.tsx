"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { Check, ChevronDown } from "lucide-react";

export type PolishedOption = {
  value: string;
  label: string;
};

type Props = {
  options: readonly PolishedOption[];
  value: string;
  onPick: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  /** Contrôle externe du menu (ex. un seul menu ouvert à la fois). */
  menuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  className?: string;
  buttonClassName?: string;
  minMenuWidth?: number;
  appearance?: "default" | "compact";
};

export function PolishedOptionPicker({
  options,
  value,
  onPick,
  disabled = false,
  placeholder = "Choisir…",
  ariaLabel = "Choisir une option",
  menuOpen: menuOpenProp,
  onMenuOpenChange,
  className,
  buttonClassName,
  minMenuWidth = 200,
  appearance = "default",
}: Props) {
  const listId = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuOpenInternal, setMenuOpenInternal] = useState(false);
  const menuOpen = menuOpenProp ?? menuOpenInternal;
  const setMenuOpen = onMenuOpenChange ?? setMenuOpenInternal;
  const [menuRect, setMenuRect] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    openUpward: boolean;
  } | null>(null);

  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;

  const MENU_MAX_HEIGHT_PX = 224;

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) {
      setMenuRect(null);
      return undefined;
    }
    const sync = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = typeof window !== "undefined" ? window.innerWidth : 400;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const safeBottom = 12;
      const width = Math.max(r.width, minMenuWidth);
      let left = r.left;
      if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
      const spaceBelow = vh - r.bottom - safeBottom;
      const spaceAbove = r.top - safeBottom;
      const openUpward = spaceBelow < MENU_MAX_HEIGHT_PX && spaceAbove > spaceBelow;
      if (openUpward) {
        setMenuRect({ bottom: vh - r.top + 4, left, width, openUpward: true });
      } else {
        setMenuRect({ top: r.bottom + 4, left, width, openUpward: false });
      }
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [menuOpen, minMenuWidth]);

  return (
    <div ref={anchorRef} className={clsx("relative min-w-0", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => {
          if (disabled) return;
          setMenuOpen(!menuOpen);
        }}
        className={clsx(
          "flex w-full items-center gap-1.5 text-left shadow-sm transition disabled:cursor-not-allowed disabled:opacity-55",
          appearance === "compact"
            ? "h-7 min-h-7 rounded-md border border-input bg-background px-2 text-[11px] font-medium hover:bg-muted/35"
            : "h-9 min-h-9 rounded-lg border border-input bg-background px-2.5 text-[12px] font-semibold hover:bg-muted/35",
          !selected && "text-muted-foreground",
          menuOpen && "ring-2 ring-primary/20",
          buttonClassName
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <ChevronDown
          className={clsx("size-3.5 shrink-0 opacity-60 transition-transform", menuOpen && "rotate-180")}
          aria-hidden
        />
      </button>
      {menuOpen && menuRect && typeof document !== "undefined"
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[11040] cursor-default bg-transparent"
                aria-label="Fermer le menu"
                onClick={() => setMenuOpen(false)}
              />
              <ul
                id={listId}
                role="listbox"
                aria-label={ariaLabel}
                style={{
                  position: "fixed",
                  ...(menuRect.openUpward
                    ? { bottom: menuRect.bottom }
                    : { top: menuRect.top }),
                  left: menuRect.left,
                  width: menuRect.width,
                  zIndex: 11050,
                  maxHeight: "min(14rem, 55vh)",
                }}
                className="space-y-0.5 overflow-auto rounded-xl border border-border/90 bg-card py-1 shadow-xl ring-1 ring-black/[0.08]"
              >
                {options.map((o) => {
                  const isSelected = value === o.value;
                  return (
                    <li key={o.value} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        className={clsx(
                          "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-medium transition",
                          isSelected ? "bg-primary/12 text-primary" : "text-foreground hover:bg-muted/65"
                        )}
                        onClick={() => {
                          onPick(o.value);
                          setMenuOpen(false);
                        }}
                      >
                        {isSelected ? (
                          <Check className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <span className="size-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>,
            document.body
          )
        : null}
    </div>
  );
}
