import { clsx } from "clsx";

export function productBrandOrNull(brand: string | null | undefined): string | null {
  const trimmed = brand?.trim();
  return trimmed ? trimmed : null;
}

type ProductBrandLabelVariant = "catalog" | "modal";

/** Explorateur catalogue : méta-ligne discrète sous le nom produit. */
function CatalogBrandLabel({ label, className }: { label: string; className?: string }) {
  return (
    <p
      className={clsx(
        "truncate text-[10px] font-medium uppercase tracking-[0.08em] leading-tight text-slate-500",
        className
      )}
      title={label}
    >
      {label}
    </p>
  );
}

/** Modale photo : encart « Marque » mis en avant sous le titre. */
function ModalBrandLabel({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={clsx(
        "inline-flex max-w-full flex-col gap-0.5 rounded-lg border border-amber-200/80 bg-gradient-to-r from-amber-50/95 to-orange-50/40 px-2.5 py-1.5 shadow-sm",
        className
      )}
      title={label}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-amber-800/80">Marque</span>
      <span className="min-w-0 truncate text-[15px] font-bold leading-tight text-amber-950 sm:text-base">
        {label}
      </span>
    </div>
  );
}

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
  if (variant === "modal") {
    return <ModalBrandLabel label={label} className={className} />;
  }
  return <CatalogBrandLabel label={label} className={className} />;
}
