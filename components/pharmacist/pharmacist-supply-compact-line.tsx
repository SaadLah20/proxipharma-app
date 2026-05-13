"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { MoreVertical, Package } from "lucide-react";

export function PharmacistSupplyCompactLine({
  header,
  validatedName,
  validatedQty,
  availSentence,
  unitLabel,
  totalLabel,
  thumbUrl,
  ringClass,
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
  onMarkPickedUpCounter,
  counterOutcomeBusy,
  hasModifyConsent,
  busy,
  supplyConfirmBusy,
  lineCounterLocked,
  showExpandedEditor,
  expandedEditor,
  treatedCounterSlot,
  amendmentTraceLines,
  menuOpen,
  onMenuOpenChange,
  onMenuModify,
  onMenuWithdraw,
  onMenuHistory,
  onMenuReintegrateToReserve,
  horsBlocPrincipalMenu,
  withdrawDisabled,
  withdrawDisabledReason,
}: {
  header: string | null;
  validatedName: string;
  validatedQty: number;
  availSentence: string;
  unitLabel: string;
  totalLabel: string;
  thumbUrl: string | null;
  ringClass: string;
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
  /** Jalons `request_supply_amendments` liés à cette ligne (aperçu pour l’officine). */
  amendmentTraceLines?: string[] | undefined;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onMenuModify: () => void;
  onMenuWithdraw: () => void;
  onMenuHistory: () => void;
  /** Menu réduit : historique + réintégration vers le bloc « À réserver » (lignes hors périmètre). */
  onMenuReintegrateToReserve?: () => void;
  horsBlocPrincipalMenu?: boolean;
  withdrawDisabled: boolean;
  withdrawDisabledReason?: string | null;
}) {
  const pill =
    "inline-flex min-h-8 items-center justify-center rounded-md border px-2 text-[10px] font-semibold shadow-sm transition disabled:opacity-45";
  const pillActive = "border-emerald-600 bg-emerald-600 text-white";
  const pillIdle = "border-border bg-background text-foreground hover:bg-muted/50";

  const menuHorsBloc = Boolean(horsBlocPrincipalMenu && onMenuReintegrateToReserve);

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
        <li className="list-none pt-2 first:pt-0 sm:pt-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{header}</div>
        </li>
      ) : null}
      <li className={clsx("list-none overflow-hidden rounded-md border bg-card shadow-sm", ringClass, withdrawn && "opacity-[0.85]")}>
        <div className="relative flex items-start gap-2 p-1.5">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted/20">
            {thumbUrl ? (
              <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="size-5 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pe-8">
            <div className="absolute end-1.5 top-1.5 z-10">
              <button
                ref={anchorRef}
                type="button"
                disabled={
                  busy || supplyConfirmBusy || fulfillmentActionsBusy || (!menuHorsBloc && lineLockedTrace)
                }
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Actions ligne"
                onClick={() => onMenuOpenChange(!menuOpen)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-border/80 bg-background/95 text-foreground shadow-sm hover:bg-muted/80 disabled:opacity-40"
              >
                <MoreVertical className="size-4" strokeWidth={2} aria-hidden />
              </button>
              {menuOpen && menuPos
                ? createPortal(
                    <ul
                      data-pharma-supply-menu
                      className="fixed z-[85] min-w-[11rem] overflow-hidden rounded-lg border border-border bg-card py-0.5 text-[11px] shadow-lg"
                      style={{ top: menuPos.top, left: menuPos.left }}
                      role="menu"
                    >
                      {menuHorsBloc ? (
                        <>
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
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            disabled={busy || supplyConfirmBusy || fulfillmentActionsBusy}
                            className="flex w-full px-2.5 py-2 text-left font-medium hover:bg-muted/60 disabled:opacity-45"
                            onClick={() => {
                              onMenuOpenChange(false);
                              onMenuReintegrateToReserve?.();
                            }}
                          >
                            Réintégrer à « À réserver »…
                          </button>
                        </li>
                        </>
                      ) : (
                        <>
                          {selected && !lineLockedTrace && !withdrawn && !lineCounterLocked ? (
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
                          {selected && !lineLockedTrace && !withdrawn && !lineCounterLocked ? (
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
                        </>
                      )}
                    </ul>,
                    document.body
                  )
                : null}
            </div>

            <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-foreground">{validatedName}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
              <span className="tabular-nums font-medium text-foreground">Qté {validatedQty}</span>
              <span className="text-border" aria-hidden>
                {" "}
                ·{" "}
              </span>
              <span className="text-foreground">{availSentence}</span>
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
              <span className="text-foreground/90">Prix unit. </span>
              <span className="tabular-nums font-semibold text-foreground">{unitLabel}</span>
              <span className="mx-1 text-border" aria-hidden>
                ·
              </span>
              <span className="text-foreground/90">Total </span>
              <span className="tabular-nums font-semibold text-primary">{totalLabel}</span>
            </p>

            {selected && !lineLockedTrace && !withdrawn && !lineCounterLocked ? (
              <div className="mt-1 flex flex-wrap gap-1">
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
                      fulfillmentDraft === "ordered" || fulfillmentDraft === "arrived_reserved"
                        ? pillActive
                        : pillIdle
                    )}
                  >
                    {fulfillmentDraft === "unset" ? "Marquer commandé" : "Commandé"}
                  </button>
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
                    disabled={busy || supplyConfirmBusy || lineCounterLocked || fulfillmentActionsBusy || counterOutcomeBusy}
                    onClick={onMarkPickedUpCounter}
                    className={clsx(
                      pill,
                      "border-violet-500/70 bg-violet-50 text-violet-950 hover:bg-violet-100/90"
                    )}
                  >
                    Marquer récupéré (comptoir)
                  </button>
                ) : null}
              </div>
            ) : null}
            {amendmentTraceLines && amendmentTraceLines.length > 0 ? (
              <div className="mt-1.5 rounded-md border border-slate-200/90 bg-slate-50/95 px-2 py-1.5">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-600">Historique des changements (patient)</p>
                <ul className="mt-0.5 max-h-24 space-y-0.5 overflow-y-auto">
                  {amendmentTraceLines.map((t, i) => (
                    <li key={`${i}-${t.slice(0, 24)}`} className="text-[9px] leading-snug text-slate-800">
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        {showExpandedEditor ? <div className="border-t border-border/80 bg-muted/15 px-2 py-1.5">{expandedEditor}</div> : null}
        {treatedCounterSlot ? <div className="border-t border-border/80 px-2 py-1.5">{treatedCounterSlot}</div> : null}
      </li>
    </Fragment>
  );
}
