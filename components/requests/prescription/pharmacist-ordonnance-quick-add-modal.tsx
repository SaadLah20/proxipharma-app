"use client";

import { clsx } from "clsx";
import { Package, Search, X } from "lucide-react";
import { PHARMACIST_AVAILABILITY_OPTIONS } from "@/lib/pharmacist-availability";
import { availabilityStatusUi } from "@/lib/pharmacist-availability-ui";
import {
  ORDONNANCE_LINE_QTY_MAX,
  clampOrdonnanceRequestedQty,
  inferOrdonnanceLineAvailabilityStatus,
} from "@/lib/prescription-ordonnance-line-qty";

export type OrdonnanceCatalogHit = {
  id: string;
  name: string;
  price_pph?: number | null;
  photo_url?: string | null;
};

function pphLabel(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(Number(v))) return null;
  return `${Number(v).toFixed(2)} MAD`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  lineCount: number;
  busy: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  hits: OrdonnanceCatalogHit[];
  selectedProduct: OrdonnanceCatalogHit | null;
  onSelectProduct: (hit: OrdonnanceCatalogHit) => void;
  requestedQty: string;
  onRequestedQtyChange: (v: string) => void;
  availableQty: string;
  onAvailableQtyChange: (v: string) => void;
  onRequestedQtyNudge: (delta: number) => void;
  onAvailableQtyNudge: (delta: number) => void;
  note: string;
  onNoteChange: (v: string) => void;
  availability: string;
  onAvailabilityChange: (v: string) => void;
  expectedDate: string;
  onExpectedDateChange: (v: string) => void;
  receptionDateMin: string;
  onConfirmAdd: () => void | Promise<void>;
};

function QtyStepper({
  label,
  value,
  disabled,
  minusDisabled,
  plusDisabled,
  onChange,
  onMinus,
  onPlus,
  highlightTeal,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
  onChange: (v: string) => void;
  onMinus: () => void;
  onPlus: () => void;
  highlightTeal?: boolean;
}) {
  return (
    <label className="flex w-[5.75rem] flex-col gap-0.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
        <button
          type="button"
          disabled={disabled || minusDisabled}
          onClick={onMinus}
          className="h-full w-8 border-r border-input text-sm font-bold disabled:opacity-50"
        >
          -
        </button>
        <input
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(
            "h-full w-full border-0 px-1 text-center text-[12px] font-semibold tabular-nums focus:outline-none",
            highlightTeal && "bg-teal-50/90 font-bold text-teal-950 ring-1 ring-teal-200/80"
          )}
        />
        <button
          type="button"
          disabled={disabled || plusDisabled}
          onClick={onPlus}
          className="h-full w-8 border-l border-input text-sm font-bold disabled:opacity-50"
        >
          +
        </button>
      </div>
    </label>
  );
}

