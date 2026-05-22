"use client";

import type { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

export type PharmacySegmentTab<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

export function PharmacySegmentTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  columnClass = "grid-cols-4",
}: {
  tabs: PharmacySegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** ex. `grid-cols-3` pour moins d’onglets */
  columnClass?: string;
}) {
  return (
    <nav
      className={clsx("grid w-full border-b border-border bg-muted/15", columnClass)}
      aria-label={ariaLabel}
    >
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={clsx(
              "flex w-full flex-col items-center justify-center gap-0.5 rounded-t-xl px-1 py-2.5 text-[9px] font-bold uppercase tracking-wide transition sm:flex-row sm:gap-1.5 sm:px-2 sm:text-[10px]",
              isActive
                ? "bg-card text-primary shadow-[0_-1px_0_0_hsl(var(--border))] ring-1 ring-inset ring-border/80"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            <Icon className={clsx("size-4 shrink-0", isActive ? "text-primary" : "opacity-70")} aria-hidden />
            <span className="leading-tight">{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
