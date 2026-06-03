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
  if (inferredStatus === "available") {
    return {
      inferredStatus,
      displayQty: Math.max(1, Math.min(10, args.requestedQty)),
      qtyEditable: false,
    };
  }
  return {
    inferredStatus,
    displayQty: Math.max(1, Math.min(10, availableQty || 1)),
    qtyEditable: true,
  };
}
