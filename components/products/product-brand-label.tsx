import { clsx } from "clsx";

export function productBrandOrNull(brand: string | null | undefined): string | null {
  const trimmed = brand?.trim();
  return trimmed ? trimmed : null;
}

type ProductBrandLabelVariant = "catalog" | "modal";

const VARIANT_CLASS: Record<ProductBrandLabelVariant, string> = {
  catalog: "text-[11px] font-semibold leading-tight tracking-wide text-slate-700",
  modal: "text-sm font-bold leading-snug text-slate-800",
};

/** Libellé marque — explorateur catalogue et modale photo produit uniquement. */
export function ProductBrandLabel({
  brand,
  className,
  variant = "catalog",
}: {
  brand?: string | null;
  className?: string;
  variant?: ProductBrandLabelVariant;
}) {
  const label = productBrandOrNull(brand);
  if (!label) return null;
  return (
    <p className={clsx(VARIANT_CLASS[variant], className)} title={label}>
      {label}
    </p>
  );
}
