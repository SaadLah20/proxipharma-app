/**
 * Position du FAB « Conversation » (dashboard) — sous le header fixe, au-dessus du contenu.
 */

export const CONVERSATION_FAB_SIZE_PX = 64;
const MARGIN_PX = 8;
const HEADER_FALLBACK_BOTTOM_PX = 56;

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Bas du bandeau `PlatformHeader` (px depuis le haut du viewport). */
export function platformHeaderBottomPx(): number {
  if (typeof document === "undefined") return HEADER_FALLBACK_BOTTOM_PX;
  const el = document.querySelector("[data-proxipharma-platform-header]");
  if (!el) return HEADER_FALLBACK_BOTTOM_PX;
  return Math.ceil(el.getBoundingClientRect().bottom);
}

export function clampConversationFabInset(
  right: number,
  bottom: number,
  fabWidth: number,
  fabHeight: number,
  minBottomPx: number,
  opts?: { enforceMinBottom?: boolean }
): { right: number; bottom: number } {
  if (typeof window === "undefined") {
    return { right, bottom: Math.max(bottom, minBottomPx) };
  }

  const w = Math.max(40, fabWidth);
  const h = Math.max(40, fabHeight);
  const headerBottom = platformHeaderBottomPx();
  const bottomMax = window.innerHeight - h - headerBottom - MARGIN_PX;
  const bottomMin = opts?.enforceMinBottom ? Math.max(MARGIN_PX, minBottomPx) : MARGIN_PX;
  const lo = Math.min(bottomMin, bottomMax);
  const hi = Math.max(bottomMin, bottomMax);

  return {
    right: clamp(right, MARGIN_PX, window.innerWidth - w - MARGIN_PX),
    bottom: clamp(bottom, lo, hi),
  };
}
