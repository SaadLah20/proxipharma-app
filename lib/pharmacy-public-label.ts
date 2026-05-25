/** Libellé public : préfixe « Pharmacie » si le nom stocké ne l’inclut pas déjà. */
export function pharmacyPublicLabel(nom: string | null | undefined): string {
  const raw = (nom ?? "").trim();
  if (!raw) return "Cette pharmacie";
  if (/^pharmacie\b/i.test(raw)) return raw;
  return `Pharmacie ${raw}`;
}