export function PharmacistOrdonnanceQuickAddModal(props: Props) {
  const {
    open,
    onClose,
    lineCount,
    busy,
    query,
    onQueryChange,
    hits,
    selectedProduct,
    onSelectProduct,
    requestedQty,
    onRequestedQtyChange,
    availableQty,
    onAvailableQtyChange,
    onRequestedQtyNudge,
    onAvailableQtyNudge,
    note,
    onNoteChange,
    availability,
    onAvailabilityChange,
    expectedDate,
    onExpectedDateChange,
    receptionDateMin,
    onConfirmAdd,
  } = props;

  if (!open) return null;

  const reqN = clampOrdonnanceRequestedQty(parseInt(requestedQty, 10) || 1);
  const availN = parseInt(availableQty, 10);
  const inferredStatus = inferOrdonnanceLineAvailabilityStatus(
    availability,
    reqN,
    Number.isFinite(availN) ? availN : 0
  );
  const availUi = availabilityStatusUi(inferredStatus);
  const InferredIcon = availUi.Icon;
  const needsEta = availability === "to_order" || inferredStatus === "to_order";
  const stockDisabled = availability === "market_shortage" || availability === "unavailable";
  const availParsed = Number.isFinite(availN) ? availN : 0;
  const canAdd =
    Boolean(selectedProduct) &&
    reqN >= 1 &&
    (!needsEta || expectedDate.trim() !== "") &&
    !(availability === "to_order" && availParsed < 1);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter un produit ordonnance"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92svh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-amber-200/80 bg-white shadow-2xl ring-1 ring-amber-200/50 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-amber-100 bg-gradient-to-r from-amber-50/90 to-white px-3 py-2.5">
          <div>
            <p className="text-sm font-bold text-amber-950">Produit ordonnance</p>
            <p className="mt-0.5 text-[11px] text-amber-900/85">
              Qt? prescrite et qt? disponible, comme une demande produits.
            </p>
            <p className="mt-1 text-[10px] font-semibold tabular-nums text-amber-800">
              {lineCount} produit{lineCount !== 1 ? "s" : ""} ordonnance enregistr?{lineCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-amber-900 hover:bg-amber-100/80" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-amber-700" aria-hidden />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Rechercher dans le catalogue (2 car. min.)"
              className="h-11 w-full rounded-xl border-2 border-amber-400/70 bg-white py-2 pl-10 pr-3 text-[13px] shadow-sm ring-2 ring-amber-200/40"
            />
          </div>

          {selectedProduct ? (
            <p className="rounded-lg border border-amber-300/70 bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-semibold text-amber-950">
              S?lectionn? : {selectedProduct.name}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Aucun produit s?lectionn?.</p>
          )}

          {hits.length > 0 ? (
            <ul className="max-h-[min(24svh,180px)] space-y-0.5 overflow-y-auto rounded-md border border-border/60 bg-muted/15 p-1">
              {hits.map((h) => {
                const selected = selectedProduct?.id === h.id;
                return (
                  <li key={h.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSelectProduct(h)}
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition disabled:opacity-50",
                        selected ? "bg-amber-100 ring-2 ring-amber-500/50" : "hover:bg-card"
                      )}
                    >
                      <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-amber-200/60 bg-amber-50/50">
                        {h.photo_url ? (
                          <img src={h.photo_url} alt="" className="size-full object-cover" />
                        ) : (
                          <Package className="size-5 text-amber-600/80" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-foreground">{h.name}</span>
                        {pphLabel(h.price_pph) ? (
                          <span className="mt-0.5 block text-[11px] font-medium text-teal-800">{pphLabel(h.price_pph)}</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : query.trim().length >= 2 ? (
            <p className="text-[11px] text-muted-foreground">Aucun r?sultat.</p>
          ) : (
            <p className="text-[11px] text-muted-foreground">Saisissez au moins 2 caract?res.</p>
          )}

          <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Note officine (facultatif)
            <textarea
              rows={2}
              value={note}
              onChange={(e) => onNoteChange(e.target.value.slice(0, 500))}
              className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
          </label>

          <div className="flex flex-wrap items-end gap-2">
            <QtyStepper
              label="Qt? prescrite"
              value={requestedQty}
              disabled={busy}
              minusDisabled={(parseInt(requestedQty, 10) || 1) <= 1}
              plusDisabled={(parseInt(requestedQty, 10) || 1) >= ORDONNANCE_LINE_QTY_MAX}
              onChange={onRequestedQtyChange}
              onMinus={() => onRequestedQtyNudge(-1)}
              onPlus={() => onRequestedQtyNudge(1)}
            />
            <QtyStepper
              label="Qt? dispo"
              value={availableQty}
              disabled={busy || stockDisabled}
              minusDisabled={stockDisabled || availParsed <= (availability === "to_order" ? 1 : 0)}
              plusDisabled={stockDisabled || availParsed >= reqN}
              onChange={onAvailableQtyChange}
              onMinus={() => onAvailableQtyNudge(-1)}
              onPlus={() => onAvailableQtyNudge(1)}
              highlightTeal={availability === "to_order"}
            />
            <label className="flex min-w-[9rem] flex-1 flex-col gap-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Disponibilit?</span>
              <select
                value={availability === "partially_available" ? "available" : availability}
                disabled={busy}
                onChange={(e) => onAvailabilityChange(e.target.value)}
                className="mt-0.5 h-9 w-full rounded-md border border-input bg-background px-2 text-xs font-medium"
              >
                {PHARMACIST_AVAILABILITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              className={clsx(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-px font-semibold ring-1",
                availUi.badgeClass
              )}
            >
              <InferredIcon className="size-2.5 shrink-0" aria-hidden />
              {availUi.label}
            </span>
            <span>
              Qt? dispo ? prescrite ({reqN} max). Indispo / rupture ? qt? dispo 0.
            </span>
          </p>

          {needsEta ? (
            <label className="flex flex-col gap-1 rounded-xl border-2 border-teal-400/70 bg-gradient-to-br from-teal-50/90 to-white p-2 shadow-sm ring-1 ring-teal-200/50">
              <span className="text-[10px] font-bold uppercase tracking-wide text-teal-950">Date de r?ception pr?vue (obligatoire)</span>
              <input
                type="date"
                min={receptionDateMin}
                value={expectedDate}
                onChange={(e) => onExpectedDateChange(e.target.value)}
                className="h-10 w-full rounded-lg border-2 border-teal-300/80 bg-white px-2 text-[13px] font-semibold tabular-nums shadow-inner"
              />
            </label>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-amber-100 bg-amber-50/40 p-3">
          <button
            type="button"
            disabled={busy || !canAdd}
            onClick={() => void onConfirmAdd()}
            className="flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-amber-800 disabled:opacity-50"
          >
            {busy ? "Ajout en cours..." : "Ajouter le produit ordonnance"}
          </button>
        </div>
      </div>
    </div>
  );
}
