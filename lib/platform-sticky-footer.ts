/**
 * Footers collés en bas — hauteurs et padding scroll alignés (safe-area iOS).
 */

import { cn } from "@/lib/utils";

export const STICKY_FOOTER_SAFE_BOTTOM =
  "pb-[max(0.5rem,env(safe-area-inset-bottom))]" as const;

export type StickyFooterPadTier =
  | "none"
  /** Résumé seul (compteur + total) ~3.5rem */
  | "compact"
  /** Résumé + 1 bouton (~6.5rem) */
  | "standard"
  /** Résumé + 1 bouton + lien sous le scroll (~9rem) */
  | "tall"
  /** Demande envoyée patient : résumé + Modifier (+ Renvoyer) + zone abandon */
  | "resubmit"
  /** Pharmacien : barre actions édition répondue */
  | "pharmaEdit"
  /** Pharmacien : 1 bandeau (déclarer traitée ou stats) */
  | "pharmaSingle"
  /** Pharmacien : 2 bandeaux */
  | "pharmaDouble"
  /** Pharmacien : 3 bandeaux (action + stats + enregistrer) */
  | "pharmaTriple";

const PAD: Record<StickyFooterPadTier, string> = {
  none: "",
  compact:
    "pb-[calc(3.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(4rem+env(safe-area-inset-bottom))]",
  standard:
    "pb-[calc(6.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(6.75rem+env(safe-area-inset-bottom))]",
  tall:
    "pb-[calc(8.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(9.25rem+env(safe-area-inset-bottom))]",
  resubmit:
    "pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-[calc(7.25rem+env(safe-area-inset-bottom))]",
  pharmaEdit:
    "pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(4.75rem+env(safe-area-inset-bottom))]",
  pharmaSingle:
    "pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-[calc(5.25rem+env(safe-area-inset-bottom))]",
  pharmaDouble:
    "pb-[calc(7.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(8.25rem+env(safe-area-inset-bottom))]",
  pharmaTriple:
    "pb-[calc(10.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(11.25rem+env(safe-area-inset-bottom))]",
};

export function stickyFooterPadClass(tier: StickyFooterPadTier): string {
  return PAD[tier];
}

/** Espaceur hors carte : hauteur = footer fixe (pas de padding visible dans un conteneur bordé). */
export function stickyFooterScrollSpacerClass(tier: StickyFooterPadTier): string {
  const pad = PAD[tier];
  if (!pad) return "";
  return cn("pointer-events-none block w-full shrink-0", pad.replace(/pb-/g, "min-h-"));
}

/** Décalage par défaut du FAB Messages sans footer sticky (pages hub, etc.). */
export const STICKY_FOOTER_FAB_DEFAULT_BOTTOM_PX = 24;

/** Marge basse **par défaut** du FAB Conversation (position initiale). Après glissement, le clamp autorise le bord bas de l’écran — voir `lib/conversation-fab-position.ts`. */

/** Marge basse minimale du FAB (px) pour rester au-dessus du footer sticky. */
const FAB_MIN_BOTTOM_PX: Record<StickyFooterPadTier, number> = {
  none: STICKY_FOOTER_FAB_DEFAULT_BOTTOM_PX,
  compact: 88,
  standard: 132,
  tall: 156,
  resubmit: 140,
  pharmaEdit: 108,
  pharmaSingle: 116,
  pharmaDouble: 148,
  pharmaTriple: 176,
};

export function stickyFooterFabMinBottomPx(tier: StickyFooterPadTier): number {
  return FAB_MIN_BOTTOM_PX[tier];
}

/** Palier footer pour le détail patient (produits / ordonnance). */
export function patientDetailStickyFooterPadTier(
  requestType: string,
  status: string
): StickyFooterPadTier {
  if (!["submitted", "in_review", "responded", "confirmed", "treated"].includes(status)) {
    return "none";
  }
  if (requestType === "prescription" && (status === "submitted" || status === "in_review")) {
    return "tall";
  }
  if (requestType === "product_request" && (status === "submitted" || status === "in_review")) {
    return "resubmit";
  }
  return "standard";
}

export function stickyFooterScrollMarginClass(tier: StickyFooterPadTier): string {
  const pad = PAD[tier];
  if (!pad) return "";
  return pad.replace(/pb-/g, "scroll-mb-");
}

export type StickyFooterTone = "neutral" | "sky" | "amber" | "slate" | "emerald";

export function stickyFooterToneBorderClass(tone: StickyFooterTone): string {
  switch (tone) {
    case "sky":
      return "border-sky-400/70";
    case "amber":
      return "border-amber-400/75";
    case "emerald":
      return "border-emerald-400/70";
    case "slate":
      return "border-slate-300/85";
    default:
      return "border-border/80";
  }
}
