import { supplyAmendmentBodyFact } from "@/lib/product-line-history/line-event-labels-fr";

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

function splitAmendmentDetailFacts(detail: string): string[] {
  const raw = detail.trim();
  if (!raw) return [];
  const withoutProductPrefix = raw.includes(" — ")
    ? raw.slice(raw.indexOf(" — ") + 3).trim() || raw
    : raw;
  return withoutProductPrefix
    .split(/\s*[·•]\s*|\s+—\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Une ligne d’historique = un fait (sans « · » ni « — »). */
export function summarizeSupplyAmendmentEntryLines(
  row: SupplyAmendmentEntryJson,
  audience: "patient" | "pharmacist" = "patient"
): string[] {
  const lines: string[] = [];
  const detail = (row.detail ?? row.summary ?? "").trim();
  const facts = detail && !detail.toLowerCase().includes("request_item") ? splitAmendmentDetailFacts(detail) : [];
  if (facts.length > 0) {
    for (const fact of facts) {
      const short = fact.length > 200 ? `${fact.slice(0, 197).trim()}…` : fact;
      lines.push(short);
    }
  }
  if (lines.length === 0) {
    const fromKind = supplyAmendmentBodyFact(row.kind, audience);
    if (fromKind) lines.push(fromKind);
    else lines.push("Mise à jour enregistrée");
  }
  const ch = row.client_confirmation_channel ? supplyAmendChannelLabel(row.client_confirmation_channel) : null;
  const mot = row.client_motive?.trim();
  if (ch) lines.push(`Accord patient : ${ch}`);
  if (mot) lines.push(`Précision : ${mot}`);
  return lines;
}

/** Texte naturel pour l'historique produit / dossier (sans identifiants techniques). */
export function summarizeSupplyAmendmentEntry(
  row: SupplyAmendmentEntryJson,
  audience: "patient" | "pharmacist" = "patient"
): string {
  return summarizeSupplyAmendmentEntryLines(row, audience).join("\n");
}
