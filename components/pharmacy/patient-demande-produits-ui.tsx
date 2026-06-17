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
import {
  lineConversationAriaLabel,
  LineConvoBadgeDots,
  type LineConvoVisual,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";
import type { PatientWorkflowLineAccent } from "@/lib/patient-workflow-line-ui";
import type { PatientDemandeProduitsDraftLine } from "@/lib/patient-demande-produits-draft";
import { isManualDraftLine, draftCartTotalsSummary } from "@/lib/patient-manual-product-line";
import { ProductCatalogExplorerThumb } from "@/components/products/product-catalog-explorer-thumb";
import { ProductCatalogMetaLabel } from "@/components/products/product-brand-label";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";

/** Vignette compacte — la hauteur du bloc suit la photo (items-stretch). */
export const PRODUCT_REQUEST_LINE_THUMB =
  "box-border size-14 shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";
/** Alias compat (lecture seule / grilles). */
export const PRODUCT_REQUEST_LINE_BLOCK_H = "min-h-14";
/** Contour carte ligne — accent sky demande produits. */
export const PRODUCT_REQUEST_LINE_CARD_SHELL = cn(
  "rounded-xl border border-sky-200/75 bg-card text-card-foreground shadow-sm ring-1 ring-sky-100/45",
  "p-1",
);
const THUMB = PRODUCT_REQUEST_LINE_THUMB;

function qtyAccentReadonlyClass(
  appearance: "default" | "neutral",
  lineAccent: PatientWorkflowLineAccent = "sky",
): string {
  if (appearance === "neutral") return "border-border/80 bg-muted/25";
  if (lineAccent === "amber") return "border-amber-200/55 bg-amber-50/40";
  if (lineAccent === "violet") return "border-violet-200/50 bg-violet-50/35";
  return "border-sky-200/80 bg-sky-50/80";
}

function qtyAccentPickerButtonClass(
  appearance: "default" | "neutral",
  lineAccent: PatientWorkflowLineAccent,
  open: boolean,
): string {
  if (appearance === "neutral") {
    return cn(
      "border-border/80 hover:bg-muted/30",
      open && "border-foreground/25 ring-2 ring-foreground/10",
    );
  }
  if (lineAccent === "amber") {
    return cn(
      "border-amber-200/55 hover:bg-amber-50/45",
      open && "border-amber-400/55 ring-2 ring-amber-200/35",
    );
  }
  if (lineAccent === "violet") {
    return cn(
      "border-violet-200/50 hover:bg-violet-50/40",
      open && "border-violet-400/50 ring-2 ring-violet-200/30",
    );
  }
  return cn("border-sky-300/80 hover:bg-sky-50", open && "border-sky-500/70 ring-2 ring-sky-400/30");
}

function qtyAccentPickerChevronClass(
  appearance: "default" | "neutral",
  lineAccent: PatientWorkflowLineAccent,
): string {
  if (appearance === "neutral") return "text-muted-foreground";
  if (lineAccent === "amber") return "text-amber-800";
  if (lineAccent === "violet") return "text-violet-800";
  return "text-sky-700";
}

function qtyAccentPickerOptionClass(
  appearance: "default" | "neutral",
  lineAccent: PatientWorkflowLineAccent,
  selected: boolean,
): string {
  if (appearance === "neutral") {
    return selected ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/60";
  }
  if (lineAccent === "amber") {
    return selected ? "bg-amber-100/80 text-amber-950" : "text-foreground hover:bg-amber-50/60";
  }
  if (lineAccent === "violet") {
    return selected ? "bg-violet-100/75 text-violet-950" : "text-foreground hover:bg-violet-50/55";
  }
  return selected ? "bg-sky-100/90 text-sky-950" : "text-foreground hover:bg-sky-50";
}

function messageAccentButtonClass(
  hasComment: boolean,
  lineAccent: PatientWorkflowLineAccent = "sky",
): string {
  return messageAccentVisualButtonClass(hasComment ? "patient_only" : "empty", lineAccent);
}

function messageAccentVisualButtonClass(
  visual: LineConvoVisual,
  lineAccent: PatientWorkflowLineAccent = "sky",
): string {
  if (visual === "empty") {
    if (lineAccent === "amber") {
      return "border-dashed border-amber-200/70 bg-white text-amber-600/75 hover:border-amber-300/60 hover:bg-amber-50/45 hover:text-amber-900";
    }
    if (lineAccent === "violet") {
      return "border-dashed border-violet-200/65 bg-white text-violet-600/75 hover:border-violet-300/55 hover:bg-violet-50/40 hover:text-violet-900";
    }
    return "border-dashed border-sky-200/70 bg-white text-sky-600/75 hover:border-sky-300/70 hover:bg-sky-50 hover:text-sky-800";
  }
  if (visual === "thread") {
    if (lineAccent === "amber") {
      return "border-amber-400/85 bg-gradient-to-br from-amber-50 via-white to-emerald-50/35 text-amber-950 shadow-sm ring-2 ring-amber-200/70 hover:bg-amber-50";
    }
    if (lineAccent === "violet") {
      return "border-violet-400/85 bg-gradient-to-br from-violet-50 via-white to-emerald-50/35 text-violet-950 shadow-sm ring-2 ring-violet-200/70 hover:bg-violet-50";
    }
    return "border-sky-400/85 bg-gradient-to-br from-sky-50 via-white to-emerald-50/35 text-sky-950 shadow-sm ring-2 ring-sky-200/70 hover:bg-sky-100";
  }
  if (visual === "pharma_only") {
    return "border-emerald-400/80 bg-emerald-50/90 text-emerald-950 shadow-sm ring-2 ring-emerald-200/70 hover:bg-emerald-100/80";
  }
  if (lineAccent === "amber") {
    return "border-amber-400/80 bg-amber-50 text-amber-950 shadow-sm ring-2 ring-amber-200/70 hover:bg-amber-100";
  }
  if (lineAccent === "violet") {
    return "border-violet-400/80 bg-violet-50 text-violet-950 shadow-sm ring-2 ring-violet-200/70 hover:bg-violet-100";
  }
  return "border-sky-400/80 bg-sky-50 text-sky-950 shadow-sm ring-2 ring-sky-200/70 hover:bg-sky-100";
}

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
  const td = useTranslations("demandePublic");
  return (
    <p className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-none">
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{td("unitPrice")}</span>
      <PriceDhInline
        value={unitPrice}
        amountClassName="text-sm font-bold text-foreground"
        suffixClassName="text-[10px] font-semibold text-muted-foreground"
      />
    </p>
  );
}

