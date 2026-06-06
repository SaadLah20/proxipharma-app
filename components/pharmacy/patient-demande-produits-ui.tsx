"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronDown, LayoutGrid, MessageCircle, MessageSquare, Package, Search, Trash2, X } from "lucide-react";
import { PharmacyFlowHero, pharmacyPublicCard, PharmacyPublicSectionTitle } from "@/components/pharmacy/pharmacy-public-chrome";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { Button } from "@/components/ui/button";
import { uiActionBtnFull, uiActionBtnFullOutline } from "@/lib/ui-action-buttons";
import { uiSurfaceCard } from "@/lib/ui-surfaces";
import { cn } from "@/lib/utils";
import {
  ConversationAudioDraftPreview,
  ConversationMessageDraftField,
} from "@/components/requests/conversation/conversation-message-draft-field";
import type { ConversationAudioDraft } from "@/lib/use-conversation-audio-recorder";
import { PATIENT_PRODUCT_LINE_COMMENT_PLACEHOLDER_FR } from "@/lib/product-line-comment-copy";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import type { PatientDemandeProduitsDraftLine } from "@/lib/patient-demande-produits-draft";
import { ProductBrandLabel } from "@/components/products/product-brand-label";

/** Vignette compacte — la hauteur du bloc suit la photo (items-stretch). */
export const PRODUCT_REQUEST_LINE_THUMB =
  "box-border size-14 shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";
/** Alias compat (lecture seule / grilles). */
export const PRODUCT_REQUEST_LINE_BLOCK_H = "min-h-14";
/** Contour discret sans changer la boîte de contenu (ombre interne). */
export const PRODUCT_REQUEST_LINE_CARD_SHELL = cn(uiSurfaceCard, "p-1");
const THUMB = PRODUCT_REQUEST_LINE_THUMB;

/** Section de page (saisie publique / catalogue) — titres alignés charte globale. */
export function ProductRequestSection({
  title,
  hint,
  badge,
  children,
  className,
}: {
  title: string;
  hint?: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-2 px-0.5">
        <PharmacyPublicSectionTitle title={title} hint={hint} className="mb-0 min-w-0 flex-1" />
        {badge ?? null}
      </div>
      {children}
    </section>
  );
}

export function ProductRequestMessageCard({
  note,
  onNoteChange,
  maxLength,
  fieldFocus = t.focus,
  onAudioDraftChange,
}: {
  note: string;
  onNoteChange: (value: string) => void;
  maxLength: number;
  fieldFocus?: string;
  onAudioDraftChange?: (draft: ConversationAudioDraft | null) => void;
}) {
  const td = useTranslations("demandePublic");
  const tc = useTranslations("common");
  return (
    <section className={cn(pharmacyPublicCard, "p-3 sm:p-4", t.messageCard)}>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", t.accentIconBg)} aria-hidden>
          <MessageSquare className={cn("size-4", t.accentIcon)} strokeWidth={2.25} />
        </span>
        <PharmacyPublicSectionTitle title={td("messageOptional")} className="mb-0 min-w-0 flex-1" />
      </div>
      <ConversationMessageDraftField
        draft={note}
        onDraftChange={onNoteChange}
        maxLength={maxLength}
        onAudioDraftChange={onAudioDraftChange}
        placeholder={td("messagePlaceholder")}
        counterClassName="text-[10px]"
        textareaClassName={cn(
          "w-full rounded-xl border bg-background px-3 py-3 text-sm leading-relaxed placeholder:text-muted-foreground",
          t.messageInput,
          fieldFocus
        )}
      />
    </section>
  );
}

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

