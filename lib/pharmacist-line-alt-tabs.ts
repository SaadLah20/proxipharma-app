/** Onglet actif « ajouter une alternative » (affiche le catalogue, masque le bloc produit). */
export const PHARMACIST_ALT_TAB_ADD = "__add_alt__" as const;

export type PharmacistLineAltTabId = "principal" | typeof PHARMACIST_ALT_TAB_ADD | string;

export function pharmacistAltTabLabel(productName: string | null | undefined, rank: number): string {
  const n = productName?.trim();
  if (!n) return `Alt. ${rank}`;
  return n.length > 18 ? `${n.slice(0, 16)}…` : n;
}
