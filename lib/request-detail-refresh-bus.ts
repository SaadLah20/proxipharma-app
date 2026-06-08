/** Rechargement explicite quand une notif ouvre une demande dont l’URL est déjà active (Next ne remonte pas la page). */
export const REQUEST_DETAIL_REFRESH_EVENT = "proxipharma:request-detail-refresh";

/** Même logique pour les réservations packs promo. */
export const PROMO_RESERVATION_DETAIL_REFRESH_EVENT = "proxipharma:promo-reservation-detail-refresh";

export type RequestDetailRefreshFocus = "conversation" | "status";

export type RequestDetailRefreshDetail = {
  /** `requests.id`, aligné avec le segment `:id` des routes demande détail */
  requestId: string;
  focus?: RequestDetailRefreshFocus;
};

export function dispatchRequestDetailRefresh(
  requestId: string,
  opts?: { focus?: RequestDetailRefreshFocus }
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RequestDetailRefreshDetail>(REQUEST_DETAIL_REFRESH_EVENT, {
      detail: { requestId, focus: opts?.focus },
    })
  );
}

/** Extrait `requestId` des liens de détail utilisés dans les notifications. */
export function requestIdFromNotificationDemandeHref(href: string): string | null {
  const cleaned = (href.startsWith("http") ? new URL(href).pathname : href.split("?")[0] ?? "").replace(/\/+$/, "") || "";
  const patterns = [
    /^\/dashboard\/demandes\/([^/]+)$/,
    /^\/dashboard\/pharmacien\/demandes\/([^/]+)$/,
    /^\/admin\/demandes\/([^/]+)$/,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export type PromoReservationDetailRefreshDetail = {
  reservationId: string;
};

export function dispatchPromoReservationDetailRefresh(reservationId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<PromoReservationDetailRefreshDetail>(PROMO_RESERVATION_DETAIL_REFRESH_EVENT, {
      detail: { reservationId },
    }),
  );
}

export function reservationIdFromNotificationPromoHref(href: string): string | null {
  const cleaned = (href.startsWith("http") ? new URL(href).pathname : href.split("?")[0] ?? "").replace(/\/+$/, "") || "";
  const patterns = [
    /^\/dashboard\/patient\/packs-promo\/([^/]+)$/,
    /^\/dashboard\/pharmacien\/reservations-packs\/([^/]+)$/,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function normalizationPath(p: string) {
  return (p.split("?")[0] ?? "").replace(/\/+$/, "") || "";
}

export function notificationHrefTargetsCurrentPath(pathname: string | null | undefined, href: string): boolean {
  const a = normalizationPath(pathname ?? "");
  const b = normalizationPath(href.startsWith("http") ? new URL(href).pathname : href);
  return a !== "" && b !== "" && a === b;
}

export function notificationEventFocusConversation(eventType: string | null | undefined): boolean {
  const t = (eventType ?? "").toLowerCase();
  return t.includes("conversation") || t.includes("message");
}
