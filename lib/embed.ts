/** Normalise les relations Supabase (objet ou tableau d’un seul élément). */
export function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
