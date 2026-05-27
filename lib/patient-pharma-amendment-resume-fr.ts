import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";

export type PatientPharmaAmendmentResumeSection = {
  id: string;
  title: string;
  lines: string[];
};

function sectionForKind(kind: string | undefined): PatientPharmaAmendmentResumeSection["id"] | null {
  switch (kind) {
    case "validated_qty_change":
    case "line_adjust_supply":
      return "supply";
    case "line_added_after_confirm":
      return "added";
    case "withdraw_after_confirm":
    case "line_removed_after_confirm":
      return "withdrawn";
    default:
      return null;
  }
}

function lineFromEntry(e: SupplyAmendmentEntryJson): string {
  const detail = (e.detail ?? e.summary ?? "").trim();
  if (detail && !detail.toLowerCase().includes("request_item")) {
    return detail.length > 140 ? `${detail.slice(0, 137).trim()}…` : detail;
  }
  switch (e.kind) {
    case "validated_qty_change":
      return "Quantité validée modifiée";
    case "line_adjust_supply":
      return "Disponibilité ou quantité modifiée";
    case "line_added_after_confirm":
      return "Produit ajouté par la pharmacie";
    case "withdraw_after_confirm":
    case "line_removed_after_confirm":
      return "Produit écarté après validation";
    default:
      return "Mise à jour enregistrée";
  }
}

/** Résumé structuré des amendements post-validation (modale patient). */
export function buildPatientPharmaAmendmentResumeFr(
  bundles: { created_at: string; amendments: unknown }[]
): { whenLabel: string; sections: PatientPharmaAmendmentResumeSection[] } | null {
  const b = bundles[0];
  if (!b?.created_at) return null;
  const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
  if (arr.length === 0) return null;

  const buckets: Record<string, string[]> = {
    supply: [],
    added: [],
    withdrawn: [],
  };

  for (const e of arr) {
    const sec = sectionForKind(e.kind);
    if (!sec) continue;
    const text = lineFromEntry(e);
    if (!buckets[sec].includes(text)) buckets[sec].push(text);
  }

  const sections: PatientPharmaAmendmentResumeSection[] = [];
  if (buckets.supply.length > 0) {
    sections.push({
      id: "supply",
      title: "Produits validés modifiés",
      lines: buckets.supply,
    });
  }
  if (buckets.added.length > 0) {
    sections.push({
      id: "added",
      title: "Ajouts après validation",
      lines: buckets.added,
    });
  }
  if (buckets.withdrawn.length > 0) {
    sections.push({
      id: "withdrawn",
      title: "Écarts après validation",
      lines: buckets.withdrawn,
    });
  }

  if (sections.length === 0) return null;

  return {
    whenLabel: formatDateTimeShort24hFr(b.created_at),
    sections,
  };
}
