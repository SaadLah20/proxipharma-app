import { clsx } from "clsx";

export function productBrandOrNull(brand: string | null | undefined): string | null {
  const trimmed = brand?.trim();
  return trimmed ? trimmed : null;
}

/** Libellé marque sous le nom produit (catalogue, lignes dossier). */
export function ProductBrandLabel({
  brand,
  className,
}: {
  brand?: string | null;
  className?: string;
}) {
  const label = productBrandOrNull(brand);
  if (!label) return null;
  return (
    <p className={clsx("truncate text-[10px] font-medium leading-tight text-muted-foreground", className)} title={label}>
      {label}
    </p>
  );
}
