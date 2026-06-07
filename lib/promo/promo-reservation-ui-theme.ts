import type { RequestKindUiTheme } from "@/lib/request-kind-ui-theme";
import { promoPublicTheme as t } from "@/lib/promo/promo-public-theme";

/** Tokens UI dossier réservation pack (bandeau officine, modales). */
export const promoReservationUiTheme: RequestKindUiTheme = {
  accentLine: "border-emerald-300/45",
  accentIcon: "text-emerald-800",
  accentIconBg: "bg-emerald-100/90 ring-1 ring-emerald-200/60",
  sectionBadge: "rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-bold text-emerald-950",
  messageCard:
    "border-emerald-200/50 bg-gradient-to-br from-emerald-50/45 via-card to-teal-50/15 ring-1 ring-emerald-100/35",
  messageInput: "border-emerald-200/60 bg-white/90",
  confirmShell: "border-emerald-200/60 bg-emerald-50/30",
  confirmAccentBorder: "border-emerald-300/70",
  photoRing: "hover:ring-emerald-400/35 focus-visible:ring-emerald-400/45",
  linkAccent: "text-emerald-900 underline",
  modalShell: "border-emerald-200/55 shadow-xl",
  modalHeader: "border-emerald-200/50 bg-emerald-50/25",
};

export { t as promoReservationPublicTheme };
