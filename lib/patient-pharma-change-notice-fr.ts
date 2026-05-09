import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { summarizeSupplyAmendmentEntry } from "@/lib/supply-amendment-channels";

/** Bandeau court : dernier lot d’amendements post-validation côté patient. */
export function patientLatestSupplyAmendmentNoticeFr(
  bundles: { created_at: string; amendments: unknown }[]
): { whenLabel: string; lines: string[] } | null {
  const b = bundles[0];
  if (!b?.created_at) return null;
  const arr = Array.isArray(b.amendments) ? (b.amendments as SupplyAmendmentEntryJson[]) : [];
  if (arr.length === 0) return null;
  const lines = arr.map((e) => summarizeSupplyAmendmentEntry(e)).filter((s) => s.trim().length > 0);
  if (lines.length === 0) return null;
  return {
    whenLabel: formatDateTimeShort24hFr(b.created_at),
    lines: lines.slice(0, 6),
  };
}
