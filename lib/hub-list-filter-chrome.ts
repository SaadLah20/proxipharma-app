import { clsx } from "clsx";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";

/** Filtres liste hub demandes — charte compte (neutre), pas les accents sky/amber des dossiers. */
export const hubListFilterChrome = {
  shell: clsx(p.filterShell),
  title: "text-sm font-bold tracking-tight text-foreground",
  subtitle: "mt-0.5 text-[11px] leading-snug text-muted-foreground",
  iconBox:
    "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
  link: p.link,
  clearLink: clsx(p.link, "text-[11px]"),
} as const;
