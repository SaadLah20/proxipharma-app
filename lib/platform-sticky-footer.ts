/**
 * Anciens footers d'actions — conservé pour hauteurs conversation + résumé inline.
 * La navigation basse globale vit dans `lib/platform-bottom-nav.ts`.
 */

import { PLATFORM_BOTTOM_NAV_HEIGHT_PX, platformBottomNavFabMinBottomPx } from "@/lib/platform-bottom-nav";

export const STICKY_FOOTER_SAFE_BOTTOM =
  "pb-[max(0.5rem,env(safe-area-inset-bottom))]" as const;

/** @deprecated Plus de tiers d'action footer — utiliser `platformBottomNavFabMinBottomPx`. */
export type StickyFooterPadTier = "none";

/** Décalage par défaut du FAB Messages (pages sans barre basse visible). */
export const STICKY_FOOTER_FAB_DEFAULT_BOTTOM_PX = 24;

/** Marge basse minimale du FAB Conversation au-dessus de la barre de navigation basse. */
export function stickyFooterFabMinBottomPx(_tier: StickyFooterPadTier = "none"): number {
  return platformBottomNavFabMinBottomPx();
}

function consultationConversationHeightCalc(): string {
  const bottomNavExtra = `${PLATFORM_BOTTOM_NAV_HEIGHT_PX / 16}rem`;
  return `calc(100dvh-12.25rem-${bottomNavExtra}-env(safe-area-inset-bottom))`;
}

/** Hauteur fixe onglet Conversation (pharmacien — panneau interne scrollable). */
export function consultationConversationViewportHeightClass(
  _footerTier: StickyFooterPadTier = "none"
): string {
  const h = consultationConversationHeightCalc();
  return `h-[${h}] max-h-[${h}]`;
}

/** Hauteur minimale onglet Conversation patient (page scrollable + scroll chaining). */
export function consultationConversationMinHeightClass(
  _footerTier: StickyFooterPadTier = "none"
): string {
  return `min-h-[${consultationConversationHeightCalc()}]`;
}

export type StickyFooterTone = "neutral" | "sky" | "amber" | "slate" | "emerald" | "violet";

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
    case "violet":
      return "border-violet-400/70";
    default:
      return "border-border/80";
  }
}