function ProductRequestLineTotIndicative({ totalValue }: { totalValue: number | null }) {
  const td = useTranslations("demandePublic");
  return (
    <p className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-none text-muted-foreground">
      <span className="shrink-0 text-[9px] font-medium">{td("totalShort")}</span>
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

/** Message prix pharmacien pour lignes saisies manuellement (sans PU/TOTAL). */
export function ProductRequestManualPriceHint({ className }: { className?: string }) {
  const td = useTranslations("demandePublic");
  return (
    <p className={cn("max-w-[11rem] text-[10px] font-medium leading-snug text-sky-800/90", className)}>
      {td("manualProductPriceHint")}
    </p>
  );
}

/** Message lorsque l'officine masque les prix catalogue avant sa réponse. */
export function ProductRequestCatalogPriceHiddenHint({ className }: { className?: string }) {
  const td = useTranslations("demandePublic");
  return (
    <p className={cn("max-w-[11rem] text-[10px] font-medium leading-snug text-sky-800/90", className)}>
      {td("catalogPriceHiddenHint")}
    </p>
  );
}

const QTY_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Libellé quantité (lecture seule ou dans le sélecteur). */
function ProductRequestLineQtyLabel({ qty, className }: { qty: number; className?: string }) {
  const td = useTranslations("demandePublic");
  return (
    <span className={cn("inline-flex items-baseline gap-1 whitespace-nowrap leading-none", className)}>
      <span className="text-[10px] font-medium text-muted-foreground">{td("qtyLabel")}&nbsp;:</span>
      <span className="text-[12px] font-semibold tabular-nums text-foreground">{qty}</span>
    </span>
  );
}

/** Qté lecture seule, même ligne et typo que PU (label 10px + valeur sm). */
export function ProductRequestLineQtyInline({ qty }: { qty: number }) {
  const td = useTranslations("demandePublic");
  return (
    <p className="flex min-w-0 items-baseline gap-1 whitespace-nowrap leading-none">
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{td("qty")}</span>
      <span className="text-sm font-bold tabular-nums text-foreground">{qty}</span>
    </p>
  );
}

/** Qté lecture seule (alignée sur le sélecteur). */
export function ProductRequestLineQtyReadonly({
  qty,
  appearance = "default",
  lineAccent = "sky",
  compact = false,
}: {
  qty: number;
  appearance?: "default" | "neutral";
  lineAccent?: PatientWorkflowLineAccent;
  /** À côté de PU/Tot sur une carte compacte (pas de largeur pleine). */
  compact?: boolean;
}) {
  const td = useTranslations("demandePublic");
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-full border px-2.5",
        compact ? "w-auto shrink-0" : "w-full max-w-[6.75rem]",
        qtyAccentReadonlyClass(appearance, lineAccent)
      )}
      aria-label={td("qtyReadonlyAria", { qty })}
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
  lineAccent = "sky",
}: {
  qty: number;
  disabled?: boolean;
  /** Plafond sélectionnable (défaut 10). */
  maxQty?: number;
  onSelect: (qty: number) => void;
  appearance?: "default" | "neutral";
  lineAccent?: PatientWorkflowLineAccent;
}) {
  const td = useTranslations("demandePublic");
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

  if (disabled) return <ProductRequestLineQtyReadonly qty={qty} appearance={appearance} lineAccent={lineAccent} />;

  const cap = Math.min(10, Math.max(1, maxQty));
  const options = QTY_OPTIONS.filter((n) => n <= cap);

  const menu =
    open && menuPos && typeof document !== "undefined"
      ? createPortal(
          <ul
            id={listId}
            role="listbox"
            aria-label={td("qtyPickerAria")}
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
                    qtyAccentPickerOptionClass(appearance, lineAccent, n === qty)
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
        aria-label={td("qtyPickerChangeAria", { qty })}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) syncMenuPos();
            return next;
          });
        }}
        className={cn(
          "inline-flex h-7 w-full max-w-[6.75rem] items-center justify-center gap-0.5 rounded-full border bg-white px-2 shadow-sm transition",
          qtyAccentPickerButtonClass(appearance, lineAccent, open)
        )}
      >
        <ProductRequestLineQtyLabel qty={qty} />
        <ChevronDown
          className={cn(
            "size-3 shrink-0 transition",
            qtyAccentPickerChevronClass(appearance, lineAccent),
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
  visual,
  onClick,
  className,
  lineAccent = "sky",
}: {
  /** @deprecated Préférer `visual` (4 états : vide / patient / officine / les deux). */
  hasComment?: boolean;
  visual?: LineConvoVisual;
  onClick: () => void;
  className?: string;
  lineAccent?: PatientWorkflowLineAccent;
}) {
  const td = useTranslations("demandePublic");
  const resolvedVisual = visual ?? (hasComment ? "patient_only" : "empty");
  const filled = resolvedVisual !== "empty";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={filled ? lineConversationAriaLabel(resolvedVisual) : td("lineMessageAddAria")}
      title={filled ? lineConversationAriaLabel(resolvedVisual) : td("lineMessage")}
      className={cn(
        "relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border shadow-sm transition",
        messageAccentVisualButtonClass(resolvedVisual, lineAccent),
        className
      )}
    >
      <MessageCircle className="size-3.5 shrink-0" strokeWidth={filled ? 2.35 : 2} aria-hidden />
      <LineConvoBadgeDots visual={resolvedVisual} accent={lineAccent} />
    </button>
  );
}

