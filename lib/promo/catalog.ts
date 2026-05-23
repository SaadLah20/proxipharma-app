export type PromoCatalogProduct = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  price_pph: number | null;
  price_ppv: number | null;
  photo_url: string | null;
};

export function filterPromoCatalogProducts(products: PromoCatalogProduct[], query: string): PromoCatalogProduct[] {
  const q = query.trim().toLowerCase();
  if (!q) return products.slice(0, 40);
  return products
    .filter((p) => {
      const name = p.name.toLowerCase();
      const lab = (p.laboratory ?? "").toLowerCase();
      return name.includes(q) || lab.includes(q);
    })
    .slice(0, 40);
}
