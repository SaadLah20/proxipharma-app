/**
 * Parcours public « demande de produits » — charte globale + repère sky discret (pastille / focus).
 */
export const productRequestPublicTheme = {
  backLink: "text-primary font-medium underline underline-offset-2",
  shell: "border-border/80",
  headerGradient: "bg-card text-foreground",
  headerBorder: "border-border/80",
  headerEyebrow: "text-muted-foreground",
  headerSubtitle: "text-muted-foreground",
  searchDivider: "border-border/80",
  searchIcon: "text-muted-foreground",
  searchInput: "border-input",
  focus: "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
  explorerBtn:
    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/50",
  hitHover: "hover:border-border hover:bg-muted/30",
  photoRing: "hover:ring-primary/30 focus-visible:ring-primary/40",
  price: "text-foreground",
  priceBold: "font-bold text-foreground",
  messageCard: "border-border/80",
  messageInput: "border-input",
  footerBorder: "border-border/80",
  feedbackOk: "border-border/80 bg-muted/40 text-foreground",
  cta: "bg-primary text-primary-foreground hover:opacity-95 shadow-sm",
  noteActive: "border-primary/30 bg-muted/50 text-foreground",
  noteIdle: "hover:border-border hover:bg-muted/30",
  modalShell: "border-border/80",
  modalHeader: "border-border/80 bg-card",
  modalHighlight: "border-border/80 bg-muted/30",
  modalLabel: "text-foreground",
} as const;
