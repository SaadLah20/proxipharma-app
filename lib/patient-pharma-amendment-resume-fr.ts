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

function looksTechnicalAmendmentText(text: string): boolean {
  return text.toLowerCase().includes("request_item");
}

function truncateResumeLine(text: string): string {
  return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
}

function lineFromEntry(e: SupplyAmendmentEntryJson): string {
  const summary = (e.summary ?? "").trim();
  const detail = (e.detail ?? "").trim();
  // `summary` inclut le nom produit ; `detail` ne porte souvent que les faits (qté, dispo…).
  if (summary && !looksTechnicalAmendmentText(summary)) {
    return truncateResumeLine(summary);
  }
  if (detail && !looksTechnicalAmendmentText(detail)) {
    return truncateResumeLine(detail);
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
      return "Produit retiré après validation";
    default:
      return "Mise à jour enregistrée";
  }
}

function sortedBundles(bundles: { created_at: string; amendments: unknown }[]) {
  return [...bundles]
    .filter((b) => b?.created_at)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Résumé structuré de tous les amendements post-validation (modale patient). */
export function buildPatientPharmaAmendmentResumeFr(
  bundles: { created_at: string; amendments: unknown }[]
): { whenLabel: string; sections: PatientPharmaAmendmentResumeSection[]; batchCount: number } | null {
  const ordered = sortedBundles(bundles);
  if (ordered.length === 0) return null;

  const buckets: Record<string, string[]> = {
    supply: [],
    added: [],
    withdrawn: [],
  };

  for (const b of ordered) {
    const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
    if (arr.length === 0) continue;
    const when = formatDateTimeShort24hFr(b.created_at);
    for (const e of arr) {
      const sec = sectionForKind(e.kind);
      if (!sec) continue;
      const text = `${when} — ${lineFromEntry(e)}`;
      if (!buckets[sec].includes(text)) buckets[sec].push(text);
    }
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
      title: "Retraits après validation",
      lines: buckets.withdrawn,
    });
  }

  if (sections.length === 0) return null;

  const first = ordered[0]!.created_at;
  const last = ordered[ordered.length - 1]!.created_at;
  const whenLabel =
    ordered.length === 1
      ? formatDateTimeShort24hFr(last)
      : `${formatDateTimeShort24hFr(first)} → ${formatDateTimeShort24hFr(last)} (${ordered.length} mises à jour)`;

  return {
    whenLabel,
    sections,
    batchCount: ordered.length,
  };
}
