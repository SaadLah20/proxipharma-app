/**
 * Parcours « demande de produits » : fond / cartes / textes = charte globale ;
 * accent **sky** réservé à l’en-tête de parcours, focus, CTA et repères prix.
 */
export const productRequestPublicTheme = {
  backLink: "text-primary hover:text-sky-800",
  /** Carte standard — bordure neutre (comme annuaire / fiche). */
  shell: "border-border/90 shadow-sm",
  /** Bandeau ou filet sky discret sur une zone clé. */
  accentLine: "border-sky-200/60",
  headerGradient: "bg-gradient-to-br from-sky-700 via-sky-700 to-sky-800",
  headerBorder: "border-sky-500/25",
  headerEyebrow: "text-sky-100/90",
  headerSubtitle: "text-sky-50/95",
  searchDivider: "border-border/80",
  searchIcon: "text-sky-600",
  searchInput: "border-border/80",
  focus: "outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/30",
  explorerBtn:
    "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sky-600/25 bg-card px-3 text-sm font-semibold text-sky-900 shadow-sm transition hover:border-sky-500/40 hover:bg-sky-50/80",
  hitHover: "hover:border-sky-300/50 hover:bg-muted/30",
  photoRing: "hover:ring-sky-400/40 focus-visible:ring-sky-500/50",
  price: "text-sky-800",
  priceBold: "font-bold text-sky-800",
  messageCard: "border-border/90",
  messageInput: "border-border/80",
  footerBorder: "border-sky-200/50",
  feedbackOk: "border-sky-200/60 bg-sky-50/60 text-foreground",
  cta: "bg-sky-700 text-white hover:bg-sky-800 shadow-sm",
  noteActive: "border-sky-300/60 bg-sky-50/80 text-sky-950",
  noteIdle: "hover:border-sky-200/60 hover:bg-sky-50/40",
  modalShell: "border-border/90 shadow-xl",
  modalHeader: "border-border/80 bg-muted/20",
  modalHighlight: "border-sky-200/50 bg-sky-50/40",
  modalLabel: "text-sky-900",
  sectionBadge: "rounded-md bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-sky-900",
} as const;
