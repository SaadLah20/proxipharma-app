import { clsx } from "clsx";

export function productBrandOrNull(brand: string | null | undefined): string | null {
  const trimmed = brand?.trim();
  return trimmed ? trimmed : null;
}

export function isMedicamentProductType(productType?: string | null): boolean {
  return productType?.trim().toLowerCase() === "medicament";
}

type ProductCatalogMetaVariant = "catalog" | "modal";

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

/** Explorateur catalogue : pastille médicament. */
function CatalogMedicamentLabel({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex w-fit max-w-full truncate rounded-full border border-sky-200/85 bg-sky-50/95 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.12em] text-sky-800",
        className
      )}
    >
      Médicament
    </span>
  );
}

/** Modale photo : encart type médicament. */
function ModalMedicamentLabel({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "inline-flex max-w-full flex-col gap-0.5 rounded-lg border border-sky-200/85 bg-gradient-to-r from-sky-50/95 to-cyan-50/45 px-2.5 py-1.5 shadow-sm",
        className
      )}
    >
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-sky-800/85">Type</span>
      <span className="min-w-0 truncate text-[15px] font-bold leading-tight text-sky-950 sm:text-base">
        Médicament
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
  variant?: ProductCatalogMetaVariant;
}) {
  const label = productBrandOrNull(brand);
  if (!label) return null;
  if (variant === "modal") {
    return <ModalBrandLabel label={label} className={className} />;
  }
  return <CatalogBrandLabel label={label} className={className} />;
}

/** Marque (parapharmacie) ou libellé Médicament — explorateur + modale photo uniquement. */
export function ProductCatalogMetaLabel({
  productType,
  brand,
  className,
  variant = "catalog",
}: {
  productType?: string | null;
  brand?: string | null;
  className?: string;
  variant?: ProductCatalogMetaVariant;
}) {
  if (isMedicamentProductType(productType)) {
    return variant === "modal" ? (
      <ModalMedicamentLabel className={className} />
    ) : (
      <CatalogMedicamentLabel className={className} />
    );
  }
  return <ProductBrandLabel brand={brand} variant={variant} className={className} />;
}
