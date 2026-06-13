"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { upsertPharmacistProductOverride } from "@/lib/pharmacy-pricing/api";
import {
  describeActivePricingRule,
  isMarginWithinHardBounds,
  isPriceOutsideSoftWarningBand,
  marginPctFromUnitPrice,
} from "@/lib/pharmacy-pricing/price-adjust";
import { resolvePharmacyUnitPrice } from "@/lib/pharmacy-pricing/resolve";
import type { PharmacyPricingConfig, ProductPricingInput } from "@/lib/pharmacy-pricing/types";
import { formatPriceDh } from "@/lib/product-price";

export type PharmacistLinePriceAdjustTarget = {
  productId: string;
  productName: string;
  brand?: string | null;
  pricingInput: ProductPricingInput;
  currentDraftUnitPrice?: string;
};

type PharmacistLinePriceAdjustModalProps = {
  open: boolean;
  target: PharmacistLinePriceAdjustTarget | null;
  pricingConfig: PharmacyPricingConfig | null;
  onClose: () => void;
  onSaved: (args: { unitPrice: number; config: PharmacyPricingConfig | null }) => void;
  onResetDraft?: () => void;
};

function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type FormProps = {
  target: PharmacistLinePriceAdjustTarget;
  pricingConfig: PharmacyPricingConfig | null;
  initialPrice: string;
  onClose: () => void;
  onSaved: (args: { unitPrice: number; config: PharmacyPricingConfig | null }) => void;
  onResetDraft?: () => void;
};

function PharmacistLinePriceAdjustForm({
  target,
  pricingConfig,
  initialPrice,
  onClose,
  onSaved,
  onResetDraft,
}: FormProps) {
  const pph = target.pricingInput.price_pph ?? null;
  const [priceInput, setPriceInput] = useState(initialPrice);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const enginePrice = useMemo(
    () => (pricingConfig ? resolvePharmacyUnitPrice(pricingConfig, target.pricingInput) : null),
    [pricingConfig, target.pricingInput]
  );

  const activeRule = pricingConfig
    ? describeActivePricingRule(pricingConfig, target.pricingInput)
    : null;

  const parsedPrice = parsePriceInput(priceInput);
  const computedMargin =
    pph != null && parsedPrice != null ? marginPctFromUnitPrice(pph, parsedPrice) : NaN;
  const softWarning =
    pph != null && parsedPrice != null ? isPriceOutsideSoftWarningBand(pph, parsedPrice) : false;
  const hardInvalid = parsedPrice == null || !isMarginWithinHardBounds(computedMargin);

  const handleValidate = async () => {
    if (pph == null || parsedPrice == null) {
      setError("Saisissez un prix valide.");
      return;
    }
    if (!isMarginWithinHardBounds(computedMargin)) {
      setError("Prix hors bornes autorisées (PPH −10 % à PPH +40 %).");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const saved = await upsertPharmacistProductOverride(supabase, target.productId, computedMargin);
      onSaved({ unitPrice: parsedPrice, config: saved });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg" role="dialog" aria-modal="true">
      <h2 className="text-sm font-bold text-foreground">Ajuster le prix</h2>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={target.productName}>
        {target.productName}
        {target.brand ? ` · ${target.brand}` : ""}
      </p>

      <dl className="mt-3 space-y-1.5 rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">PPH référentiel</dt>
          <dd className="font-semibold tabular-nums">{formatPriceDh(pph!)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Règle active</dt>
          <dd className="text-end font-medium">{activeRule?.labelFr ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">PU moteur actuel</dt>
          <dd className="font-semibold tabular-nums">
            {enginePrice != null ? formatPriceDh(enginePrice) : "—"}
          </dd>
        </div>
      </dl>

      <label className="mt-3 block">
        <span className="text-[11px] font-semibold text-foreground">Prix de vente (DH)</span>
        <input
          type="text"
          inputMode="decimal"
          value={priceInput}
          onChange={(e) => {
            setPriceInput(e.target.value);
            setError("");
          }}
          className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-semibold tabular-nums shadow-sm"
          autoFocus
        />
      </label>

      {softWarning && !hardInvalid ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
          Prix inhabituel — vérifiez avant de valider (hors PPH −10 % … PPH +30 %).
        </p>
      ) : null}

      {hardInvalid && priceInput.trim() !== "" ? (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] leading-snug text-rose-900">
          Prix hors bornes autorisées (PPH −10 % à PPH +40 %).
        </p>
      ) : null}

      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        En validant, une règle <strong>produit spécifique</strong> sera enregistrée dans votre moteur de
        pricing (onglet Produits). La marge est calculée automatiquement à partir du PPH.
      </p>

      {error ? <p className="mt-2 text-[11px] font-medium text-rose-700">{error}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {onResetDraft ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mr-auto text-xs"
            disabled={busy}
            onClick={() => {
              onResetDraft();
              onClose();
            }}
          >
            Réinitialiser
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onClose}>
          Annuler
        </Button>
        <Button type="button" size="sm" disabled={busy || hardInvalid} onClick={() => void handleValidate()}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
          Valider le prix
        </Button>
      </div>
    </div>
  );
}

export function PharmacistLinePriceAdjustModal({
  open,
  target,
  pricingConfig,
  onClose,
  onSaved,
  onResetDraft,
}: PharmacistLinePriceAdjustModalProps) {
  const enginePrice = useMemo(() => {
    if (!target || !pricingConfig) return null;
    return resolvePharmacyUnitPrice(pricingConfig, target.pricingInput);
  }, [target, pricingConfig]);

  const initialPrice = useMemo(() => {
    if (!open || !target) return "";
    const draft = parsePriceInput(target.currentDraftUnitPrice ?? "");
    if (draft != null) return draft.toFixed(2);
    if (enginePrice != null) return enginePrice.toFixed(2);
    return "";
  }, [open, target, enginePrice]);

  if (!open || !target || target.pricingInput.price_pph == null) return null;

  const formKey = `${target.productId}:${initialPrice}`;

  return (
    <AppModalOverlay open={open} aria-label="Ajuster le prix unitaire" onBackdropClick={onClose}>
      <PharmacistLinePriceAdjustForm
        key={formKey}
        target={target}
        pricingConfig={pricingConfig}
        initialPrice={initialPrice}
        onClose={onClose}
        onSaved={onSaved}
        onResetDraft={onResetDraft}
      />
    </AppModalOverlay>
  );
}
