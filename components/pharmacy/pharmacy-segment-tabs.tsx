"use client";

import type { LucideIcon } from "lucide-react";
import { promoPublicTheme as pt } from "@/lib/promo/promo-public-theme";
import { clsx } from "clsx";

export type PharmacySegmentTab<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

const GRID_COLS_BY_COUNT: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function PharmacySegmentTabs<T extends string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  columnClass,
  activeAccent = "default",
}: {
  tabs: PharmacySegmentTab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  /** Override ex. `grid-cols-5` — sinon dérivé du nombre d’onglets */
  columnClass?: string;
  /** Accent onglet actif : emerald discret (fiche publique — onglet Offres). */
  activeAccent?: "default" | "emerald";
}) {
  const gridCols =
    columnClass ?? GRID_COLS_BY_COUNT[tabs.length] ?? "grid-cols-4";

  return (
    <div className="border-b border-border bg-card">
      <nav
        className={clsx("grid w-full", gridCols)}
        aria-label={ariaLabel}
        role="tablist"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={clsx(
                "flex min-h-[3.5rem] w-full min-w-0 flex-col items-center justify-center gap-1 border-b-[3px] px-1 py-2.5 text-[11px] font-semibold leading-tight transition sm:min-h-[3.75rem] sm:text-xs",
                isActive
                  ? activeAccent === "emerald"
                    ? pt.tabActive
                    : "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              )}
            >
              <Icon
                className={clsx(
                  "size-[1.125rem] shrink-0 sm:size-5",
                  isActive
                    ? activeAccent === "emerald"
                      ? pt.tabActiveIcon
                      : "text-primary"
                    : "opacity-75",
                )}
                aria-hidden
              />
              <span className="max-w-full truncate text-center">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
