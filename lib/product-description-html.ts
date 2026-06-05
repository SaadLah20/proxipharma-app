/** Retire le pied de page BoatScrape des imports WooCommerce. */
export function productDescriptionHtmlForDisplay(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const cleaned = t
    .replace(/<p>\s*Exported using[\s\S]*?BoatScrape[\s\S]*?<\/p>/gi, "")
    .replace(/<p>\s*&nbsp;\s*<\/p>/gi, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
