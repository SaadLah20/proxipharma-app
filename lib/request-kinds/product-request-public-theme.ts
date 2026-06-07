/**
 * Parcours « demande de produits » : charte plateforme (primary / card) ;
 * accent sky discret (icône bandeau, filet) pour distinguer du parcours ordonnance / consultation.
 */
export const productRequestPublicTheme = {
  backLink: "text-primary hover:text-primary/80",
  shell: "border-border/90 shadow-sm",
  accentLine: "border-sky-300/40",
  accentIcon: "text-sky-700",
  accentIconBg: "bg-sky-100/90 ring-1 ring-sky-200/60",
  headerGradient: "border-border bg-card",
  headerBorder: "border-border/90",
  headerEyebrow: "text-muted-foreground",
  headerSubtitle: "text-muted-foreground",
  searchDivider: "border-border/80",
  searchIcon: "text-primary/70",
  searchInput: "border-border/80",
  focus: "outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25",
  explorerBtn:
    "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sky-300/70 bg-sky-50/90 px-3 text-sm font-semibold text-sky-900 shadow-sm transition hover:border-sky-400/80 hover:bg-sky-100",
  hitHover: "hover:border-primary/25 hover:bg-muted/30",
  photoRing: "hover:ring-primary/30 focus-visible:ring-primary/40",
  price: "text-foreground",
  priceBold: "font-bold text-foreground",
  messageCard: "border-sky-200/50 bg-gradient-to-br from-sky-50/70 via-card to-slate-50/40 ring-1 ring-sky-100/80",
  messageInput: "border-sky-200/60 bg-white/90",
  footerBorder: "border-border/80",
  feedbackOk: "border-border bg-muted/30 text-foreground",
  cta: "rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95",
  noteActive: "border-primary/30 bg-primary/5 text-foreground",
  noteIdle: "hover:border-border hover:bg-muted/30",
  modalShell: "border-sky-200/70 shadow-xl",
  modalHeader: "border-sky-200/80 bg-sky-50/40",
  modalHighlight: "border-border bg-muted/20",
  modalLabel: "text-foreground",
  sectionBadge: "rounded-md bg-sky-100/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-sky-900",
} as const;
