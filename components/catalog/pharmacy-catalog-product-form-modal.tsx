"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Loader2, PackagePlus } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  emptyPharmacyCatalogProductForm,
  type PharmacyCatalogProductFormValues,
  type UnifiedCatalogHit,
} from "@/lib/pharmacy-catalog-types";
import { createPharmacyCatalogProduct, pharmacyCatalogRowToHit } from "@/lib/pharmacy-catalog-api";
import { supabase } from "@/lib/supabase";

export type PharmacyCatalogProductFormModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (hit: UnifiedCatalogHit) => void;
  prefillName?: string;
  /** Édition hub (optionnel phase A). */
  editProductId?: string | null;
  initialValues?: PharmacyCatalogProductFormValues | null;
  onUpdated?: () => void;
};

function validateForm(values: PharmacyCatalogProductFormValues): string | null {
  if (!values.name.trim()) return "Le nom est obligatoire.";
  if (values.product_type === "parapharmacie" && !values.price_pph.trim()) {
    return "Le PPH est obligatoire pour la parapharmacie.";
  }
  if (values.product_type === "medicament" && !values.price_ppv.trim()) {
    return "Le PPV est obligatoire pour les médicaments.";
  }
  return null;
}

export function PharmacyCatalogProductFormModal({
  open,
  onClose,
  onCreated,
  prefillName = "",
  editProductId = null,
  initialValues = null,
  onUpdated,
}: PharmacyCatalogProductFormModalProps) {
  const [values, setValues] = useState<PharmacyCatalogProductFormValues>(() =>
    initialValues ?? emptyPharmacyCatalogProductForm(prefillName)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isEdit = Boolean(editProductId);

  const resetAndClose = () => {
    setError("");
    setValues(initialValues ?? emptyPharmacyCatalogProductForm(prefillName));
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const validation = validateForm(values);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    try {
      if (isEdit && editProductId) {
        const { updatePharmacyCatalogProduct } = await import("@/lib/pharmacy-catalog-api");
        await updatePharmacyCatalogProduct(supabase, editProductId, values);
        onUpdated?.();
        resetAndClose();
      } else {
        const row = await createPharmacyCatalogProduct(supabase, values);
        onCreated(pharmacyCatalogRowToHit(row));
        resetAndClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AppModalOverlay open aria-labelledby="pharmacy-catalog-product-modal-title" onBackdropClick={resetAndClose}>
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="border-b border-border px-4 py-3">
          <h2 id="pharmacy-catalog-product-modal-title" className="text-sm font-bold text-foreground">
            {isEdit ? "Modifier le produit" : "Ajouter un produit à mon catalogue"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Visible uniquement sur votre officine jusqu&apos;à publication par Pharmeto.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-foreground">Nom *</span>
            <input
              type="text"
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              autoFocus
            />
          </label>

          <fieldset className="space-y-1">
            <legend className="text-xs font-semibold text-foreground">Type *</legend>
            <div className="flex gap-2">
              {(["parapharmacie", "medicament"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, product_type: t }))}
                  className={clsx(
                    "flex-1 rounded-lg border px-3 py-2 text-xs font-semibold",
                    values.product_type === t
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {t === "parapharmacie" ? "Parapharmacie" : "Médicament"}
                </button>
              ))}
            </div>
          </fieldset>

          {values.product_type === "parapharmacie" ? (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">PPH (MAD) *</span>
              <input
                type="text"
                inputMode="decimal"
                value={values.price_pph}
                onChange={(e) => setValues((v) => ({ ...v, price_pph: e.target.value }))}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
          ) : (
            <label className="block space-y-1">
              <span className="text-xs font-semibold text-foreground">PPV (MAD) *</span>
              <input
                type="text"
                inputMode="decimal"
                value={values.price_ppv}
                onChange={(e) => setValues((v) => ({ ...v, price_ppv: e.target.value }))}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              />
            </label>
          )}

          <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
              Informations facultatives
            </summary>
            <div className="mt-2 space-y-2">
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Marque</span>
                <input
                  type="text"
                  value={values.brand}
                  onChange={(e) => setValues((v) => ({ ...v, brand: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Laboratoire</span>
                <input
                  type="text"
                  value={values.laboratory}
                  onChange={(e) => setValues((v) => ({ ...v, laboratory: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">URL photo</span>
                <input
                  type="url"
                  value={values.photo_url}
                  onChange={(e) => setValues((v) => ({ ...v, photo_url: e.target.value }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
                />
              </label>
            </div>
          </details>

          {error ? (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 border-t border-border pt-3">
            <button
              type="button"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
              onClick={resetAndClose}
              disabled={busy}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              disabled={busy}
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
              {isEdit ? "Enregistrer" : "Ajouter au catalogue"}
            </button>
          </div>
        </form>
      </div>
    </AppModalOverlay>
  );
}

export type CatalogProductAddButtonVariant = "sky" | "teal" | "amber" | "neutral";

const variantClasses: Record<CatalogProductAddButtonVariant, string> = {
  sky: "border-sky-300/70 bg-sky-50/80 text-sky-950 hover:bg-sky-100/90",
  teal: "border-teal-300/70 bg-teal-50/80 text-teal-950 hover:bg-teal-100/90",
  amber: "border-amber-300/70 bg-amber-50/80 text-amber-950 hover:bg-amber-100/90",
  neutral: "border-border bg-muted/40 text-foreground hover:bg-muted/70",
};

/** Bouton sous les résultats de recherche (ou seul si aucun hit). */
export function CatalogProductAddButton({
  query,
  debouncedLen,
  hitCount,
  variant = "sky",
  onClick,
  disabled,
}: {
  query: string;
  debouncedLen: number;
  hitCount: number;
  variant?: CatalogProductAddButtonVariant;
  onClick: () => void;
  disabled?: boolean;
}) {
  if (debouncedLen < 2) return null;

  const label =
    query.trim().length > 0
      ? `Ajouter « ${query.trim().slice(0, 48)}${query.trim().length > 48 ? "…" : ""} » à mon catalogue`
      : "Ajouter un produit à mon catalogue";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[11px] font-semibold transition disabled:opacity-50",
        variantClasses[variant],
        hitCount === 0 ? "mt-0" : "mt-1.5"
      )}
    >
      <PackagePlus className="size-4 shrink-0 opacity-80" aria-hidden />
      <span className="min-w-0 flex-1 leading-snug">{label}</span>
    </button>
  );
}
