/** Libellé produit / cadeau — décode les entités HTML du catalogue (ex. &#8211;). */
export function promoProductDisplayName(name: string | null | undefined, fallback = "Produit"): string {
  const raw = name?.trim();
  if (!raw) return fallback;

  return raw
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
