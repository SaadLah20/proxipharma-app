/** Tokens design ProxiPharma — charte Glovo-like, accessibilité seniors (Maroc). */

export const dsTypography = {
  /** Corps mobile minimum (14px). */
  bodySm: "text-sm leading-relaxed",
  body: "text-[15px] leading-relaxed sm:text-base",
  label: "text-xs font-medium text-muted-foreground sm:text-sm",
  sectionTitle: "text-base font-semibold text-foreground sm:text-lg",
  pageTitle: "text-xl font-bold tracking-tight text-foreground sm:text-2xl",
  caption: "text-xs text-muted-foreground",
} as const;

export const dsSpacing = {
  pageX: "px-4 sm:px-5",
  pageY: "py-4 sm:py-6",
  sectionGap: "space-y-4",
  cardPadding: "p-4 sm:p-5",
  stackGap: "gap-3",
} as const;

export const dsRadius = {
  card: "rounded-xl",
  cardLg: "rounded-2xl",
  pill: "rounded-full",
} as const;

export const dsShadow = {
  card: "shadow-sm",
  cardHover: "shadow-md",
} as const;

/** Cible tactile WCAG / seniors — 44px minimum. */
export const dsTouch = {
  min: "min-h-11 min-w-11",
  button: "min-h-11 px-4",
  row: "min-h-[52px]",
} as const;

export const dsShell = {
  page: "min-h-screen bg-background",
  card: "rounded-xl border border-border/80 bg-card shadow-sm",
  cardInteractive:
    "rounded-xl border border-border/80 bg-card shadow-sm transition hover:border-border hover:shadow-md",
  section: "rounded-xl border border-border/80 bg-card p-4 shadow-sm sm:p-5",
} as const;

export const dsStatusSemantic = {
  neutral: "bg-muted text-foreground border-border/80",
  attention: "bg-amber-50 text-amber-950 border-amber-200/80",
  success: "bg-emerald-50 text-emerald-950 border-emerald-200/80",
  muted: "bg-muted/60 text-muted-foreground border-transparent",
} as const;
