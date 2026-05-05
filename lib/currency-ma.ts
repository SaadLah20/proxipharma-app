/** Affichage dirham (Maroc), ex. « 34,20 DH » */
export function formatDh(amount: number): string {
  const n = new Intl.NumberFormat("fr-MA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${n}\u00a0DH`;
}
