/** Canaux communiqués par le pharmacien (confirmation préalable du client). Valeurs envoyées telles quelles en base (`client_confirmation_channel`). */
export type SupplyAmendClientChannelSlug =
  | "phone_call"
  | "whatsapp"
  | "sms"
  | "email"
  | "comptoir"
  | "autre";

export const SUPPLY_AMEND_CHANNEL_OPTIONS: { value: SupplyAmendClientChannelSlug; label: string }[] = [
  { value: "phone_call", label: "Appel téléphonique" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Courriel" },
  { value: "comptoir", label: "Comptoir / en personne" },
  { value: "autre", label: "Autre canal" },
];

export function supplyAmendChannelLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const hit = SUPPLY_AMEND_CHANNEL_OPTIONS.find((o) => o.value === raw.trim());
  return hit?.label ?? raw.trim();
}

/** Entrées stockées en `request_supply_amendments.amendments` */
export type SupplyAmendmentEntryJson = {
  kind?: string;
  summary?: string;
  /** id request_items quand pertinent */
  request_item_id?: string;
  /** Brève description du fait (pour le listing patient) */
  detail?: string;
  client_confirmation_channel?: string;
  client_motive?: string | null;
};

function kindNaturalFr(kind: string | undefined, audience: "patient" | "pharmacist"): string | null {
  const ph = audience === "pharmacist";
  switch (kind) {
    case "withdraw_after_confirm":
      return ph
        ? "Produit retiré de la commande active (accord patient)"
        : "Retiré de votre commande après validation";
    case "reintegrate_after_confirm":
    case "reintegrate":
      return ph ? "Produit réintégré dans la commande" : "Réintégré dans votre commande";
    case "validated_qty_change":
      return ph ? "Quantité validée ajustée" : "Quantité validée modifiée";
    case "line_added_after_confirm":
      return ph ? "Produit ajouté après validation patient" : "Produit ajouté par la pharmacie";
    case "line_removed_after_confirm":
      return ph ? "Produit retiré après validation" : "Produit retiré par la pharmacie";
    case "line_brought_to_reserve_after_validation":
      return ph ? "Passage en « à réserver »" : "Replacé en réservation en officine";
    case "line_adjust_supply":
      return ph ? "Disponibilité ou quantité modifiée" : "Disponibilité ou quantité modifiée";
    default:
      return null;
  }
}

/** Texte naturel pour l'historique produit / dossier (sans identifiants techniques). */
export function summarizeSupplyAmendmentEntry(
  row: SupplyAmendmentEntryJson,
  audience: "patient" | "pharmacist" = "patient"
): string {
  const detail = (row.detail ?? row.summary ?? "").trim();
  const fromKind = kindNaturalFr(row.kind, audience);
  let main = fromKind ?? "Mise à jour enregistrée";
  if (detail && !detail.toLowerCase().includes("request_item")) {
    const short =
      detail.length > 140 ? `${detail.slice(0, 137).trim()}…` : detail;
    if (!fromKind || !short.toLowerCase().includes(main.toLowerCase().slice(0, 12))) {
      main = `${main} — ${short}`;
    }
  }
  const ch = row.client_confirmation_channel ? supplyAmendChannelLabel(row.client_confirmation_channel) : null;
  const mot = row.client_motive?.trim();
  if (ch) {
    main = `${main}. Accord patient : ${ch}${mot ? ` (${mot})` : ""}.`;
  } else if (mot) {
    main = `${main}. Précision : ${mot}.`;
  }
  return main;
}
