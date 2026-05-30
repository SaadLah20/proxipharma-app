/**
 * Charte des écrans compte patient hors parcours « demande produits » :
 * alignée annuaire / plateforme (primary, card, border) — pas le bleu sky des dossiers.
 */
export const platformDashboardChrome = {
  page: "bg-background",
  backLink: "text-xs font-medium text-primary underline underline-offset-2",
  hero:
    "overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5",
  heroEyebrow: "text-xs font-semibold uppercase tracking-wide text-muted-foreground",
  heroTitle: "text-xl font-bold tracking-tight text-foreground sm:text-2xl",
  heroSubtitle: "text-sm text-muted-foreground",
  statCard: "rounded-xl border border-border/80 bg-card p-4 shadow-sm",
  statValue: "mt-1 text-2xl font-bold tabular-nums text-foreground",
  statLabel: "text-[10px] font-bold uppercase tracking-wide text-muted-foreground",
  filterShell: "rounded-xl border-2 border-border/90 bg-card p-3 shadow-sm",
  searchIcon: "text-primary/70",
  searchInput: "border-input focus-visible:ring-ring/40",
  cardHover:
    "transition hover:border-primary/30 hover:shadow-md hover:ring-1 hover:ring-primary/15",
  link: "font-semibold text-primary underline underline-offset-2",
  linkInline: "font-medium text-primary underline underline-offset-2",
  cta: "rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95",
  ctaOutline:
    "rounded-lg border border-primary/25 bg-card px-4 py-2 text-sm font-semibold text-primary hover:bg-accent",
  monoAccent: "font-mono font-bold text-primary",
} as const;