export function ProductRequestLinePrices({
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

/** Qté lecture seule, même ligne et typo que PU (label 10px + valeur sm). */
export function ProductRequestLineQtyInline({ qty }: { qty: number }) {
  return (
    <p className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-none">
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">Qté</span>
      <span className="text-sm font-bold tabular-nums text-foreground">{qty}</span>
    </p>
  );
}

/** Qté lecture seule (alignée sur le sélecteur). */
export function ProductRequestLineQtyReadonly({
  qty,
  appearance = "default",
}: {
  qty: number;
  appearance?: "default" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-full max-w-[6.75rem] items-center justify-center rounded-full border px-2.5",
        appearance === "neutral"
          ? "border-border/80 bg-muted/25"
          : "border-sky-200/80 bg-sky-50/80"
      )}
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
  maxQty = 10,
  onSelect,
  appearance = "default",
}: {
  qty: number;
  disabled?: boolean;
  /** Plafond sélectionnable (défaut 10). */
  maxQty?: number;
  onSelect: (qty: number) => void;
  appearance?: "default" | "neutral";
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

  if (disabled) return <ProductRequestLineQtyReadonly qty={qty} appearance={appearance} />;

  const cap = Math.min(10, Math.max(1, maxQty));
  const options = QTY_OPTIONS.filter((n) => n <= cap);

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            aria-label="Choisir la quantité"
            style={{ top: menuPos.top, left: menuPos.left }}
            className={cn(
              "fixed z-[11050] max-h-44 w-[4.25rem] -translate-x-1/2 overflow-y-auto overscroll-y-contain rounded-xl border bg-card py-1 shadow-xl",
              t.shell
            )}
          >
          {options.map((n) => (
            <li key={n} role="option" aria-selected={n === qty}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center px-2 py-1.5 text-[13px] font-semibold tabular-nums transition",
                    appearance === "neutral"
                      ? n === qty
                        ? "bg-muted text-foreground"
                        : "text-foreground hover:bg-muted/60"
                      : n === qty
                        ? "bg-sky-100/90 text-sky-950"
                        : "text-foreground hover:bg-sky-50"
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
          "inline-flex h-7 w-full max-w-[6.75rem] items-center justify-center gap-0.5 rounded-full border bg-white px-2 shadow-sm transition",
          appearance === "neutral"
            ? "border-border/80 hover:bg-muted/30"
            : "border-sky-300/80 hover:bg-sky-50",
          open &&
            (appearance === "neutral"
              ? "border-foreground/25 ring-2 ring-foreground/10"
              : "border-sky-500/70 ring-2 ring-sky-400/30")
        )}
      >
        <ProductRequestLineQtyLabel qty={qty} />
        <ChevronDown
          className={cn(
            "size-3 shrink-0 transition",
            appearance === "neutral" ? "text-muted-foreground" : "text-sky-700",
            open && "rotate-180"
          )}
          aria-hidden
        />
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
        <div className="relative flex min-h-7 w-full items-center overflow-visible">
          <div className="z-0 min-w-0 max-w-[42%] shrink-0 leading-none">
            <ProductRequestLinePrices unitPrice={unitPrice} totalValue={totalValue} />
          </div>
          <div className="absolute left-[calc(50%+6mm)] top-1/2 z-[1] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 overflow-visible">
            {qtyControl}
            {bottomRight ?? null}
          </div>
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
  placeholder = "Chercher un produit",
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
    <div className={cn(pharmacyPublicCard, "overflow-hidden p-0", t.shell)}>
      <div className="flex items-stretch gap-2 px-3 py-3 sm:px-4">
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
              "h-10 w-full rounded-xl border-2 bg-background py-2 pl-9 pr-3 text-sm leading-normal shadow-sm placeholder:text-muted-foreground",
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
  placeholder = "Chercher un produit",
}: {
  query: string;
  onQueryChange: (v: string) => void;
  fieldFocus: string;
  placeholder?: string;
}) {
  return (
    <div className={cn(pharmacyPublicCard, "overflow-hidden p-0", t.shell)}>
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
            "h-11 w-full rounded-xl border-2 bg-background py-2 pl-10 pr-3 text-sm leading-normal shadow-sm placeholder:text-muted-foreground",
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
  const td = useTranslations("demandePublic");
  return (
    <div className={cn(pharmacyPublicCard, "overflow-hidden p-0 text-card-foreground", t.shell)}>
      <PharmacyFlowHero
        theme="productRequest"
        embedded
        eyebrow={td("productRequestEyebrow")}
        title={pharmacyLabel}
        subtitle={td("productRequestSubtitle")}
        icon={Package}
      />
      <div className={cn("border-t bg-card px-3 pb-3 pt-3 sm:px-4", t.searchDivider)}>
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
              placeholder={td("searchProduct")}
              aria-label={td("searchProduct")}
              className={cn(
                "h-11 w-full rounded-xl border-2 bg-background py-2 pl-10 pr-3 text-sm leading-normal shadow-sm placeholder:text-muted-foreground",
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
            {td("explorer")}
          </Link>
        </div>
        {searchLoading ? <p className="mt-1.5 text-xs text-muted-foreground">{td("searching")}</p> : null}
        {searchSlot}
      </div>
    </div>
  );
}

type CatalogHit = {
  id: string;
  name: string;
  brand?: string | null;
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
          "flex h-[3.75rem] items-center gap-2 rounded-xl border border-border/80 bg-card px-2 py-1 shadow-sm transition",
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
          <ProductBrandLabel brand={hit.brand} />
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
          <div className="min-w-0">
            <p className="truncate pb-px text-[13px] font-semibold leading-snug text-foreground" title={line.name}>
              {line.name}
            </p>
            <ProductBrandLabel brand={line.brand} />
          </div>
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
  const td = useTranslations("demandePublic");
  const tc = useTranslations("common");
  return (
    <AppModalOverlay open={open} onBackdropClick={onClose} aria-labelledby="line-comment-title">
      <div
        className={cn(
          "w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl sm:max-h-[min(88dvh,560px)]",
          t.modalShell
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-start justify-between gap-2 border-b px-4 py-3.5", t.modalHeader)}>
          <div className="min-w-0">
            <h2 id="line-comment-title" className="text-sm font-bold text-foreground">
              {td("lineNoteTitle")}
            </h2>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{productName}</p>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label={tc("closeAria")}
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
            placeholder={PATIENT_PRODUCT_LINE_COMMENT_PLACEHOLDER_FR}
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
            {tc("cancel")}
          </Button>
          <Button type="button" className={cn(uiActionBtnFull("h-10 flex-1"), t.cta)} onClick={onSave}>
            {tc("save")}
          </Button>
        </div>
      </div>
    </AppModalOverlay>
  );
}

export function PatientDemandeSendConfirmModal({
  open,
  lines,
  note,
  audioDraft = null,
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
  audioDraft?: ConversationAudioDraft | null;
  totalAmount: number;
  unitPriceForLine: (line: PatientDemandeProduitsDraftLine) => number | null;
  submitLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPhotoPreview: (url: string, title: string, descriptionHtml?: string | null) => void;
}) {
  const td = useTranslations("demandePublic");
  const tc = useTranslations("common");
  return (
    <AppModalOverlay
      open={open}
      onBackdropClick={() => {
        if (!submitLoading) onClose();
      }}
      aria-labelledby="send-confirm-title"
    >
      <div
        className={cn(
          "flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
          t.modalShell
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("border-b px-4 py-3.5", t.modalHeader)}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="send-confirm-title" className="text-lg font-bold leading-tight text-foreground">
                {td("confirmSend")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {td("confirmSendHint", { count: lines.length })}
              </p>
            </div>
            <button
              type="button"
              disabled={submitLoading}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-40"
              onClick={onClose}
              aria-label={tc("closeAria")}
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
                        aria-label={td("enlargePhoto", { name: l.name })}
                        onClick={() => onPhotoPreview(l.photo_url!, l.name, l.full_description)}
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
                      {td("qty")} <span className="font-bold tabular-nums text-foreground">{l.qty}</span>
                      <span className="mx-1 text-border">·</span>
                      {td("unitPrice")}{" "}
                      <strong className="text-foreground">
                        <PriceDhInline value={pu} amountClassName="text-[11px]" suffixClassName="text-[9px]" />
                      </strong>
                      <span className="mx-1 text-border">·</span>
                      <span className={cn("font-bold", t.price)}>
                        {td("totalShort")}{" "}
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
                        <span className={cn("font-semibold", t.modalLabel)}>{td("yourNote")}</span>
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
                {td("messageForPharmacy")}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note.trim()}</p>
            </div>
          ) : null}
          {audioDraft ? (
            <ConversationAudioDraftPreview draft={audioDraft} className={cn("mt-3", t.modalHighlight)} />
          ) : null}
          {!note.trim() && !audioDraft ? (
            <p className="mt-3 text-sm text-muted-foreground">{td("noGeneralMessage")}</p>
          ) : null}
        </div>
        <div className={cn("border-t bg-muted/25 px-4 py-3", t.searchDivider)}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold text-foreground">{td("estimatedTotal")}</span>
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
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              className={cn(uiActionBtnFull("h-11 flex-1"), t.cta)}
              disabled={submitLoading}
              onClick={onConfirm}
            >
              {submitLoading ? tc("sending") : td("confirmSend")}
            </Button>
          </div>
        </div>
      </div>
    </AppModalOverlay>
  );
}
