"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronDown, LayoutGrid, MessageCircle, MessageSquare, Package, Search, Trash2, X } from "lucide-react";
import { PharmacyFlowHero } from "@/components/pharmacy/pharmacy-public-chrome";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import type { PatientDemandeProduitsDraftLine } from "@/lib/patient-demande-produits-draft";

/** Vignette compacte — la hauteur du bloc suit la photo (items-stretch). */
export const PRODUCT_REQUEST_LINE_THUMB =
  "box-border size-14 shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";
/** Alias compat (lecture seule / grilles). */
export const PRODUCT_REQUEST_LINE_BLOCK_H = "min-h-14";
/** Contour discret sans changer la boîte de contenu (ombre interne). */
export const PRODUCT_REQUEST_LINE_CARD_SHELL =
  "rounded-lg [box-shadow:inset_0_0_0_1px_rgba(14,165,233,0.22)]";
const THUMB = PRODUCT_REQUEST_LINE_THUMB;

function ProductRequestLinePu({ unitPrice }: { unitPrice: number | null }) {
  return (
    <p className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-none">
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">PU</span>
      <PriceDhInline
        value={unitPrice}
        amountClassName="text-sm font-bold text-foreground"
        suffixClassName="text-[10px] font-semibold text-muted-foreground"
      />
    </p>
  );
}

function ProductRequestLineTotIndicative({ totalValue }: { totalValue: number | null }) {
  return (
    <p className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-none text-muted-foreground">
      <span className="shrink-0 text-[9px] font-medium">Total</span>
      {totalValue != null ? (
        <PriceDhInline
          value={totalValue}
          amountClassName="text-[10px] font-medium"
          suffixClassName="text-[9px] font-medium"
        />
      ) : (
        <span className="text-[10px] font-medium">—</span>
      )}
    </p>
  );
}

function ProductRequestLinePrices({
  unitPrice,
  totalValue,
}: {
  unitPrice: number | null;
  totalValue: number | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 leading-none">
      <ProductRequestLinePu unitPrice={unitPrice} />
      <ProductRequestLineTotIndicative totalValue={totalValue} />
    </div>
  );
}

const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Libellé quantité (lecture seule ou dans le sélecteur). */
function ProductRequestLineQtyLabel({ qty, className }: { qty: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1 whitespace-nowrap leading-none", className)}>
      <span className="text-[10px] font-medium text-muted-foreground">Quantité&nbsp;:</span>
      <span className="text-[12px] font-semibold tabular-nums text-foreground">{qty}</span>
    </span>
  );
}

/** Qté lecture seule (alignée sur le sélecteur). */
export function ProductRequestLineQtyReadonly({ qty }: { qty: number }) {
  return (
    <span
      className="inline-flex h-7 w-full max-w-[6.75rem] items-center justify-center rounded-full border border-sky-200/80 bg-sky-50/80 px-2.5"
      aria-label={`Quantité ${qty}`}
    >
      <ProductRequestLineQtyLabel qty={qty} />
    </span>
  );
}

