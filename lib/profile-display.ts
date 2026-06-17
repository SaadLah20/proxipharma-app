/** Initiales affichées dans les cartes identité (paramètres patient / pharmacien). */
export function profileInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  const t = (name ?? "").trim();
  return t ? t.slice(0, 2).toUpperCase() : "?";
}
