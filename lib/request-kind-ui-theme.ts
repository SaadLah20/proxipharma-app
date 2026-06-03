import type { RequestKindId } from "@/lib/request-kinds/types";
import { prescriptionRequestPublicTheme } from "@/lib/request-kinds/prescription-request-public-theme";
import { productRequestPublicTheme } from "@/lib/request-kinds/product-request-public-theme";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";

/** Tokens UI dashboard / dossier (bandeau officine, modales, filets). */
export type RequestKindUiTheme = {
  accentLine: string;
  accentIcon: string;
  accentIconBg: string;
  sectionBadge: string;
  messageCard: string;
  messageInput: string;
  confirmShell: string;
  confirmAccentBorder: string;
  photoRing: string;
  linkAccent: string;
  modalShell: string;
};

const consultationTheme: RequestKindUiTheme = {
  accentLine: "border-violet-300/45",
  accentIcon: "text-violet-800",
  accentIconBg: "bg-violet-100/90 ring-1 ring-violet-200/60",
  sectionBadge: "rounded-md bg-violet-100/80 px-1.5 py-0.5 text-[10px] font-bold text-violet-950",
  messageCard:
    "border-violet-200/50 bg-gradient-to-br from-violet-50/70 via-card to-slate-50/40 ring-1 ring-violet-100/80",
  messageInput: "border-violet-200/60 bg-white/90",
  confirmShell: "border-violet-200/60 bg-violet-50/30",
  confirmAccentBorder: "border-violet-300/70",
  photoRing: "hover:ring-violet-400/35 focus-visible:ring-violet-400/45",
  linkAccent: "text-violet-900 underline",
  modalShell: "border-border/90 shadow-xl",
};

const productTheme: RequestKindUiTheme = {
  accentLine: productRequestPublicTheme.accentLine,
  accentIcon: productRequestPublicTheme.accentIcon,
  accentIconBg: productRequestPublicTheme.accentIconBg,
  sectionBadge: productRequestPublicTheme.sectionBadge,
  messageCard: productRequestPublicTheme.messageCard,
  messageInput: productRequestPublicTheme.messageInput,
  confirmShell: "border-sky-200/60 bg-sky-50/30",
  confirmAccentBorder: "border-sky-300/70",
  photoRing: productRequestPublicTheme.photoRing,
  linkAccent: "text-sky-900 underline",
  modalShell: productRequestPublicTheme.modalShell,
};

const prescriptionTheme: RequestKindUiTheme = {
  accentLine: prescriptionRequestPublicTheme.accentLine,
  accentIcon: prescriptionRequestPublicTheme.accentIcon,
  accentIconBg: prescriptionRequestPublicTheme.accentIconBg,
  sectionBadge: prescriptionRequestPublicTheme.sectionBadge,
  messageCard:
    "border-amber-200/50 bg-gradient-to-br from-amber-50/70 via-card to-orange-50/25 ring-1 ring-amber-100/80",
  messageInput: "border-amber-200/60 bg-white/90",
  confirmShell: "border-amber-200/60 bg-amber-50/30",
  confirmAccentBorder: "border-amber-300/70",
  photoRing: "hover:ring-amber-400/35 focus-visible:ring-amber-400/45",
  linkAccent: "text-amber-950 underline",
  modalShell: "border-amber-200/70 shadow-xl",
};

export function requestKindUiTheme(requestType: string | null | undefined): RequestKindUiTheme {
  if (requestType === "prescription") return prescriptionTheme;
  if (requestType === "free_consultation") return consultationTheme;
  return productTheme;
}

export function requestKindUiThemeById(kindId: RequestKindId): RequestKindUiTheme {
  const accent = getRequestKindConfig(kindId).theme.accent;
  if (accent === "amber") return prescriptionTheme;
  if (accent === "violet") return consultationTheme;
  return productTheme;
}
