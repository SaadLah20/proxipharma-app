import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";

/** Plafond saisie qté prescrite / dispo (lignes ordonnance pharmacien). */
export const ORDONNANCE_LINE_QTY_MAX = 999;

export function clampOrdonnanceRequestedQty(n: number): number {
  return Math.min(ORDONNANCE_LINE_QTY_MAX, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));
}

export function clampOrdonnanceAvailableQty(n: number, requestedQty: number): number {
  const req = clampOrdonnanceRequestedQty(requestedQty);
  return Math.max(0, Math.min(req, Math.floor(Number.isFinite(n) ? n : 0)));
}

export function ordonnanceDraftRequestedQty(row: { requested_qty: number }, f?: { requested_qty_str?: string }): number {
  if (f?.requested_qty_str != null && f.requested_qty_str.trim() !== "") {
    const n = Number(f.requested_qty_str);
    if (Number.isFinite(n) && n >= 1) return clampOrdonnanceRequestedQty(n);
  }
  return clampOrdonnanceRequestedQty(Number(row.requested_qty) || 1);
}

export function inferOrdonnanceLineAvailabilityStatus(
  availability: string,
  requestedQty: number,
  availableQty: number
): string {
  return inferAvailabilityStatusFromQty({
    status: availability,
    availableQty,
    requestedQty,
    isProposedLine: false,
  });
}

/** Applique le changement de disponibilité (rupture / indispo → qté dispo 0). */
export function applyOrdonnanceAvailabilityChange(
  nextAvailability: string,
  requestedQty: number,
  availableQty: number
): { availability: string; availableQty: number } {
  const req = clampOrdonnanceRequestedQty(requestedQty);
  let avail = clampOrdonnanceAvailableQty(availableQty, req);

  if (nextAvailability === "market_shortage" || nextAvailability === "unavailable") {
    avail = 0;
    return { availability: nextAvailability, availableQty: avail };
  }
  if (nextAvailability === "to_order") {
    avail = Math.max(1, Math.min(req, avail || req));
    return { availability: "to_order", availableQty: avail };
  }
  if (nextAvailability === "available" && avail <= 0) {
    avail = req;
  }
  avail = clampOrdonnanceAvailableQty(avail, req);
  const inferred = inferOrdonnanceLineAvailabilityStatus("available", req, avail);
  return {
    availability: inferred === "partially_available" ? "available" : inferred,
    availableQty: avail,
  };
}

/** Met à jour la qté prescrite ; resynchronise la qté dispo si elle suivait l’ancienne valeur. */
export function applyOrdonnanceRequestedQtyChange(
  raw: string,
  prevRequested: number,
  availableQty: number,
  availability: string
): { requestedQty: number; availableQty: number; availability: string } | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return null;
  const req = clampOrdonnanceRequestedQty(Number(digits));
  let avail = clampOrdonnanceAvailableQty(availableQty, prevRequested);
  if (avail === prevRequested || avail > req) {
    avail = req;
  }
  if (availability === "market_shortage" || availability === "unavailable") {
    return { requestedQty: req, availableQty: 0, availability };
  }
  const patch = applyOrdonnanceAvailabilityChange(availability, req, avail);
  return { requestedQty: req, availableQty: patch.availableQty, availability: patch.availability };
}

/** Met à jour la qté dispo (plafonnée à la qté prescrite) et réinfère le statut. */
export function applyOrdonnanceAvailableQtyChange(
  raw: string,
  requestedQty: number,
  availability: string
): { availableQty: number; availability: string } | null {
  if (availability === "market_shortage") return null;
  const req = clampOrdonnanceRequestedQty(requestedQty);
  if (availability === "to_order") {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") return null;
    const n = Math.min(req, Math.max(1, Number(digits)));
    return { availableQty: Number.isFinite(n) ? n : 1, availability: "to_order" };
  }
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return null;
  const n = clampOrdonnanceAvailableQty(Number(digits), req);
  const inferred = inferOrdonnanceLineAvailabilityStatus("available", req, n);
  return {
    availableQty: n,
    availability: inferred,
  };
}

export function nudgeOrdonnanceAvailableQty(
  delta: number,
  requestedQty: number,
  availableQty: number,
  availability: string
): { availableQty: number; availability: string } {
  const req = clampOrdonnanceRequestedQty(requestedQty);
  if (availability === "to_order") {
    const cur = Number(availableQty) || 1;
    const next = Math.min(req, Math.max(1, cur + delta));
    return { availableQty: next, availability: "to_order" };
  }
  const floor = 0;
  const cur = Number(availableQty) || 0;
  const next = clampOrdonnanceAvailableQty(cur + delta, req);
  const inferred = inferOrdonnanceLineAvailabilityStatus("available", req, Math.max(floor, next));
  return { availableQty: Math.max(floor, next), availability: inferred };
}

export function nudgeOrdonnanceRequestedQty(
  delta: number,
  requestedQty: number,
  availableQty: number,
  availability: string
): { requestedQty: number; availableQty: number; availability: string } {
  const nextReq = clampOrdonnanceRequestedQty(requestedQty + delta);
  const applied = applyOrdonnanceRequestedQtyChange(
    String(nextReq),
    requestedQty,
    availableQty,
    availability
  );
  return applied ?? { requestedQty: nextReq, availableQty, availability };
}
