/** Normalise un numéro saisi (Maroc fréquent + usage international) vers E.164 pour Supabase Phone Auth. */
export function normalizePhoneToE164(input: string): string | null {
  const t = input.trim().replace(/[\s.-]/g, "");
  if (!t) return null;
  if (t.startsWith("+")) {
    const rest = t.slice(1).replace(/\D/g, "");
    return rest.length >= 8 ? `+${rest}` : null;
  }
  const d = t.replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 10) {
    return `+212${d.slice(1)}`;
  }
  if (d.startsWith("212") && d.length >= 11) {
    return `+${d}`;
  }
  if (d.length === 9) {
    return `+212${d}`;
  }
  if (d.length >= 8 && d.length <= 15) {
    return `+${d}`;
  }
  return null;
}
