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

export function summarizeSupplyAmendmentEntry(row: SupplyAmendmentEntryJson): string {
  const parts = [row.detail, row.summary].filter((x) => x != null && String(x).trim() !== "").map(String);
  const base = parts[0]?.trim();
  const ch = row.client_confirmation_channel ? supplyAmendChannelLabel(row.client_confirmation_channel) : null;
  const mot = row.client_motive?.trim();
  let s = base || row.kind || "Mise à jour";
  if (ch) s = `${s} — confirmé (${ch}${mot ? ` · ${mot}` : ""})`;
  else if (mot) s = `${s} — ${mot}`;
  return s;
}