/** Supprimer — épinglé coin haut droit du bloc produit. */
export function ProductRequestLineDeleteButton({ onClick }: { onClick: () => void }) {
  const td = useTranslations("demandePublic");
  return (
    <button
      type="button"
      aria-label={td("removeProduct")}
      onClick={onClick}
      className="absolute -end-1.5 -top-1.5 z-10 flex size-7 items-center justify-center rounded-full border border-rose-200/90 bg-white text-destructive shadow-md transition hover:bg-rose-50"
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
  priceSlot,
  qtyControl,
  bottomRight,
  thumb,
  thumbClassName,
  contentMinHeight,
}: {
  title: ReactNode;
  unitPrice: number | null;
  totalValue: number | null;
  priceSlot?: ReactNode;
  qtyControl: ReactNode;
  bottomRight?: ReactNode;
  thumb: ReactNode;
  thumbClassName?: string;
  contentMinHeight?: string;
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <div className={cn("shrink-0", THUMB, thumbClassName)}>{thumb}</div>
      <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5", contentMinHeight)}>
        <div className="min-w-0 overflow-hidden pe-5 leading-tight">{title}</div>
        <div className="flex min-h-8 w-full min-w-0 items-center justify-between gap-2">
          <div className="min-w-0 shrink leading-none">
            {priceSlot ?? <ProductRequestLinePrices unitPrice={unitPrice} totalValue={totalValue} />}
          </div>
          <div className="flex shrink-0 items-center gap-2 me-5 sm:me-6">
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
  const td = useTranslations("demandePublic");
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
      <span>{hasComment ? td("note") : td("lineMessage")}</span>
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
      {messageButton ? <div className="ms-auto flex shrink-0 items-center">{messageButton}</div> : null}
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
  placeholder,
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
  const td = useTranslations("demandePublic");
  const resolvedPlaceholder = placeholder ?? td("searchProduct");
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
            placeholder={resolvedPlaceholder}
            aria-label={resolvedPlaceholder}
            className={cn(
              "h-10 w-full rounded-xl border-2 bg-background py-2 pl-9 pr-3 text-sm leading-normal shadow-sm placeholder:text-muted-foreground",
              t.searchInput,
              fieldFocus
            )}
          />
        </div>
        <Link href={explorerHref} onClick={onExplorerNavigate} className={cn(t.explorerBtn, "h-10 px-3")}>
          <LayoutGrid className="size-4 shrink-0" aria-hidden />
          {td("explorer")}
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

/** Total panier : montant partiel + mention si lignes manuelles sans prix. */
export function PatientCartEstimatedTotal({
  lines,
  amountClassName,
  suffixClassName,
  hintClassName,
  hideCatalogPrices = false,
}: {
  lines: PatientDemandeProduitsDraftLine[];
  amountClassName?: string;
  suffixClassName?: string;
  hintClassName?: string;
  hideCatalogPrices?: boolean;
}) {
  const td = useTranslations("demandePublic");
  const summary = draftCartTotalsSummary(lines);
  if (hideCatalogPrices && summary.manualLines < summary.totalLines) {
    return (
      <div className="text-right leading-tight">
        <span className={cn("font-bold text-muted-foreground", amountClassName)}>—</span>
        <p className={cn("mt-0.5 text-[9px] font-medium text-muted-foreground", hintClassName)}>
          {td("catalogPriceHiddenTotalNote")}
        </p>
      </div>
    );
  }
  if (summary.totalLines === 0 || summary.allManual) {
    return <span className={cn("font-bold text-muted-foreground", amountClassName)}>—</span>;
  }
  return (
    <div className="text-right leading-tight">
      <PriceDhInline
        value={summary.amount}
        amountClassName={amountClassName}
        suffixClassName={suffixClassName}
      />
      {summary.hasMixed ? (
        <p className={cn("mt-0.5 text-[9px] font-medium text-muted-foreground", hintClassName)}>
          {td("manualProductPartialTotalHint", { manual: summary.manualLines })}
        </p>
      ) : null}
    </div>
  );
}

/** Barre de recherche seule (page Explorer catalogue). */
export function ProductRequestExplorerSearchBar({
  query,
  onQueryChange,
  fieldFocus,
  placeholder,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  fieldFocus: string;
  placeholder?: string;
}) {
  const td = useTranslations("demandePublic");
  const resolvedPlaceholder = placeholder ?? td("searchProduct");
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
          placeholder={resolvedPlaceholder}
          aria-label={resolvedPlaceholder}
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
  product_type?: string | null;
  photo_url: string | null;
  unitPrice: number | null;
};

export function ProductRequestCatalogHitRow({
  hit,
  onAdd,
  onPhotoPreview,
  hideCatalogPrices = false,
}: {
  hit: CatalogHit;
  onAdd: () => void;
  onPhotoPreview: () => void;
  hideCatalogPrices?: boolean;
}) {
  const td = useTranslations("demandePublic");
  return (
    <li>
      <div
        className={cn(
          "flex h-[3.75rem] items-center gap-2 rounded-xl border border-border/80 bg-card px-2 py-1 shadow-sm transition",
          t.hitHover
        )}
      >
        <ProductCatalogExplorerThumb
          photoUrl={hit.photo_url}
          productType={hit.product_type}
          productName={hit.name}
          className={cn(THUMB, "rounded-lg border border-border/70 bg-card")}
          ringClassName={t.photoRing}
          onOpenPreview={onPhotoPreview}
        />
        <button type="button" onClick={onAdd} className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground" title={hit.name}>
            {hit.name}
          </p>
          <ProductCatalogMetaLabel productType={hit.product_type} brand={hit.brand} />
          {hideCatalogPrices ? (
            <p className="text-[10px] font-medium leading-snug text-sky-800/90">{td("catalogPriceHiddenHint")}</p>
          ) : (
            <p className={cn("text-xs font-semibold", t.price)}>
              <PriceDhInline value={hit.unitPrice} amountClassName={cn("font-semibold", t.price)} />
            </p>
          )}
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
  hideCatalogPrices = false,
}: {
  line: PatientDemandeProduitsDraftLine;
  unitPrice: number | null;
  onRemove: () => void;
  onPhotoPreview: () => void;
  onSetQty: (qty: number) => void;
  onOpenComment: () => void;
  hasComment: boolean;
  hideCatalogPrices?: boolean;
}) {
  const td = useTranslations("demandePublic");
  const isManual = isManualDraftLine(line);
  const hidePrice = hideCatalogPrices && !isManual;
  const thumbInner = (
    <ProductCatalogExplorerThumb
      photoUrl={isManual ? null : line.photo_url}
      productType={line.product_type}
      productName={line.name}
      className="size-full"
      ringClassName={t.photoRing}
      onOpenPreview={isManual ? () => {} : onPhotoPreview}
    />
  );

  return (
    <li className={cn("relative w-full min-w-0 overflow-visible p-1.5 sm:p-2", PRODUCT_REQUEST_LINE_CARD_SHELL)}>
      <ProductRequestLineDeleteButton onClick={onRemove} />
      <ProductRequestLinePanel
        thumbClassName="!size-16"
        contentMinHeight="min-h-16"
        title={
          <div className="min-w-0">
            <p className="truncate pb-px text-[13px] font-semibold leading-snug text-foreground" title={line.name}>
              {line.name}
            </p>
            {isManual ? (
              <span className="mt-0.5 inline-flex rounded-full border border-sky-200/80 bg-sky-50/80 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-sky-900">
                {td("manualProductBadge")}
              </span>
            ) : null}
          </div>
        }
        unitPrice={isManual || hidePrice ? null : unitPrice}
        totalValue={isManual || hidePrice ? null : unitPrice != null ? unitPrice * line.qty : null}
        priceSlot={
          isManual ? (
            <ProductRequestManualPriceHint />
          ) : hidePrice ? (
            <ProductRequestCatalogPriceHiddenHint />
          ) : undefined
        }
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
  hideCatalogPrices = false,
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
  onPhotoPreview: ProductPhotoPreviewHandler;
  hideCatalogPrices?: boolean;
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
              const isManual = isManualDraftLine(l);
              return (
                <li
                  key={l.product_id}
                  className="flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/15 px-2.5 py-2"
                >
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-card">
                    <ProductCatalogExplorerThumb
                      photoUrl={isManual ? null : l.photo_url}
                      productType={l.product_type}
                      productName={l.name}
                      className="size-full"
                      ringClassName={t.photoRing}
                      onOpenPreview={
                        isManual
                          ? () => {}
                          : () =>
                              onPhotoPreview(l.photo_url, l.name, l.full_description, l.brand, l.product_type, {
                                catalogExplorerPreview: true,
                              })
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-foreground">{l.name}</p>
                    {isManual ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {td("qty")} <span className="font-bold tabular-nums text-foreground">{l.qty}</span>
                      </p>
                    ) : hideCatalogPrices ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {td("qty")} <span className="font-bold tabular-nums text-foreground">{l.qty}</span>
                      </p>
                    ) : (
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
                    )}
                    {isManual ? (
                      <p className="mt-1 text-[10px] leading-snug text-sky-800/90">{td("manualProductPriceHint")}</p>
                    ) : hideCatalogPrices ? (
                      <p className="mt-1 text-[10px] leading-snug text-sky-800/90">{td("catalogPriceHiddenHint")}</p>
                    ) : null}
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
            <PatientCartEstimatedTotal
              lines={lines}
              hideCatalogPrices={hideCatalogPrices}
              amountClassName={cn("text-lg font-bold", t.price)}
              suffixClassName="text-[0.65em] font-bold text-sky-600/80"
            />
          </div>
          {hideCatalogPrices && lines.some((l) => !isManualDraftLine(l)) ? (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{td("sendConfirmNoPricesNote")}</p>
          ) : null}
          {lines.some(isManualDraftLine) && !lines.every(isManualDraftLine) ? (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{td("manualProductTotalNote")}</p>
          ) : lines.every(isManualDraftLine) ? (
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{td("manualProductTotalNote")}</p>
          ) : null}
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
