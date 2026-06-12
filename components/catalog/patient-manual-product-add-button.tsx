"use client";

import { PackagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { PRODUCT_CATALOG_SEARCH_MIN_CHARS } from "@/lib/product-catalog-search";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

/** Bouton patient : ajouter un produit introuvable (recherche / explorateur). */
export function PatientManualProductAddButton({
  query,
  onClick,
  disabled,
  className,
}: {
  query: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const td = useTranslations("demandePublic");
  const trimmed = query.trim();
  if (trimmed.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) return null;

  const label =
    trimmed.length > 0
      ? td("manualProductAddNamed", {
          name: trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed,
        })
      : td("manualProductAddGeneric");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-xl border border-sky-300/70 bg-sky-50/80 px-3 py-2.5 text-left text-[11px] font-semibold text-sky-950 transition hover:bg-sky-100/90 disabled:opacity-50",
        className
      )}
    >
      <PackagePlus className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
    </button>
  );
}
