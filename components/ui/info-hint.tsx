"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { clsx } from "clsx";

const TOOLTIP_Z = 10200;
const VIEWPORT_PAD = 10;
const GAP_PX = 6;

/**
 * Bulle d’aide courte : clic sur l’icône pour afficher / masquer (accessible, sans dépendance).
 * La bulle est rendue en portail pour ne pas être coupée par overflow (footer sticky, etc.).
 */
export function InfoHint({
  children,
  label = "Plus d’informations",
  className,
  placement = "down",
  align = "center",
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
  /** `up` ouvre la bulle au-dessus de l’icône (utile dans un footer collé en bas). */
  placement?: "up" | "down";
  /** `start` = bord gauche du déclencheur ; `end` = bord droit (icône à droite du bloc). */
  align?: "center" | "end" | "start";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; transform?: string } | null>(
    null
  );

  useEffect(() => {
    if (!open || !anchorRef.current) {
      setPos(null);
      return undefined;
    }
    const sync = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const tooltipW = Math.min(288, vw - VIEWPORT_PAD * 2);
      let left =
        align === "end"
          ? r.right - tooltipW
          : align === "start"
            ? r.left
            : r.left + r.width / 2 - tooltipW / 2;
      left = Math.max(VIEWPORT_PAD, Math.min(left, vw - tooltipW - VIEWPORT_PAD));

      if (placement === "up") {
        setPos({
          top: r.top - GAP_PX,
          left,
          width: tooltipW,
          transform: "translateY(-100%)",
        });
      } else {
        setPos({
          top: r.bottom + GAP_PX,
          left,
          width: tooltipW,
        });
      }
    };
    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [open, placement, align]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      const tip = document.querySelector(`[data-info-hint-tooltip="${id}"]`);
      if (tip?.contains(t)) return;
      setOpen(false);
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
  }, [open, id]);

  const tooltip =
    open && pos && typeof document !== "undefined"
      ? createPortal(
          <span
            id={id}
            data-info-hint-tooltip={id}
            role="tooltip"
            className="fixed rounded-xl border border-border bg-card px-3 py-2 text-[11px] leading-relaxed text-card-foreground shadow-lg ring-1 ring-black/5"
            style={{
              zIndex: TOOLTIP_Z,
              left: pos.left,
              top: pos.top,
              width: pos.width,
              maxWidth: `calc(100vw - ${VIEWPORT_PAD * 2}px)`,
              transform: pos.transform,
            }}
          >
            {children}
          </span>,
          document.body
        )
      : null;

  return (
    <span className={clsx("relative inline-flex shrink-0 align-middle", className)}>
      <button
        ref={anchorRef}
        type="button"
        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="size-4 shrink-0" aria-hidden />
      </button>
      {tooltip}
    </span>
  );
}
