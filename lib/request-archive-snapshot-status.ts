/**
 * Pour les dossiers en statut terminal (annulé, expiré, clôturé…),
 * déduit le statut d’affichage « gelé » (comme avant fermeture), en lecture seule.
 */
export type RequestArchiveSnapshotStatus =
  | "submitted"
  | "in_review"
  | "responded"
  | "confirmed"
  | "treated";

export type ArchiveSnapshotInput = {
  responded_at?: string | null;
  confirmed_at?: string | null;
  items?: { availability_status?: string | null }[];
};

export function inferArchiveSnapshotStatus(
  terminalStatus: string,
  ctx: ArchiveSnapshotInput
): RequestArchiveSnapshotStatus {
  const responded = Boolean(ctx.responded_at?.trim());
  const confirmed = Boolean(ctx.confirmed_at?.trim());
  const hasLineResponse = (ctx.items ?? []).some((i) => {
    const s = i.availability_status;
    return s != null && s !== "" && s !== "unavailable";
  });

  if (
    terminalStatus === "completed" ||
    terminalStatus === "fully_collected" ||
    terminalStatus === "partially_collected"
  ) {
    return "treated";
  }

  if (terminalStatus === "expired") {
    return responded || hasLineResponse ? "responded" : "submitted";
  }

  if (terminalStatus === "cancelled" || terminalStatus === "abandoned") {
    if (confirmed) return "confirmed";
    if (responded || hasLineResponse) return "responded";
    return "submitted";
  }

  return responded ? "responded" : "submitted";
}
