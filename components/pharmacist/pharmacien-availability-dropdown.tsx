"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import { availabilitySentLineButtonClass, availabilityStatusUi } from "@/lib/pharmacist-availability-ui";

export function PharmacienAvailabilityDropdown({
  rowId,
  disabled,
  menuOpen,
  onOpenChange,
  draftStatus,
  requestedQty,
  availableQtyStr,
  isProposedLine,
  options,
  onPick,
  /** Le bouton affiche le statut (couleurs) sans libellé séparé sur la carte. */
  appearance = "default",
}: {
  rowId: string;
  disabled: boolean;
  menuOpen: boolean;
  onOpenChange: (open: boolean) => void;
  draftStatus: string;
  requestedQty: number;
  availableQtyStr: string;
  isProposedLine: boolean;
  options: readonly { value: string; label: string }[];
  onPick: (value: string) => void;
  appearance?: "default" | "statusChip" | "sentLine";
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const qty = Number(availableQtyStr || "0");
  const q = Number.isFinite(qty) ? qty : 0;
  const inferred = inferAvailabilityStatusFromQty({
    status: draftStatus === "partially_available" ? "available" : draftStatus,
    availableQty: q,
    requestedQty,
    isProposedLine,
  });
  const ui = availabilityStatusUi(inferred);
  const CurIcon = ui.Icon;

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
      const width = Math.max(r.width, appearance === "sentLine" ? 200 : appearance === "statusChip" ? 168 : 200);
      let left = r.left;
      if (left + width > vw - 8) {
        left = Math.max(8, vw - width - 8);
      }
      setMenuRect({
        top: r.bottom + 4,
        left,
        width,
      });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [menuOpen, appearance]);

  return (
    <div
      ref={anchorRef}
      className={clsx(
        "relative min-w-0",
        appearance === "sentLine" || appearance === "statusChip" ? "min-w-0 flex-1" : "min-w-[8.5rem] flex-1"
      )}
      data-pharma-avail-anchor={rowId}
    >
      <button
        type="button"
        disabled={disabled}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          onOpenChange(!menuOpen);
        }}
        className={clsx(
          "flex w-full items-center gap-1 text-left shadow-sm transition disabled:opacity-55",
          appearance === "sentLine"
            ? clsx(
                "h-7 min-h-7 rounded-full px-2.5",
                availabilitySentLineButtonClass(inferred),
                menuOpen && "ring-1 ring-primary/25"
              )
            : appearance === "statusChip"
              ? clsx(
                  "h-8 gap-1.5 rounded-lg px-2 text-[11px] font-semibold ring-1",
                  ui.badgeClass,
                  menuOpen && "ring-2 ring-primary/30"
                )
              : clsx(
                  "h-9 gap-1.5 rounded-xl border border-input bg-background px-2 text-[11px] font-semibold hover:bg-muted/35",
                  menuOpen && "ring-2 ring-primary/25"
                )
        )}
      >
        <CurIcon
          className={clsx("shrink-0 opacity-80", appearance === "sentLine" ? "size-3" : "size-3.5")}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{ui.label}</span>
        <ChevronDown
          className={clsx(
            "shrink-0 opacity-60 transition-transform",
            appearance === "sentLine" ? "size-3" : "size-3.5",
            menuOpen && "rotate-180"
          )}
        />
      </button>
      {menuOpen && menuRect && typeof document !== "undefined"
        ? createPortal(
            <ul
              role="listbox"
              aria-label="Disponibilité"
              data-pharma-avail-menu={rowId}
              style={{
                position: "fixed",
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
                zIndex: 11050,
                maxHeight: "min(14rem, 55vh)",
              }}
              className="space-y-0.5 overflow-auto rounded-xl border border-border/90 bg-card py-1 shadow-xl ring-1 ring-black/[0.08]"
            >
              {options.map((o) => {
                const inferredOpt = inferAvailabilityStatusFromQty({
                  status: o.value,
                  availableQty: q,
                  requestedQty,
                  isProposedLine,
                });
                const oUi = availabilityStatusUi(inferredOpt);
                const OIcon = oUi.Icon;
                const selected = draftStatus === o.value;
                return (
                  <li key={o.value} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={clsx(
                        "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-medium transition",
                        selected
                          ? "bg-primary/12 text-primary"
                          : "text-foreground hover:bg-muted/65"
                      )}
                      onClick={() => {
                        onPick(o.value);
                        onOpenChange(false);
                      }}
                    >
                      <OIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}
