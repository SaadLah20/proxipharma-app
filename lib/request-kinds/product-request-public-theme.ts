/**
 * Parcours public « demande de produits » : accent **sky** (aligné `product.config.ts`)
 * sur fond / textes / bordures neutres de la charte globale (`background`, `card`, `border`, `muted`).
 */
export const productRequestPublicTheme = {
  backLink: "text-sky-800",
  shell: "border-sky-300/50 ring-1 ring-sky-200/55",
  headerGradient: "bg-gradient-to-br from-sky-600 via-sky-600/95 to-teal-600",
  headerBorder: "border-sky-400/40 ring-sky-300/35",
  headerEyebrow: "text-sky-50/90",
  headerSubtitle: "text-sky-50/95",
  searchDivider: "border-sky-200/70",
  searchIcon: "text-sky-600",
  searchInput: "border-sky-200/80",
  focus: "outline-none focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/35",
  explorerBtn:
    "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-sky-800 bg-sky-700 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800",
  hitHover: "hover:border-sky-300/60",
  photoRing: "hover:ring-sky-400/45 focus-visible:ring-sky-500",
  price: "text-sky-700",
  priceBold: "font-bold text-sky-700",
  messageCard: "border-sky-300/45 ring-1 ring-sky-200/55",
  messageInput: "border-sky-200/70",
  footerBorder: "border-sky-200/70",
  feedbackOk: "border-sky-300/50 bg-sky-50/80 text-foreground",
  cta: "bg-sky-700 text-white hover:bg-sky-800 shadow-md",
  noteActive: "border-sky-400/50 bg-sky-50 text-sky-800",
  noteIdle: "hover:border-sky-300/50",
  modalShell: "border-sky-300/45 ring-1 ring-sky-200/55",
  modalHeader: "border-sky-200/70 bg-gradient-to-r from-sky-50/90 via-card to-card",
  modalHighlight: "border-sky-200/60 bg-sky-50/50",
  modalLabel: "text-sky-800",
} as const;
