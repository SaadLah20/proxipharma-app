import { clsx } from "clsx";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";

/** Filtres saisis dans le panneau (hors statut URL issu du tableau de bord). */
export function hubListHasManualFilters(input: {
  entityFilter?: string;
  referenceQuery: string;
  sortNewestFirst: boolean;
  /** Patient hub : `false` = archives incluses (hors défaut). */
  activeOnly?: boolean;
}): boolean {
  return (
    Boolean(input.entityFilter?.trim()) ||
    input.referenceQuery.trim().length >= 2 ||
    !input.sortNewestFirst ||
    input.activeOnly === false
  );
}

/**
 * Panneau filtres liste : replié si seul le `statut` URL est actif (clic tuile tableau de bord).
 * `filtersExpandedUser === true` force l’ouverture ; `false` ou `null` = masqué dans ce cas.
 */
export function hubListFiltersPanelExpanded(input: {
  tabIsList: boolean;
  listStatutParam: string | null;
  hasManualFilters: boolean;
  filtersExpandedUser: boolean | null;
}): boolean {
  const urlStatutOnly =
    input.tabIsList && Boolean(input.listStatutParam) && !input.hasManualFilters;
  const autoExpand = input.tabIsList && input.hasManualFilters;
  if (urlStatutOnly) return input.filtersExpandedUser === true;
  return input.filtersExpandedUser ?? autoExpand;
}

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
