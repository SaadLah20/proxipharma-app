/** Normalise une saisie pour la comparer aux codes affichés (PH001R, P0001-K, D042/26). */
export function normalizePublicRefInput(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/−/g, "-");
}

const stripRefNoise = (s: string) => s.replace(/[^A-Z0-9/]/g, "");

/** Filtre annuaire / listes : la requête doit matcher au moins un champ mémorisé (substring). */
export function rowMatchesPublicRefQuery(query: string, fields: (string | null | undefined)[]): boolean {
  const q = normalizePublicRefInput(query);
  if (q.length < 2) return true;
  const cq = stripRefNoise(q);
  for (const f of fields) {
    if (f == null || f === "") continue;
    const n = normalizePublicRefInput(f);
    if (n.includes(q) || stripRefNoise(n).includes(cq)) return true;
  }
  return false;
}

/** Ref demande lisible ou repli UUID court pour affichage. */
export function displayRequestPublicRef(row: { request_public_ref?: string | null; id?: string }) {
  const r = row.request_public_ref?.trim();
  if (r) return r;
  if (row.id) return `#${row.id.replace(/-/g, "").slice(0, 8)}`;
  return "—";
}
