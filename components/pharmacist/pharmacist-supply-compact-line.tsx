"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { History, MoreVertical, Package } from "lucide-react";
import {
  validatedLineLabelChipClass,
  type ValidatedLineLabel,
} from "@/lib/patient-validated-line-labels-fr";
import { pharmacistProposedProductBadgeFr } from "@/lib/request-display";

export type PharmacistSupplyLineTier =
  | "dispo_officine"
  | "commande"
  | "hors_perimetre"
  | "retire_apres_validation";

function validatedLineShellClass(tier: PharmacistSupplyLineTier, withdrawnGrey: boolean): string {
  if (withdrawnGrey) {
    return "border-slate-200/75 bg-slate-50/75 saturate-[0.65] opacity-[0.72]";
  }
  if (tier === "dispo_officine") return "border-sky-300/85 bg-white ring-1 ring-sky-200/55";
  if (tier === "commande") return "border-teal-300/85 bg-white ring-1 ring-teal-200/55";
  if (tier === "retire_apres_validation") return "border-red-200/85 bg-red-50/30";
  return "border-slate-200/80 bg-white";
}

export function PharmacistSupplyCompactLine({
  header,
  validatedName,
  validatedQty,
  /** Qté prescrite (ordonnance) — affichée jusqu’à clôture du dossier. */
  ordonnancePrescribedQty = null,
  availSentence,
  unitLabel,
  totalLabel,
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
  /** Dossier traité : masque réservé / commandé (jalons dans `lineSuiviSlot`) ; reçu en officine via `canShowArrivedReservedPill`. */
  hidePostConfirmFulfillmentPills = false,
  /** Bandeau jalons suivi (dossier traité). */
  lineSuiviSlot,
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
  showAjoutOfficineBadge,
  ajoutOfficineBadgeLabel,
  /** Badge origine ligne (Ordonnance / Proposé) — distinct de l’ajout post-validation. */
  lineOriginBadgeLabel,
  lineOriginBadgeTone = "ordonnance",
  withdrawDisabled,
  withdrawDisabledReason,
  supplyTier,
  validatedLineLabels,
  onPhotoPreview,
}: {
  header: string | null;
  validatedName: string;
  validatedQty: number;
  ordonnancePrescribedQty?: number | null;
  availSentence: string;
  unitLabel: string;
  totalLabel: string;
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
  lineSuiviSlot?: ReactNode;
  lineMessageButton?: ReactNode;
  postConfirmAmendmentBadges?: string[] | undefined;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onMenuModify: () => void;
  onMenuWithdraw: () => void;
  onMenuHistory: () => void;
  /** Modifier / écarter (désactivé en archive : annulé, expiré, abandonné, clôturé…). */
  supplyMutationsEnabled?: boolean;
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
  onPhotoPreview?: (url: string, title: string) => void;
}) {
  const pill =
    "inline-flex min-h-8 items-center justify-center rounded-md border px-2 text-[10px] font-semibold shadow-sm transition disabled:opacity-45";
  const pillActive = "border-emerald-600 bg-emerald-600 text-white";
  const pillIdle = "border-border bg-background text-foreground hover:bg-muted/50";

  const withdrawnGrey = Boolean(supplyTier && supplyTier === "retire_apres_validation");
  // Le menu (⋮) ne propose Modifier / Écarter que dans ces conditions ; sinon il ne
  // contiendrait que « Historique » → on n'affiche alors que l'icône Historique.
  const menuHasActions =
    supplyMutationsEnabled && selected && !lineLockedTrace && !withdrawn && !lineCounterLocked;
  const cardShell = supplyTier
    ? validatedLineShellClass(supplyTier, withdrawnGrey || withdrawn)
    : withdrawn
      ? "rounded-lg border border-amber-200/80 bg-amber-50/25 shadow-sm ring-1 ring-amber-100/50"
      : !selected
        ? "rounded-lg border border-slate-200/85 bg-white shadow-sm ring-1 ring-slate-100/60"
        : effAvailRow === "to_order"
          ? "rounded-lg border border-teal-200/75 bg-teal-50/25 shadow-sm ring-1 ring-teal-100/50"
          : "rounded-lg border border-sky-200/75 bg-sky-50/25 shadow-sm ring-1 ring-sky-100/50";

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

  return (
    <Fragment>
      {header ? (
        <li className="list-none pt-1.5 first:pt-0 sm:pt-2">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{header}</div>
        </li>
      ) : null}
      <li
        className={clsx(
          "list-none overflow-hidden px-2 py-1.5 sm:px-2.5 sm:py-2",
          cardShell,
          withdrawn && "opacity-[0.82] saturate-[0.72]"
        )}
      >
        <div className="relative flex flex-col gap-1.5">
          <div className="relative flex items-start gap-1.5">
            {menuHasActions ? (
            <div className="pointer-events-none absolute end-1 top-1 z-10">
              <button
                ref={anchorRef}
                type="button"
                disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Actions ligne"
                onClick={() => onMenuOpenChange(!menuOpen)}
                className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-lg border border-slate-300/90 bg-white/95 text-foreground shadow-sm hover:bg-slate-50 disabled:opacity-40"
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
                            {hasModifyConsent ? "Modifier la ligne…" : "Modifier (accord patient)…"}
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
                            Écarter la ligne…
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
            </div>
            ) : null}

            <div className="relative box-border h-[3.85rem] w-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card shadow-inner sm:h-[4rem] sm:w-[4rem]">
              {thumbUrl ? (
                onPhotoPreview ? (
                  <button
                    type="button"
                    className="size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    onClick={() => onPhotoPreview(thumbUrl, validatedName)}
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
              )}
            </div>

            <div className={clsx("min-w-0 flex-1", menuHasActions && "pe-10")}>
              <div className="flex min-w-0 items-start gap-1">
                <p
                  className={clsx(
                    "min-w-0 flex-1 truncate pb-px text-[13px] font-semibold leading-snug text-slate-950 sm:text-[14px]",
                    (withdrawnGrey || withdrawn) && "text-muted-foreground line-through decoration-slate-400/90"
                  )}
                  title={validatedName}
                >
                  {validatedName}
                </p>
                {lineMessageButton}
                {!menuHasActions ? (
                  <button
                    type="button"
                    disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
                    onClick={onMenuHistory}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-sky-300/80 bg-white text-sky-800 shadow-sm hover:bg-sky-50 disabled:opacity-40"
                    aria-label="Historique de cette ligne"
                    title="Historique"
                  >
                    <History className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
                  </button>
                ) : null}
              </div>
              {validatedLineLabels && validatedLineLabels.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {validatedLineLabels.map((label) => (
                    <span key={label.key} className={validatedLineLabelChipClass(label)}>
                      {label.text}
                    </span>
                  ))}
                </div>
              ) : (
                <>
                  {showAjoutOfficineBadge ? (
                    <span className="mt-1 inline-flex max-w-full rounded-full bg-violet-600 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                      {ajoutOfficineBadgeLabel ?? pharmacistProposedProductBadgeFr}
                    </span>
                  ) : lineOriginBadgeLabel ? (
                    <span
                      className={clsx(
                        "mt-1 inline-flex max-w-full rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white",
                        lineOriginBadgeTone === "ordonnance" ? "bg-amber-700" : "bg-violet-600"
                      )}
                    >
                      {lineOriginBadgeLabel}
                    </span>
                  ) : null}
                  <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-slate-700">{availSentence}</p>
                </>
              )}

              {!validatedLineLabels?.length &&
              postConfirmAmendmentBadges &&
              postConfirmAmendmentBadges.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
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
            </div>
          </div>

          <div className="flex min-w-0 flex-nowrap items-baseline justify-between gap-x-2 border-t border-border/45 pt-1.5 text-[12px] font-medium tabular-nums text-slate-800 sm:text-[13px]">
            <div className="min-w-0 shrink-0 whitespace-nowrap text-start">
              <span className="text-slate-500">PU</span>{" "}
              <strong className="font-semibold text-slate-900">{unitLabel}</strong>
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
                  <span className="text-slate-500">{ordonnancePrescribedQty != null ? "Retenu" : "Qté"}</span>
                  <strong className="font-semibold text-slate-900 tabular-nums">{validatedQty}</strong>
                </span>
              </span>
            </div>
            <div className="min-w-0 shrink-0 whitespace-nowrap text-end">
              <span className="inline-flex items-baseline justify-end gap-1">
                <span className="text-slate-500">Total</span>
                <strong className={clsx("font-semibold text-sky-900", withdrawn && "line-through decoration-muted-foreground/70")}>
                  {totalLabel}
                </strong>
              </span>
            </div>
          </div>

          {selected && !lineLockedTrace && !withdrawn ? (
            <div className="flex flex-wrap gap-1">
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
                    pill,
                    fulfillmentDraft === "arrived_reserved"
                      ? "border-teal-700 bg-teal-600 text-white"
                      : "border-teal-400/80 bg-background text-teal-950 hover:bg-teal-50/80"
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
                    pill,
                    counterPickupActive
                      ? pillActive
                      : "border-violet-500/70 bg-violet-50 text-violet-950 hover:bg-violet-100/90"
                  )}
                >
                  {counterPickupActive ? "Récupéré" : "Marquer récupéré"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {showExpandedEditor ? <div className="border-t border-border/60 bg-slate-50/40 px-2 py-1.5 sm:px-2.5">{expandedEditor}</div> : null}
        {lineSuiviSlot ? (
          <div className="border-t border-border/60 bg-slate-50/90 px-2 py-1.5 sm:px-2.5">{lineSuiviSlot}</div>
        ) : null}
        {treatedCounterSlot ? <div className="border-t border-border/60 bg-slate-50/35 px-2 py-1.5 sm:px-2.5">{treatedCounterSlot}</div> : null}
      </li>
    </Fragment>
  );
}