/** Bouton quantité + liste 1–10 (parcours demande de produits). */
export function ProductRequestLineQtyPicker({
  qty,
  disabled,
  onSelect,
}: {
  qty: number;
  disabled?: boolean;
  onSelect: (qty: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const syncMenuPos = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuPos({ top: r.bottom + 4, left: r.left + r.width / 2 });
  };

  useEffect(() => {
    if (!open) return;
    syncMenuPos();
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      const menu = document.getElementById(listId);
      if (menu?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onReflow = () => syncMenuPos();
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, listId]);

  if (disabled) return <ProductRequestLineQtyReadonly qty={qty} />;

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            aria-label="Choisir la quantité"
            style={{ top: menuPos.top, left: menuPos.left }}
            className={cn(
              "fixed z-[120] max-h-44 w-[4.25rem] -translate-x-1/2 overflow-y-auto overscroll-y-contain rounded-xl border bg-card py-1 shadow-xl",
              t.shell
            )}
          >
            {QTY_OPTIONS.map((n) => (
              <li key={n} role="option" aria-selected={n === qty}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center px-2 py-1.5 text-[13px] font-semibold tabular-nums transition hover:bg-sky-50",
                    n === qty ? "bg-sky-100/90 text-sky-950" : "text-foreground"
                  )}
                  onClick={() => {
                    onSelect(n);
                    setOpen(false);
                  }}
                >
                  {n}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Quantité ${qty}, choisir une autre valeur`}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) syncMenuPos();
            return next;
          });
        }}
        className={cn(
          "inline-flex h-7 w-full max-w-[6.75rem] items-center justify-center gap-0.5 rounded-full border border-sky-300/80 bg-white px-2 shadow-sm transition hover:bg-sky-50",
          open && "border-sky-500/70 ring-2 ring-sky-400/30"
        )}
      >
        <ProductRequestLineQtyLabel qty={qty} />
        <ChevronDown className={cn("size-3 shrink-0 text-sky-700 transition", open && "rotate-180")} aria-hidden />
      </button>
      {menu}
    </div>
  );
}

/** Icône message circulaire (même gabarit que Historique carte validée). */
export function ProductRequestLineMessageIconButton({
  hasComment,
  onClick,
  className,
}: {
  hasComment: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasComment ? "Voir ou modifier le message sur ce produit" : "Ajouter un message sur ce produit"}
      title={hasComment ? "Message renseigné" : "Message"}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border shadow-sm transition",
        hasComment
          ? "border-sky-400/70 bg-sky-100 text-sky-900 hover:bg-sky-200/80"
          : "border-sky-200/70 bg-white text-sky-600/80 hover:border-sky-300/80 hover:bg-sky-50 hover:text-sky-800",
        className
      )}
    >
      <MessageCircle className="size-3.5 shrink-0" strokeWidth={hasComment ? 2.35 : 2} aria-hidden />
    </button>
  );
}

/** Supprimer — épinglé coin haut droit du bloc produit. */
export function ProductRequestLineDeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Retirer le produit"
      onClick={onClick}
      className="absolute -right-1.5 -top-1.5 z-10 flex size-7 items-center justify-center rounded-full border border-rose-200/90 bg-white text-destructive shadow-md transition hover:bg-rose-50"
    >
      <Trash2 className="size-3.5" strokeWidth={2.25} aria-hidden />
    </button>
  );
}

/** Ligne panier : photo + un seul bloc à droite (titre pleine largeur, puis prix / actions). */
export function ProductRequestLinePanel({
  title,
  unitPrice,
  totalValue,
  qtyControl,
  bottomRight,
  thumb,
  thumbClassName,
  contentMinHeight,
}: {
  title: ReactNode;
  unitPrice: number | null;
  totalValue: number | null;
  qtyControl: ReactNode;
  bottomRight?: ReactNode;
  thumb: ReactNode;
  thumbClassName?: string;
  contentMinHeight?: string;
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <div className={cn("shrink-0", THUMB, thumbClassName)}>{thumb}</div>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1", contentMinHeight)}>
        <div className="min-w-0 overflow-hidden pe-5 leading-tight">{title}</div>
        <div className="grid w-full grid-cols-[minmax(0,1fr)_6.75rem_1.75rem] items-center gap-x-1.5 overflow-visible">
          <div className="min-w-0 leading-none">
            <ProductRequestLinePrices unitPrice={unitPrice} totalValue={totalValue} />
          </div>
          <div className="flex justify-center overflow-visible">{qtyControl}</div>
          <div className="flex justify-end overflow-visible">{bottomRight ?? null}</div>
        </div>
      </div>
    </div>
  );
}

export function ProductRequestLineMessageButton({
  hasComment,
  onClick,
  className,
}: {
  hasComment: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none whitespace-nowrap transition",
        hasComment
          ? t.noteActive
          : cn("border-border/80 bg-card text-muted-foreground hover:text-foreground", t.noteIdle),
        className
      )}
    >
      <MessageSquare className="size-3 shrink-0" aria-hidden />
      <span>{hasComment ? "Note" : "Message"}</span>
    </button>
  );
}

/** PU/Tot + Qté (Message optionnel en ligne, sinon rangée dédiée sous le cart). */
export function ProductRequestLineBodyGrid({
  unitPrice,
  qtyControl,
  totalValue,
  messageButton,
  className,
}: {
  unitPrice: number | null;
  qtyControl: ReactNode;
  totalValue: number | null;
  messageButton?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 items-center gap-x-3 leading-none",
        className
      )}
    >
      <ProductRequestLinePrices unitPrice={unitPrice} totalValue={totalValue} />
      {qtyControl}
      {messageButton ? <div className="ml-auto flex shrink-0 items-center">{messageButton}</div> : null}
    </div>
  );
}

/** Barre recherche + Explorer (saisie et modification demande envoyée). */
export function ProductRequestSearchExplorerRow({
  query,
  onQueryChange,
  explorerHref,
  onExplorerNavigate,
  fieldFocus = t.focus,
  placeholder = "Nom ou laboratoire (2 car. min.)…",
  searchSlot,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  explorerHref: string;
  onExplorerNavigate?: () => void;
  fieldFocus?: string;
  placeholder?: string;
  searchSlot?: ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", t.shell)}>
      <div className="flex items-stretch gap-2 px-3 py-2.5 sm:px-3.5">
        <div className="relative min-w-0 flex-1">
          <Search
            className={cn("pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2", t.searchIcon)}
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className={cn(
              "h-10 w-full rounded-xl border-2 bg-background py-2 pl-9 pr-3 text-[15px] leading-normal shadow-sm placeholder:text-muted-foreground",
              t.searchInput,
              fieldFocus
            )}
          />
        </div>
        <Link href={explorerHref} onClick={onExplorerNavigate} className={cn(t.explorerBtn, "h-10 px-3")}>
          <LayoutGrid className="size-4 shrink-0" aria-hidden />
          Explorer
        </Link>
      </div>
      {searchSlot ? <div className={cn("border-t px-3 pb-2.5 pt-0", t.searchDivider)}>{searchSlot}</div> : null}
    </div>
  );
}

export function PriceDhInline({
  value,
  amountClassName,
  suffixClassName,
}: {
  value: number | string | null | undefined;
  amountClassName?: string;
  suffixClassName?: string;
}) {
  if (value == null || value === "") {
    return <span className={amountClassName}>—</span>;
  }
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n) || n < 0) {
    return <span className={amountClassName}>—</span>;
  }
  return (
    <span className="inline-flex items-baseline whitespace-nowrap">
      <span className={cn("tabular-nums", amountClassName)}>{n.toFixed(2)}</span>
      <span
        className={cn(
          "translate-y-[0.02em] text-[0.62em] font-semibold uppercase leading-none tracking-tight text-slate-500",
          suffixClassName
        )}
      >
        {"\u00A0"}
        DH
      </span>
    </span>
  );
}

/** Barre de recherche seule (page Explorer catalogue). */
export function ProductRequestExplorerSearchBar({
  query,
  onQueryChange,
  fieldFocus,
  placeholder = "Filtrer par nom ou laboratoire…",
}: {
  query: string;
  onQueryChange: (v: string) => void;
  fieldFocus: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-md", t.shell)}>
      <div className="relative px-3 py-3 sm:px-4">
        <Search
          className={cn("pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 sm:left-4", t.searchIcon)}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className={cn(
            "h-11 w-full rounded-xl border-2 bg-background py-2 pl-10 pr-3 text-base leading-normal shadow-sm placeholder:text-muted-foreground",
            t.searchInput,
            fieldFocus
          )}
        />
      </div>
    </div>
  );
}

export function ProductRequestHeaderSearch({
  pharmacyLabel,
  pharmacyId,
  query,
  onQueryChange,
  searchLoading,
  explorerOnNavigate,
  fieldFocus,
  searchSlot,
}: {
  pharmacyLabel: string;
  pharmacyId: string;
  query: string;
  onQueryChange: (v: string) => void;
  searchLoading: boolean;
  explorerOnNavigate: () => void;
  fieldFocus: string;
  searchSlot: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-md",
        t.shell
      )}
    >
      <PharmacyFlowHero
        theme="productRequest"
        embedded
        eyebrow="Demande de produits"
        title={pharmacyLabel}
        subtitle="Recherchez, ajoutez vos produits et envoyez la liste à l'officine."
        icon={Package}
      />
      <div className={cn("border-t bg-card px-3 pb-3 pt-2.5 sm:px-4", t.searchDivider)}>
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              className={cn("pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2", t.searchIcon)}
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Nom ou laboratoire (2 car. min.)…"
              aria-label="Rechercher un produit par nom ou laboratoire"
              className={cn(
                "h-11 w-full rounded-xl border-2 bg-background py-2 pl-10 pr-3 text-base leading-normal shadow-sm placeholder:text-muted-foreground",
                t.searchInput,
                fieldFocus
              )}
            />
          </div>
          <Link
            href={`/pharmacie/${pharmacyId}/demande-produits/catalogue`}
            onClick={explorerOnNavigate}
            className={t.explorerBtn}
          >
            <LayoutGrid className="size-4 shrink-0" aria-hidden />
            Explorer
          </Link>
        </div>
        {searchLoading ? <p className="mt-1.5 text-xs text-muted-foreground">Recherche…</p> : null}
        {searchSlot}
      </div>
    </div>
  );
}

type CatalogHit = {
  id: string;
  name: string;
  photo_url: string | null;
  unitPrice: number | null;
};

export function ProductRequestCatalogHitRow({
  hit,
  onAdd,
  onPhotoPreview,
}: {
  hit: CatalogHit;
  onAdd: () => void;
  onPhotoPreview: () => void;
}) {
  return (
    <li>
      <div
        className={cn(
          "flex h-[3.75rem] items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-2 py-1 transition hover:bg-muted/35",
          t.hitHover
        )}
      >
        <button
          type="button"
          disabled={!hit.photo_url}
          className={cn(
            THUMB,
            "overflow-hidden rounded-lg border border-border/70 bg-card",
            hit.photo_url ? cn("cursor-zoom-in hover:ring-2", t.photoRing) : "cursor-default opacity-80"
          )}
          aria-label={hit.photo_url ? `Agrandir la photo · ${hit.name}` : "Pas de photo catalogue"}
          onClick={(ev) => {
            ev.stopPropagation();
            if (hit.photo_url) onPhotoPreview();
          }}
        >
          {hit.photo_url ? (
            <img src={hit.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Package className="size-5 text-muted-foreground" aria-hidden />
            </span>
          )}
        </button>
        <button type="button" onClick={onAdd} className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground" title={hit.name}>
            {hit.name}
          </p>
          <p className={cn("text-xs font-semibold", t.price)}>
            <PriceDhInline value={hit.unitPrice} amountClassName={cn("font-semibold", t.price)} />
          </p>
        </button>
      </div>
    </li>
  );
}

export function ProductRequestCartLineRow({
  line,
  unitPrice,
  onRemove,
  onPhotoPreview,
  onSetQty,
  onOpenComment,
  hasComment,
}: {
  line: PatientDemandeProduitsDraftLine;
  unitPrice: number | null;
  onRemove: () => void;
  onPhotoPreview: () => void;
  onSetQty: (qty: number) => void;
  onOpenComment: () => void;
  hasComment: boolean;
}) {
  const thumbInner = line.photo_url ? (
    <button
      type="button"
      className={cn("size-full cursor-zoom-in focus:outline-none focus-visible:ring-2", t.photoRing)}
      aria-label={`Agrandir la photo · ${line.name}`}
      onClick={onPhotoPreview}
    >
      <img src={line.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
    </button>
  ) : (
    <span className="flex h-full w-full items-center justify-center">
      <Package className="size-5 text-muted-foreground" aria-hidden />
    </span>
  );

  return (
    <li className={cn("relative w-full min-w-0 overflow-visible p-1", PRODUCT_REQUEST_LINE_CARD_SHELL)}>
      <ProductRequestLineDeleteButton onClick={onRemove} />
      <ProductRequestLinePanel
        title={
          <p className="truncate text-[13px] font-semibold leading-none text-foreground" title={line.name}>
            {line.name}
          </p>
        }
        unitPrice={unitPrice}
        totalValue={unitPrice != null ? unitPrice * line.qty : null}
        qtyControl={
          <ProductRequestLineQtyPicker
            qty={line.qty}
            onSelect={(n) => onSetQty(Math.min(10, Math.max(1, n)))}
          />
        }
        bottomRight={
          <ProductRequestLineMessageIconButton hasComment={hasComment} onClick={onOpenComment} />
        }
        thumb={thumbInner}
      />
    </li>
  );
}

export function PatientLineCommentModal({
  open,
  productName,
  value,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  productName: string;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[50] flex items-end justify-center p-3 sm:items-center">
      <button type="button" className="absolute inset-0 bg-black/45" aria-label="Fermer" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-comment-title"
        className={cn("relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl", t.modalShell)}
      >
        <div className={cn("flex items-start justify-between gap-2 border-b px-4 py-3", t.modalHeader)}>
          <div className="min-w-0">
            <h2 id="line-comment-title" className="text-sm font-bold text-foreground">
              Note sur le produit
            </h2>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{productName}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="px-4 py-3">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX))}
            rows={3}
            maxLength={PATIENT_PRODUCT_LINE_COMMENT_MAX}
            placeholder="Ex. dosage, marque souhaitée…"
            className={cn(
              "w-full rounded-xl border border-border/80 bg-background px-3 py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground",
              t.focus
            )}
            autoFocus
          />
          <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">
            {value.length}/{PATIENT_PRODUCT_LINE_COMMENT_MAX}
          </p>
        </div>
        <div className="flex gap-2 border-t border-border/80 bg-muted/20 px-4 py-3">
          <Button type="button" variant="outline" className="h-10 flex-1 font-semibold" onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" className={cn("h-10 flex-1 font-semibold", t.cta)} onClick={onSave}>
            Enregistrer
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PatientDemandeSendConfirmModal({
  open,
  lines,
  note,
  totalAmount,
  unitPriceForLine,
  submitLoading,
  onClose,
  onConfirm,
  onPhotoPreview,
}: {
  open: boolean;
  lines: PatientDemandeProduitsDraftLine[];
  note: string;
  totalAmount: number;
  unitPriceForLine: (line: PatientDemandeProduitsDraftLine) => number | null;
  submitLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPhotoPreview: (url: string, title: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[45] flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fermer"
        disabled={submitLoading}
        onClick={() => !submitLoading && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-confirm-title"
        className={cn(
          "relative z-10 flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
          t.modalShell
        )}
      >
        <div className={cn("border-b px-4 py-3.5", t.modalHeader)}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="send-confirm-title" className="text-lg font-bold leading-tight text-foreground">
                Confirmer l&apos;envoi
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {lines.length} produit{lines.length > 1 ? "s" : ""} — vérifiez la liste avant envoi à l&apos;officine.
              </p>
            </div>
            <button
              type="button"
              disabled={submitLoading}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
              onClick={onClose}
              aria-label="Fermer"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ul className="space-y-2">
            {lines.map((l) => {
              const pu = unitPriceForLine(l);
              return (
                <li
                  key={l.product_id}
                  className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/15 px-2.5 py-2"
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-card">
                    {l.photo_url ? (
                      <button
                        type="button"
                        className={cn("size-full cursor-zoom-in focus:outline-none focus-visible:ring-2", t.photoRing)}
                        aria-label={`Agrandir la photo · ${l.name}`}
                        onClick={() => onPhotoPreview(l.photo_url!, l.name)}
                      >
                        <img src={l.photo_url} alt="" className="pointer-events-none size-full object-cover" />
                      </button>
                    ) : (
                      <span className="flex size-full items-center justify-center">
                        <Package className="size-5 text-muted-foreground" aria-hidden />
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-foreground">{l.name}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Qté <span className="font-bold tabular-nums text-foreground">{l.qty}</span>
                      <span className="mx-1 text-border">·</span>
                      PU{" "}
                      <strong className="text-foreground">
                        <PriceDhInline value={pu} amountClassName="text-[11px]" suffixClassName="text-[9px]" />
                      </strong>
                      <span className="mx-1 text-border">·</span>
                      <span className={cn("font-bold", t.price)}>
                        Tot{" "}
                        {pu != null ? (
                          <PriceDhInline
                            value={pu * l.qty}
                            amountClassName="text-[11px] font-bold"
                            suffixClassName="text-[9px] font-bold text-sky-600/80"
                          />
                        ) : (
                          "—"
                        )}
                      </span>
                    </p>
                    {l.client_comment?.trim() ? (
                      <p className={cn("mt-1.5 rounded-lg border px-2 py-1 text-[11px] leading-snug text-foreground", t.modalHighlight)}>
                        <span className={cn("font-semibold", t.modalLabel)}>Votre note · </span>
                        {l.client_comment.trim()}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {note.trim() ? (
            <div className={cn("mt-3 rounded-xl border px-3 py-2", t.modalHighlight)}>
              <p className={cn("text-[10px] font-bold uppercase tracking-wide", t.modalLabel)}>
                Message pour la pharmacie
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note.trim()}</p>
            </div>
          ) : null}
        </div>
        <div className={cn("border-t bg-muted/25 px-4 py-3", t.searchDivider)}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-foreground">Total estimé</span>
            <span className={cn("text-lg font-bold", t.price)}>
              <PriceDhInline
                value={totalAmount}
                amountClassName="text-lg font-bold"
                suffixClassName="text-[0.65em] font-bold text-sky-600/80"
              />
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1 font-semibold"
              disabled={submitLoading}
              onClick={onClose}
            >
              Annuler
            </Button>
            <Button
              type="button"
              className={cn("h-11 flex-1 font-semibold", t.cta)}
              disabled={submitLoading}
              onClick={onConfirm}
            >
              {submitLoading ? "Envoi…" : "Confirmer l'envoi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
