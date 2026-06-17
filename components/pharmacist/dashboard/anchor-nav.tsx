"use client";

import { clsx } from "clsx";

const SECTIONS = [
  { id: "dashboard-action", label: "Action" },
  { id: "dashboard-dossiers", label: "Dossiers" },
  { id: "dashboard-officine", label: "Officine" },
  { id: "dashboard-visibilite", label: "Visibilité" },
] as const;

export function PharmacistDashboardAnchorNav() {
  return (
    <nav
      aria-label="Sections du tableau de bord"
      className="sticky top-0 z-10 -mx-1 overflow-x-auto rounded-xl border border-border/80 bg-background/95 px-1 py-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <ul className="flex min-w-max items-center gap-1">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={clsx(
                "inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition",
                "hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
