import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";
import { validatedProductLabel } from "@/lib/patient-confirmed-line-buckets";

function oneProdAlt(p: unknown): { name?: string | null } | undefined {
  if (!p) return undefined;
  return Array.isArray(p) ? (p[0] as { name?: string | null }) : (p as { name?: string | null });
}

export function principalProductName(row: PatientLineLike): string {
  return oneProdAlt(row.products)?.name?.trim() || "Produit";
}

export function normalizedProductTokensForTimeline(row: PatientLineLike): { principal: string; validated: string } {
  const principal = principalProductName(row).toLowerCase();
  const validated = validatedProductLabel(row).toLowerCase().trim();
  return { principal, validated };
}

export function productMatchesTimeline(row: PatientLineLike, auditProductName: string): boolean {
  const { principal, validated } = normalizedProductTokensForTimeline(row);
  const raw = auditProductName.toLowerCase().trim();
  return raw === validated || raw === principal;
}

export function reasonMentionsLine(row: PatientLineLike, reason: string | null | undefined): boolean {
  const r = (reason ?? "").trim();
  if (!r) return false;
  const { principal, validated } = normalizedProductTokensForTimeline(row);
  const rl = r.toLowerCase();
  return rl.includes(validated) || rl.includes(principal);
}
