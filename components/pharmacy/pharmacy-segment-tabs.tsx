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
  columnClass = "sm:grid-cols-4",
}: {
  tabs: PharmacySegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** ex. `sm:grid-cols-5` pour le nombre d’onglets sur écran large */
  columnClass?: string;
}) {
  return (
    <div className="border-b border-border bg-muted/15">
      <nav
        className={clsx(
          "flex w-full gap-0 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:overflow-visible",
          columnClass
        )}
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
                "flex min-h-11 min-w-[4.75rem] shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-2.5 text-[9px] font-bold uppercase tracking-wide transition sm:min-w-0 sm:flex-1 sm:flex-row sm:gap-1.5 sm:px-2 sm:text-[10px]",
                isActive
                  ? "bg-card text-primary shadow-[0_-1px_0_0_hsl(var(--border))] ring-1 ring-inset ring-border/80"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              )}
            >
              <Icon className={clsx("size-4 shrink-0", isActive ? "text-primary" : "opacity-70")} aria-hidden />
              <span className="max-w-[5.5rem] text-center leading-tight sm:max-w-none">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
