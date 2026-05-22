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
}: {
  tabs: PharmacySegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
}) {
  return (
    <nav
      className="flex gap-1 overflow-x-auto border-b border-border bg-muted/15 px-1.5 pb-0 pt-1.5 scrollbar-none"
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
              "flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-t-xl px-2 py-2 text-[9px] font-bold uppercase tracking-wide transition sm:min-w-0 sm:flex-1 sm:flex-row sm:gap-1.5 sm:text-[10px]",
              isActive
                ? "bg-card text-primary shadow-[0_-1px_0_0_hsl(var(--border))] ring-1 ring-border/80"
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
