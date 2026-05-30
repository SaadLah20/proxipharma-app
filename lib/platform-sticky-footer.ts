/**
 * Footers collés en bas — hauteurs et padding scroll alignés (safe-area iOS).
 */

export const STICKY_FOOTER_SAFE_BOTTOM =
  "pb-[max(0.5rem,env(safe-area-inset-bottom))]" as const;

export type StickyFooterPadTier =
  | "none"
  /** Résumé seul (compteur + total) ~3.5rem */
  | "compact"
  /** Résumé + 1 bouton ~5.25rem */
  | "standard"
  /** Résumé + 2 boutons empilés ~6.75rem */
  | "tall"
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
    "pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:pb-[calc(5.75rem+env(safe-area-inset-bottom))]",
  tall:
    "pb-[calc(7rem+env(safe-area-inset-bottom))] sm:pb-[calc(7.5rem+env(safe-area-inset-bottom))]",
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

/** Décalage par défaut du FAB Messages au-dessus d’un footer standard. */
export const STICKY_FOOTER_FAB_DEFAULT_BOTTOM_PX = 92;

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
