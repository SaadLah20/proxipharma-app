export type ConsultationDetailTab = "conversation" | "products";

/** Onglet par défaut : conversation tant que la réponse n’est pas publiée (`responded`). */
export function getConsultationDefaultTab(
  status: string,
  respondedAt: string | null | undefined
): ConsultationDetailTab {
  const responded =
    Boolean(respondedAt?.trim()) ||
    ["responded", "confirmed", "treated", "completed", "partially_collected", "fully_collected"].includes(status);
  return responded ? "products" : "conversation";
}
