"use client";

import { clsx } from "clsx";
import { FileText, LayoutGrid, MessageSquare, Package, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RequestHubParcoursSlug } from "@/lib/request-hub-parcours";
import { REQUEST_HUB_PARCOURS_SLUGS } from "@/lib/request-hub-parcours";

const PARCOURS_ICONS: Record<RequestHubParcoursSlug, LucideIcon> = {
  tous: LayoutGrid,
  produits: Package,
  ordonnances: FileText,
  consultations: MessageSquare,
};

const PARCOURS_ACCENT: Record<
  RequestHubParcoursSlug,
  { active: string; badge: string; badgeMuted: string }
> = {
  tous: {
    active: "border-primary bg-primary/10 text-primary",
    badge: "bg-primary text-primary-foreground",
    badgeMuted: "bg-muted text-muted-foreground",
  },
  produits: {
    active: "border-sky-500/70 bg-sky-50 text-sky-900",
    badge: "bg-sky-600 text-white",
    badgeMuted: "bg-sky-100/80 text-sky-800/70",
  },
  ordonnances: {
    active: "border-amber-500/60 bg-amber-50 text-amber-950",
    badge: "bg-amber-700 text-white",
    badgeMuted: "bg-amber-100/80 text-amber-900/70",
  },
  consultations: {
    active: "border-violet-500/60 bg-violet-50 text-violet-950",
    badge: "bg-violet-700 text-white",
    badgeMuted: "bg-violet-100/80 text-violet-900/70",
  },
};

const LABEL_KEYS: Record<RequestHubParcoursSlug, "all" | "products" | "prescriptions" | "consultations"> = {
  tous: "all",
  produits: "products",
  ordonnances: "prescriptions",
  consultations: "consultations",
};

export function RequestParcoursTabBar({
  active,
  counts,
  onChange,
}: {
  active: RequestHubParcoursSlug;
  counts: Record<RequestHubParcoursSlug, number>;
  onChange: (slug: RequestHubParcoursSlug) => void;
}) {
  const t = useTranslations("hub.parcours");

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <nav
        className="grid grid-cols-4 divide-x divide-border/80"
        aria-label={t("ariaLabel")}
        role="tablist"
      >
        {REQUEST_HUB_PARCOURS_SLUGS.map((slug) => {
          const Icon = PARCOURS_ICONS[slug];
          const isActive = active === slug;
          const count = counts[slug] ?? 0;
          const accent = PARCOURS_ACCENT[slug];
          return (
            <button
              key={slug}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(slug)}
              className={clsx(
                "flex min-h-[3.25rem] flex-col items-center justify-center gap-1 border-b-[3px] px-1 py-2 text-[10px] font-semibold leading-tight transition sm:min-h-[3.5rem] sm:text-[11px]",
                isActive ? accent.active : "border-transparent text-muted-foreground hover:bg-muted/30 hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-1">
                <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
                {count > 0 ? (
                  <span
                    className={clsx(
                      "inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums leading-none",
                      isActive ? accent.badge : accent.badgeMuted,
                    )}
                    aria-label={t("activeCountAria", { count })}
                  >
                    {count}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate text-center">{t(LABEL_KEYS[slug])}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
