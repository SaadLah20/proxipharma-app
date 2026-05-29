"use client";

import { useId, useState } from "react";
import { HelpCircle } from "lucide-react";
import { clsx } from "clsx";

/**
 * Bulle d’aide courte : clic sur l’icône pour afficher / masquer (accessible, sans dépendance).
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
  /** `end` ancre la bulle à droite (évite la coupure en bord de ligne flex). */
  align?: "center" | "end";
}) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span className={clsx("relative inline-flex align-middle", className)}>
      <button
        type="button"
        className="rounded-full p-0.5 text-muted-foreground transition hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className={clsx(
            "absolute z-50 w-[min(calc(100vw-2.5rem),18rem)] rounded-xl border border-border bg-card px-3 py-2 text-[11px] leading-relaxed text-card-foreground shadow-lg ring-1 ring-black/5",
            align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
            placement === "up" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          )}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
