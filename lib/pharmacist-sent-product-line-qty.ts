import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";

/** Qté affichée / éditabilité — saisie pharmacien demande produits envoyée. */
export function pharmacistSentProductLineQtyUi(args: {
  draftStatus: string;
  availableQtyStr: string;
  requestedQty: number;
  isProposedLine: boolean;
}): {
  inferredStatus: string;
  displayQty: number;
  qtyEditable: boolean;
} {
  const parsed = Number(args.availableQtyStr || "0");
  const availableQty = Number.isFinite(parsed) ? parsed : 0;
  const inferredStatus = inferAvailabilityStatusFromQty({
    status: args.draftStatus,
    availableQty,
    requestedQty: args.requestedQty,
    isProposedLine: args.isProposedLine,
  });

  if (inferredStatus === "unavailable" || inferredStatus === "market_shortage") {
    return { inferredStatus, displayQty: 0, qtyEditable: false };
  }
  /** Proposition officine : qté réglée sur la carte (1–10), comme la dispo. */
  if (args.isProposedLine) {
    return {
      inferredStatus,
      displayQty: Math.max(1, Math.min(10, availableQty || 1)),
      qtyEditable: true,
    };
  }
  /** « Disponible » : qté éditable (1…demandée) ; si qté < demandée → partiellement disponible (inféré). */
  if (inferredStatus === "available") {
    const displayQty = Math.max(
      1,
      Math.min(10, availableQty > 0 ? availableQty : args.requestedQty)
    );
    return {
      inferredStatus,
      displayQty,
      qtyEditable: true,
    };
  }
  return {
    inferredStatus,
    displayQty: Math.max(1, Math.min(10, availableQty || 1)),
    qtyEditable: true,
  };
}
