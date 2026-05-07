"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

/** Bloc repliable : informations secondaires sans surcharger l’écran principal. */
export function CollapsibleDetails({
  title,
  children,
  defaultOpen = false,
  className,
  variant = "muted",
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  /** `muted` : encart discret ; `card` : fond carte plein. */
  variant?: "muted" | "card";
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      className={clsx(
        "group rounded-xl border transition-colors open:border-primary/25 open:bg-primary/[0.03]",
        variant === "card" ? "border-border bg-card" : "border-border/70 bg-muted/30",
        className
      )}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-left sm:py-2 [&::-webkit-details-marker]:hidden [&::marker]:content-none">
        <span className="text-xs font-semibold tracking-wide text-foreground">{title}</span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:-rotate-180"
          aria-hidden
        />
      </summary>
      <div className="border-t border-border/60 px-3 pb-3 pt-0">{children}</div>
    </details>
  );
}
