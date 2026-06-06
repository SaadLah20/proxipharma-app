"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { History, MoreVertical, Package, Trash2 } from "lucide-react";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";
import {
  validatedLineLabelChipClass,
  type ValidatedLineLabel,
} from "@/lib/patient-validated-line-labels-fr";
import {
  ProductRequestLinePrices,
  ProductRequestLineQtyInline,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { patientBucketProductRowClass } from "@/lib/patient-bucket-product-row-ui";
import { pharmacistProposedProductBadgeFr } from "@/lib/request-display";

const VALIDATED_LINE_THUMB =
  "box-border size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";

export type PharmacistSupplyLineTier =
  | "dispo_officine"
  | "commande"
  | "hors_perimetre"
  | "retire_apres_validation"
  | "non_retenu";

function validatedLineRowClass(tier: PharmacistSupplyLineTier, withdrawnGrey: boolean): string {
  if (tier === "non_retenu") {
    return "bg-muted/30 opacity-[0.92]";
  }
  if (withdrawnGrey || tier === "retire_apres_validation") {
    return withdrawnGrey ? "opacity-75" : "opacity-90";
  }
  return "";
}

export function PharmacistSupplyCompactLine({
  header,
  validatedName,
  validatedBrand = null,
  validatedQty,
  /** Qté prescrite (ordonnance) — affichée jusqu’à clôture du dossier. */
  ordonnancePrescribedQty = null,
  availSentence,
  unitLabel,
  totalLabel,
  unitPriceMad = null,
  lineTotalMad = null,
  thumbUrl,
  selected,
  lineLockedTrace,
  withdrawn,
  effAvailRow,
  canMarkReserved,
  canMarkOrdered,
  fulfillmentDraft,
  fulfillmentActionsBusy,
  onToggleReserved,
  onToggleOrdered,
  onToggleArrivedReserved,
  canShowArrivedReservedPill,
  canMarkPickedUpCounterSupply,
  counterPickupActive = false,
  onMarkPickedUpCounter,
  counterOutcomeBusy,
  hasModifyConsent,
  busy,
  supplyConfirmBusy,
  lineCounterLocked,
  showExpandedEditor,
  expandedEditor,
  treatedCounterSlot,
  /** Dossier traité : masque réservé / commandé ; CTA reçu / récupéré via `compactTreatedActions`. */
  hidePostConfirmFulfillmentPills = false,
  /** Dossier traité : boutons « Marquer… » en rangée lisible (sans bandeau Suivi). */
  compactTreatedActions = false,
  /** Bouton rond message produit (à côté du nom / Historique). */
  lineMessageButton,
  /** Libellés courts post-validation (détail dans Historique produit). */
  postConfirmAmendmentBadges,
  menuOpen,
  onMenuOpenChange,
  onMenuModify,
  onMenuWithdraw,
  onMenuHistory,
  supplyMutationsEnabled = true,
  onRemovePendingAdd,
  showAjoutOfficineBadge,
  ajoutOfficineBadgeLabel,
  /** Badge origine ligne (Ordonnance / Proposé) — distinct de l’ajout post-validation. */
  lineOriginBadgeLabel,
  lineOriginBadgeTone = "ordonnance",
  withdrawDisabled,
  withdrawDisabledReason,
  supplyTier,
  validatedLineLabels,
  descriptionHtml,
  onPhotoPreview,
}: {
  header: string | null;
  validatedName: string;
  validatedBrand?: string | null;
  validatedQty: number;
  ordonnancePrescribedQty?: number | null;
  availSentence: string;
  unitLabel: string;
  totalLabel: string;
  unitPriceMad?: number | null;
  lineTotalMad?: number | null;
  thumbUrl: string | null;
  selected: boolean;
  lineLockedTrace: boolean;
  withdrawn: boolean;
  effAvailRow: string | null;
  canMarkReserved: boolean;
  canMarkOrdered: boolean;
  fulfillmentDraft: "unset" | "reserved" | "ordered" | "arrived_reserved";
  /** Enregistrement RPC réservé / commandé en cours sur cette ligne. */
  fulfillmentActionsBusy?: boolean;
  onToggleReserved: () => void;
  onToggleOrdered: () => void;
  /** Commandé → reçu en officine, ou reçu → repasser commandé (RPC). */
  onToggleArrivedReserved: () => void;
  canShowArrivedReservedPill: boolean;
  /** Dossier traité : pastille « récupéré comptoir » (réservé, ou commande déjà reçue). */
  canMarkPickedUpCounterSupply: boolean;
  /** Dossier traité : ligne déjà enregistrée comme récupérée au comptoir (pastille active, clic pour annuler). */
  counterPickupActive?: boolean;
  onMarkPickedUpCounter: () => void;
  counterOutcomeBusy?: boolean;
  hasModifyConsent: boolean;
  busy: boolean;
  supplyConfirmBusy: boolean;
  /** Ligne enregistrée « récupérée » : plus d’édition ni d’écarts. */
  lineCounterLocked: boolean;
  showExpandedEditor: boolean;
  expandedEditor: ReactNode;
  treatedCounterSlot: ReactNode | null;
  hidePostConfirmFulfillmentPills?: boolean;
  compactTreatedActions?: boolean;
  lineMessageButton?: ReactNode;
  postConfirmAmendmentBadges?: string[] | undefined;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onMenuModify: () => void;
  onMenuWithdraw: () => void;
  onMenuHistory: () => void;
  /** Modifier / écarter (désactivé en archive : annulé, expiré, abandonné, clôturé…). */
  supplyMutationsEnabled?: boolean;
  /** Ajout officine non enregistré : bouton supprimer local. */
  onRemovePendingAdd?: () => void;
  /** Proposition officine (aligné badge patient). */
  showAjoutOfficineBadge?: boolean;
  ajoutOfficineBadgeLabel?: string;
  lineOriginBadgeLabel?: string | null;
  lineOriginBadgeTone?: "ordonnance" | "proposed";
  withdrawDisabled: boolean;
  withdrawDisabledReason?: string | null;
  /** Sections validées (sky / teal) — aligné cartes patient. */
  supplyTier?: PharmacistSupplyLineTier;
  validatedLineLabels?: ValidatedLineLabel[];
  descriptionHtml?: string | null;
  onPhotoPreview?: ProductPhotoPreviewHandler;
}) {
  const pill =
    "inline-flex min-h-8 items-center justify-center rounded-md border px-2 text-[10px] font-semibold shadow-sm ring-1 ring-black/5 transition disabled:opacity-45";
  const pillActive = "border-emerald-700 bg-emerald-600 text-white ring-emerald-800/25";
  const pillIdle = "border-border/90 bg-card text-foreground hover:bg-muted/55";
  const treatedActionBtn =
    "inline-flex h-9 w-full min-w-0 items-center justify-center whitespace-nowrap rounded-lg border px-1 py-2 text-center text-[9px] font-semibold leading-none shadow-sm transition disabled:opacity-45 sm:px-1.5 sm:text-[10px]";

  const withdrawnGrey = Boolean(supplyTier && supplyTier === "retire_apres_validation");
  // Le menu (⋮) ne propose Modifier / Écarter que dans ces conditions ; sinon il ne
  // contiendrait que « Historique » → on n'affiche alors que l'icône Historique.
  const menuHasActions =
    supplyMutationsEnabled && selected && !lineLockedTrace && !withdrawn && !lineCounterLocked;
  const inBucketList = Boolean(supplyTier);
  const cardShell = inBucketList
    ? clsx(patientBucketProductRowClass, validatedLineRowClass(supplyTier!, withdrawnGrey || withdrawn))
    : withdrawn
      ? "rounded-lg border border-border/80 bg-muted/20 px-2 py-1.5 sm:px-2.5 sm:py-2"
      : !selected
        ? "rounded-lg border border-border/70 bg-muted/25 px-2 py-1.5 opacity-[0.92] sm:px-2.5 sm:py-2 shadow-sm"
        : effAvailRow === "to_order"
          ? "rounded-lg border border-border/80 border-l-[3px] border-l-teal-700 bg-teal-50/15 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-sm"
          : "rounded-lg border border-border/80 border-l-[3px] border-l-sky-600 bg-sky-50/15 px-2 py-1.5 sm:px-2.5 sm:py-2 shadow-sm";

  const anchorRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!menuOpen || !anchorRef.current) {
      setMenuPos(null);
      return undefined;
    }
    const sync = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = typeof window !== "undefined" ? window.innerWidth : 400;
      const menuW = 200;
      let left = r.right - menuW;
      if (left < 8) left = 8;
      if (left + menuW > vw - 8) left = Math.max(8, vw - menuW - 8);
      setMenuPos({ top: r.bottom + 4, left });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t)) return;
      const menuEl = document.querySelector("[data-pharma-supply-menu]");
      if (menuEl?.contains(t)) return;
      onMenuOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, onMenuOpenChange]);

  const thumbInner = thumbUrl ? (
    onPhotoPreview ? (
      <button
        type="button"
        className="size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        onClick={() => onPhotoPreview(thumbUrl, validatedName, descriptionHtml, validatedBrand)}
        aria-label={`Agrandir la photo · ${validatedName}`}
      >
        <img src={thumbUrl} alt="" className="pointer-events-none h-full w-full object-cover" />
      </button>
    ) : (
      <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
    )
  ) : (
    <div className="flex h-full w-full items-center justify-center">
      <Package className="size-5 text-muted-foreground" aria-hidden />
    </div>
  );

  const lineActionButtons = (
    <div className="flex shrink-0 items-center gap-2">
      {lineMessageButton}
      {onRemovePendingAdd ? (
        <button
          type="button"
          title="Supprimer cet ajout"
          aria-label="Supprimer cet ajout"
          disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
          onClick={onRemovePendingAdd}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-rose-200/90 bg-rose-50/90 text-rose-800 shadow-sm transition hover:bg-rose-100 disabled:opacity-40"
        >
          <Trash2 className="size-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      {menuHasActions ? (
        <>
          <button
            ref={anchorRef}
            type="button"
            disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Actions ligne"
            onClick={() => onMenuOpenChange(!menuOpen)}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-sm hover:bg-muted/50 disabled:opacity-40"
          >
            <MoreVertical className="size-4" strokeWidth={2} aria-hidden />
          </button>
          {menuOpen && menuPos
            ? createPortal(
                <ul
                  data-pharma-supply-menu
                  className="fixed z-[10120] min-w-[11rem] overflow-hidden rounded-lg border border-border bg-card py-0.5 text-[11px] shadow-lg"
                  style={{ top: menuPos.top, left: menuPos.left }}
                  role="menu"
                >
                  {supplyMutationsEnabled && selected && !lineLockedTrace && !withdrawn && !lineCounterLocked ? (
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
                        className="flex w-full px-2.5 py-2 text-left font-medium hover:bg-muted/60 disabled:opacity-45"
                        onClick={() => {
                          onMenuOpenChange(false);
                          onMenuModify();
                        }}
                      >
                        Modifier la ligne…
                      </button>
                    </li>
                  ) : null}
                  {supplyMutationsEnabled && selected && !lineLockedTrace && !withdrawn && !lineCounterLocked ? (
                    <li role="none">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy || supplyConfirmBusy || withdrawDisabled}
                        title={withdrawDisabled ? withdrawDisabledReason ?? undefined : undefined}
                        className="flex w-full px-2.5 py-2 text-left font-medium hover:bg-muted/60 disabled:opacity-45"
                        onClick={() => {
                          onMenuOpenChange(false);
                          onMenuWithdraw();
                        }}
                      >
                        Retirer la ligne…
                      </button>
                    </li>
                  ) : null}
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
                      className="flex w-full px-2.5 py-2 text-left font-medium hover:bg-muted/60 disabled:opacity-45"
                      onClick={() => {
                        onMenuOpenChange(false);
                        onMenuHistory();
                      }}
                    >
                      Historique produit
                    </button>
                  </li>
                </ul>,
                document.body
              )
            : null}
        </>
      ) : (
        <button
          type="button"
          disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
          onClick={onMenuHistory}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm hover:bg-muted/50 disabled:opacity-40"
          aria-label="Historique de cette ligne"
          title="Historique"
        >
          <History className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
        </button>
      )}
    </div>
  );

  const fulfillmentPills =
    selected && !lineLockedTrace && !withdrawn ? (
      <div
        className={clsx(
          compactTreatedActions ? "grid grid-cols-2 gap-1.5" : "flex flex-wrap gap-1"
        )}
      >
        {!lineCounterLocked && !hidePostConfirmFulfillmentPills ? (
          <>
            {(effAvailRow === "available" || effAvailRow === "partially_available") && canMarkReserved ? (
              <button
                type="button"
                disabled={busy || supplyConfirmBusy || lineCounterLocked || fulfillmentActionsBusy || counterOutcomeBusy}
                onClick={onToggleReserved}
                className={clsx(pill, fulfillmentDraft === "reserved" ? pillActive : pillIdle)}
              >
                {fulfillmentDraft === "reserved" ? "Réservé" : "Marquer réservé"}
              </button>
            ) : null}
            {effAvailRow === "to_order" && canMarkOrdered ? (
              <button
                type="button"
                disabled={busy || supplyConfirmBusy || lineCounterLocked || fulfillmentActionsBusy || counterOutcomeBusy}
                onClick={onToggleOrdered}
                className={clsx(
                  pill,
                  fulfillmentDraft === "ordered" || fulfillmentDraft === "arrived_reserved" ? pillActive : pillIdle
                )}
              >
                {fulfillmentDraft === "ordered" || fulfillmentDraft === "arrived_reserved"
                  ? "Commandé"
                  : "Marquer commandé"}
              </button>
            ) : null}
          </>
        ) : null}
        {effAvailRow === "to_order" && canShowArrivedReservedPill ? (
          <button
            type="button"
            disabled={busy || supplyConfirmBusy || lineCounterLocked || fulfillmentActionsBusy || counterOutcomeBusy}
            onClick={onToggleArrivedReserved}
            className={clsx(
              compactTreatedActions ? treatedActionBtn : pill,
              fulfillmentDraft === "arrived_reserved"
                ? "border-teal-700 bg-teal-600 text-white ring-teal-800/20"
                : "border-teal-500/80 bg-background text-teal-950 hover:bg-teal-50/80"
            )}
          >
            {fulfillmentDraft === "arrived_reserved" ? "Reçu en officine" : "Marquer reçu en officine"}
          </button>
        ) : null}
        {canMarkPickedUpCounterSupply ? (
          <button
            type="button"
            disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy || counterOutcomeBusy}
            onClick={onMarkPickedUpCounter}
            className={clsx(
              compactTreatedActions ? treatedActionBtn : pill,
              counterPickupActive
                ? "border-emerald-700 bg-emerald-600 text-white ring-emerald-800/20"
                : "border-violet-500/70 bg-violet-50 text-violet-950 hover:bg-violet-100/90"
            )}
          >
            {counterPickupActive ? "Récupéré" : "Marquer récupéré"}
          </button>
        ) : null}
      </div>
    ) : null;

  const bottomLabels = (
    <>
      <div className="flex flex-wrap gap-1 pt-0.5">
        {showAjoutOfficineBadge ? (
          <span className="inline-flex max-w-full rounded-full bg-violet-600 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
            {ajoutOfficineBadgeLabel ?? pharmacistProposedProductBadgeFr}
          </span>
        ) : lineOriginBadgeLabel ? (
          <span
            className={clsx(
              "inline-flex w-fit max-w-full rounded-full border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide",
              lineOriginBadgeTone === "ordonnance"
                ? "border-amber-300/70 bg-amber-50/40 text-amber-900/90"
                : "border-violet-300/70 bg-violet-50/50 text-violet-900"
            )}
          >
            {lineOriginBadgeLabel}
          </span>
        ) : null}
        {validatedLineLabels && validatedLineLabels.length > 0
          ? validatedLineLabels.map((label) => (
              <span key={label.key} className={validatedLineLabelChipClass(label)}>
                {label.text}
              </span>
            ))
          : !lineOriginBadgeLabel && !showAjoutOfficineBadge && !inBucketList ? (
              <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{availSentence}</p>
            ) : null}
      </div>
      {!validatedLineLabels?.length && postConfirmAmendmentBadges && postConfirmAmendmentBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {postConfirmAmendmentBadges.map((label) => (
            <span
              key={label}
              className="inline-flex max-w-full items-center rounded-md border border-slate-300/80 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-800"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <Fragment>
      {header ? (
        <li className="list-none pt-1.5 first:pt-0 sm:pt-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{header}</div>
        </li>
      ) : null}
      <li
        className={clsx(
          "list-none w-full min-w-0 overflow-visible",
          inBucketList ? cardShell : clsx("py-1.5", cardShell),
          withdrawn && !inBucketList && "opacity-[0.82] saturate-[0.72]"
        )}
      >
        {inBucketList ? (
          <div className="flex items-start gap-2.5">
            <div className={clsx(VALIDATED_LINE_THUMB, "self-start", (withdrawnGrey || withdrawn) && "opacity-95")}>
              {thumbInner}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p
                className={clsx(
                  "line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug text-slate-950 sm:text-[14px]",
                  (withdrawnGrey || withdrawn) && "text-muted-foreground line-through decoration-slate-400/90"
                )}
                title={validatedName}
              >
                {validatedName}
              </p>
              <div
                className={clsx(
                  "flex w-full items-end justify-between gap-3 leading-none",
                  (withdrawnGrey || withdrawn) && "opacity-85"
                )}
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
                  <ProductRequestLinePrices
                    unitPrice={unitPriceMad}
                    totalValue={selected && !withdrawn ? lineTotalMad : null}
                  />
                  {ordonnancePrescribedQty != null ? (
                    <span className="inline-flex items-baseline gap-1 whitespace-nowrap leading-none">
                      <span className="text-[10px] font-medium text-slate-500">Prescrit</span>
                      <span className="text-sm font-bold tabular-nums text-amber-950">{ordonnancePrescribedQty}</span>
                    </span>
                  ) : null}
                  {ordonnancePrescribedQty != null ? (
                    <span className="inline-flex items-baseline gap-1 whitespace-nowrap leading-none">
                      <span className="text-[10px] font-medium text-muted-foreground">Retenu</span>
                      <span className="text-sm font-bold tabular-nums text-foreground">{validatedQty}</span>
                    </span>
                  ) : (
                    <ProductRequestLineQtyInline qty={validatedQty} />
                  )}
                </div>
                {lineActionButtons}
              </div>
              {bottomLabels}
              {fulfillmentPills}
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col gap-1.5">
            <div className="flex items-start gap-2">
              <div className="relative box-border size-[3.5rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card sm:size-[3.65rem]">
                {thumbInner}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start gap-1.5">
                  <p
                    className={clsx(
                      "line-clamp-2 min-w-0 flex-1 pb-px text-[13px] font-semibold leading-snug text-slate-950 sm:text-[14px]",
                      (withdrawnGrey || withdrawn) && "text-muted-foreground line-through decoration-slate-400/90"
                    )}
                    title={validatedName}
                  >
                    {validatedName}
                  </p>
                  <div className="flex shrink-0 flex-col items-center gap-2">{lineActionButtons}</div>
                </div>
                {bottomLabels}
              </div>
            </div>
            <div className="flex min-w-0 flex-nowrap items-baseline justify-between gap-x-2 border-t border-border/45 pt-1.5 text-[11px] font-medium tabular-nums text-foreground sm:text-[12px]">
              <div className="min-w-0 shrink-0 whitespace-nowrap text-start">
                <span className="text-muted-foreground">PU</span>{" "}
                <strong className="font-semibold">{unitLabel}</strong>
              </div>
              <div className="min-w-0 flex-1 text-center">
                <span className="inline-flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0">
                  {ordonnancePrescribedQty != null ? (
                    <span className="inline-flex items-baseline gap-1">
                      <span className="text-slate-500">Prescrit</span>
                      <strong className="font-semibold text-amber-950 tabular-nums">{ordonnancePrescribedQty}</strong>
                    </span>
                  ) : null}
                  <span className="inline-flex items-baseline gap-1">
                    <span className="text-muted-foreground">{ordonnancePrescribedQty != null ? "Retenu" : "Qté"}</span>
                    <strong className="font-semibold tabular-nums">{validatedQty}</strong>
                  </span>
                </span>
              </div>
              <div className="min-w-0 shrink-0 whitespace-nowrap text-end">
                <span className="inline-flex items-baseline justify-end gap-1">
                  <span className="text-muted-foreground">Total</span>
                  <strong className={clsx("font-semibold", withdrawn && "line-through decoration-muted-foreground/70")}>
                    {totalLabel}
                  </strong>
                </span>
              </div>
            </div>
            {fulfillmentPills}
          </div>
        )}
        {showExpandedEditor ? <div className="border-t border-border/60 bg-slate-50/40 px-2 py-1.5 sm:px-2.5">{expandedEditor}</div> : null}
        {treatedCounterSlot ? <div className="border-t border-border/60 bg-slate-50/35 px-2 py-1.5 sm:px-2.5">{treatedCounterSlot}</div> : null}
      </li>
    </Fragment>
  );
}
