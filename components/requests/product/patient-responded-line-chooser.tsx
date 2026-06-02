"use client";

import { useId, useMemo, useState } from "react";
import { Check, Package, X } from "lucide-react";
import {
  ProductRequestLinePrices,
  ProductRequestLineQtyPicker,
  ProductRequestLineQtyReadonly,
} from "@/components/pharmacy/patient-demande-produits-ui";
import {
  lineConversationVisual,
  PharmacistLineMessageButton,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { uiActionBtnModalDismiss } from "@/lib/ui-action-buttons";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  type PatientRespondedBucketId,
  patientRespondedPrincipalTabStatusFr,
} from "@/lib/patient-responded-line-buckets";
import { patientMaxQtyAlternative, patientMaxQtyPrincipal } from "@/lib/alternative-qty-rules";
import { formatDateShortFr } from "@/lib/datetime-fr";
import {
  isPrescriptionAdditionalProposedLine,
  isPrescriptionOrdonnancePrincipalLine,
  PRESCRIPTION_ORDONNANCE_SOURCING_LABEL,
} from "@/lib/prescription-pharmacist-lines";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { cn } from "@/lib/utils";
import { patientBucketProductRowClass } from "@/lib/patient-bucket-product-row-ui";
import {
  lineSelQtyForBranch,
  type ActionItemAltRow,
  type ActionItemRow,
  type LineBranch,
  type LineSelState,
} from "@/components/requests/product/patient-product-request-actions";

/** Vignette répondue un peu plus haute que le panier standard (meilleure lisibilité). */
const RESPONDED_LINE_THUMB =
  "box-border size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function normalizeAlternatives(raw: ActionItemAltRow | ActionItemAltRow[] | null | undefined): ActionItemAltRow[] {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw].sort((a, b) => a.rank - b.rank) : [raw];
}

function maxQtyPrincipal(row: ActionItemRow): number {
  return patientMaxQtyPrincipal(row);
}

function maxQtyAlt(row: ActionItemRow, alt: ActionItemAltRow): number {
  return patientMaxQtyAlternative(row, alt);
}

function maxQtyForBranch(row: ActionItemRow, branch: LineBranch, alts: ActionItemAltRow[]): number {
  if (branch === null) return 0;
  if (branch === "principal") return maxQtyPrincipal(row);
  const alt = alts.find((a) => a.id === branch);
  if (!alt) return 0;
  return maxQtyAlt(row, alt);
}

function branchFromTab(tab: string): Exclude<LineBranch, null> {
  return tab === "principal" ? "principal" : tab;
}

function lineBadgeLabelFr(opts: {
  requestType: string;
  isAlt: boolean;
  isProposedLine: boolean;
  isOrdonnancePrincipal: boolean;
  isExtraProposed: boolean;
  pharmacistProposedBadgeLabel: string;
}): string {
  if (opts.isAlt) return "Alternative";
  if (opts.requestType === "prescription" && opts.isOrdonnancePrincipal) return "Ordonnance";
  if (opts.requestType === "prescription" && opts.isExtraProposed) return "Produit proposé par la pharmacie";
  if (opts.requestType === "free_consultation" && opts.isProposedLine) return "Proposition pharmacie";
  if (opts.isProposedLine) return opts.pharmacistProposedBadgeLabel || "Ajout Officine";
  return "Ta demande";
}

function RespondedLineQtyMeta({
  bucketId,
  isAlt,
  showRequested,
  requestedQty,
  expectedDate,
  statusLabel,
}: {
  bucketId: PatientRespondedBucketId;
  isAlt: boolean;
  showRequested: boolean;
  requestedQty: number;
  expectedDate: string | null;
  /** Indisponible / En rupture — affiché à droite de la qté demandée (branche « Ta demande »). */
  statusLabel?: string | null;
}) {
  const qtyLine = showRequested ? (
    <span className="text-[10px] text-muted-foreground">
      Qté demandée <strong className="tabular-nums text-foreground">{requestedQty}</strong>
    </span>
  ) : null;

  const statusChip = statusLabel ? (
    <span className="rounded border border-amber-200/70 bg-amber-50/40 px-1.5 py-px text-[9px] font-semibold text-amber-900/90">
      {statusLabel}
    </span>
  ) : null;

  const qtyWithStatus =
    qtyLine || statusChip ? (
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {qtyLine}
        {statusChip}
      </div>
    ) : null;

  if (bucketId === "to_order") {
    return (
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {qtyLine}
        {expectedDate ? (
          <span className="text-[10px] font-medium text-teal-800/85">
            Réception prévue · {formatDateShortFr(expectedDate)}
          </span>
        ) : (
          <span className="text-[10px] font-medium text-muted-foreground">Date de réception à confirmer</span>
        )}
      </div>
    );
  }

  if (bucketId === "indispo_with_alts" || bucketId === "indispo_no_alts") {
    if (isAlt || (!showRequested && !statusLabel)) return null;
    return qtyWithStatus;
  }

  if (!showRequested && !statusLabel) return null;
  return qtyWithStatus;
}

function RespondedLineNotesButton({
  productName,
  client,
  pharmacist,
}: {
  productName: string;
  client: string;
  pharmacist: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const c = client.trim();
  const p = pharmacist.trim();
  const visual = lineConversationVisual(c, p);

  return (
    <>
      <PharmacistLineMessageButton
        visual={visual}
        open={open}
        onClick={() => setOpen(true)}
        appearance="neutral"
      />
      {open ? (
        <AppModalOverlay open aria-labelledby={titleId} onBackdropClick={() => setOpen(false)}>
              <div
                className={cn("max-h-[min(80vh,20rem)] w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl sm:mx-auto", t.modalShell)}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={cn("flex items-start justify-between gap-2 border-b px-3 py-2", t.modalHeader)}>
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <span className="block">Message</span>
                      <span className="mt-1 block text-[13px] font-semibold normal-case leading-snug text-foreground">
                        {productName}
                      </span>
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
                    aria-label="Fermer"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[min(60vh,16rem)] space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5 text-[11px] [-webkit-overflow-scrolling:touch]">
                  {!c && !p ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">Aucun message sur ce produit.</p>
                  ) : null}
                  {c ? (
                    <div className="rounded-lg border border-border/80 border-l-2 border-l-sky-500/70 bg-muted/20 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Vous</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-foreground">{c}</p>
                    </div>
                  ) : null}
                  {p ? (
                    <div className="rounded-lg border border-border/80 border-l-2 border-l-emerald-500/70 bg-muted/20 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">Officine</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-foreground">{p}</p>
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-border/60 px-3 py-2">
                  <button
                    type="button"
                    className={uiActionBtnModalDismiss()}
                    onClick={() => setOpen(false)}
                  >
                    Fermer
                  </button>
                </div>
              </div>
        </AppModalOverlay>
      ) : null}
    </>
  );
}

type VariantData = {
  tabId: string;
  tabLabel: string;
  badgeLabel: string;
  productName: string;
  photoUrl: string | null;
  showRequested: boolean;
  requestedQty: number;
  stockQty: number | null;
  unitPrice: number | null;
  availabilityStatus: string | null;
  expectedDate: string | null;
  clientComment: string;
  pharmacistComment: string;
  branch: LineBranch;
  cap: number;
  /** Ajout / proposition officine : afficher le motif pharmacien dans le bloc. */
  showProposalMotif: boolean;
  proposalReason: string | null;
  /** Statut « Ta demande » (Indisponible, En rupture…) — affiché dans le bloc produit. */
  principalStatusLabel: string | null;
};

const TAB_CHECKBOX_PAD = "flex shrink-0 items-center py-1 pl-2 pr-1";

function RespondedVariantTabCheckbox({
  tabId,
  retainable,
  isSelected,
}: {
  tabId: string;
  retainable: boolean;
  isSelected: boolean;
}) {
  const isPrincipal = tabId === "principal";
  const closedBoxClass = cn(
    "size-3.5 shrink-0 rounded border bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]",
    isSelected && retainable && isPrincipal
      ? "border-emerald-500/70"
      : "border-border/80"
  );

  if (!retainable) {
    return (
      <span className={cn(TAB_CHECKBOX_PAD)} aria-hidden>
        <span className={cn(closedBoxClass, "border-border/60 bg-muted/30")} />
      </span>
    );
  }

  if (isPrincipal) {
    return (
      <span className={cn(TAB_CHECKBOX_PAD)} aria-hidden>
        <span className={closedBoxClass} />
      </span>
    );
  }

  return (
    <span className={cn(TAB_CHECKBOX_PAD, "justify-center")} aria-hidden={!isSelected}>
      {isSelected ? (
        <Check className="size-3.5 text-emerald-600" strokeWidth={3} />
      ) : (
        <span className={closedBoxClass} />
      )}
    </span>
  );
}

function respondedVariantTabShellClass(opts: {
  retainable: boolean;
  isViewing: boolean;
  isSelected?: boolean;
  isPrincipal?: boolean;
}): string {
  const { retainable, isViewing } = opts;
  const focusShell = "border-foreground/20 bg-card shadow-sm ring-1 ring-foreground/5";

  return cn(
    "flex min-h-[1.85rem] min-w-0 items-center rounded-lg border border-border/80 bg-muted/20 transition",
    isViewing && focusShell,
    !isViewing && retainable && "hover:border-border hover:bg-card",
    !isViewing && !retainable && "opacity-90"
  );
}

function RespondedVariantRetainBar({
  tabId,
  retainable,
  isSelected,
  readOnly,
  onToggle,
}: {
  tabId: string;
  retainable: boolean;
  isSelected: boolean;
  readOnly: boolean;
  onToggle: (on: boolean) => void;
}) {
  const isPrincipal = tabId === "principal";
  const retainLabel = isPrincipal ? "Retenir votre demande initiale" : "Retenir cette alternative";

  if (!retainable) {
    return (
      <p className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-center text-[10px] leading-snug text-muted-foreground">
        {isPrincipal
          ? "Votre demande initiale n’est pas retenable — consultez les alternatives proposées."
          : "Cette alternative n’est pas retenable."}
      </p>
    );
  }

  if (isPrincipal) {
    const closedBoxClass = cn(
      "size-4 shrink-0 rounded border bg-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.8)]",
      isSelected ? "border-emerald-500/70" : "border-border/80"
    );
    if (readOnly) {
      return (
        <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-2">
          <span className={closedBoxClass} aria-hidden />
          <span className="text-[11px] font-semibold leading-snug text-foreground">{retainLabel}</span>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-2 transition hover:bg-muted/25"
        aria-pressed={isSelected}
        aria-label={isSelected ? `${retainLabel} — cliquer pour retirer` : retainLabel}
        onClick={() => onToggle(!isSelected)}
      >
        <span className={closedBoxClass} aria-hidden />
        <span className="text-[11px] font-semibold leading-snug text-foreground">{retainLabel}</span>
      </button>
    );
  }

  if (readOnly) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-2">
        {isSelected ? (
          <Check className="size-4 shrink-0 text-emerald-600" strokeWidth={3} aria-hidden />
        ) : (
          <span className="size-4 shrink-0 rounded border border-border/80 bg-white" aria-hidden />
        )}
        <span className="text-[11px] font-semibold leading-snug text-foreground">{retainLabel}</span>
      </div>
    );
  }

  return (
    <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-2 transition hover:bg-muted/25">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-4 shrink-0 rounded border-border accent-emerald-600"
        aria-label={isSelected ? `${retainLabel} — cliquer pour retirer` : retainLabel}
      />
      <span className="text-[11px] font-semibold leading-snug text-foreground">{retainLabel}</span>
    </label>
  );
}

function RespondedVariantTabs({
  tabs,
  activeTab,
  selectedTabId,
  onTab,
  className,
}: {
  tabs: { id: string; label: string; retainable: boolean }[];
  activeTab: string;
  /** Onglet dont la branche est cochée par le patient (`null` = aucune). */
  selectedTabId: string | null;
  onTab: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex min-w-0 gap-1" role="tablist" aria-label="Options pour ce produit">
        {tabs.map((tab) => {
          const isViewing = tab.id === activeTab;
          const isSelected = selectedTabId === tab.id;
          const isPrincipal = tab.id === "principal";
          const dim = !tab.retainable;
          return (
            <div
              key={tab.id}
              role="presentation"
              className={cn(
                respondedVariantTabShellClass({
                  retainable: tab.retainable,
                  isViewing,
                  isSelected,
                  isPrincipal,
                }),
                isPrincipal ? "min-w-[4.75rem] flex-[1.25]" : "min-w-[3.25rem] flex-1"
              )}
            >
              <RespondedVariantTabCheckbox
                tabId={tab.id}
                retainable={tab.retainable}
                isSelected={isSelected}
              />
              <button
                type="button"
                role="tab"
                aria-selected={isViewing}
                aria-current={isViewing ? "true" : undefined}
                title={
                  dim
                    ? "Non retenable — consultez le statut sous le produit"
                    : isViewing
                      ? "Option affichée"
                      : "Cliquez pour consulter"
                }
                className={cn(
                  "min-w-0 flex-1 truncate py-1 pr-1.5 text-left text-[10px] font-semibold leading-none transition",
                  dim && !isViewing && "text-muted-foreground",
                  dim && isViewing && "text-foreground",
                  !dim && isViewing && "text-foreground",
                  !dim && !isViewing && "text-muted-foreground"
                )}
                onClick={() => onTab(tab.id)}
              >
                {tab.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RespondedRetainControl({
  retained,
  unavailable,
  readOnly,
  onToggle,
}: {
  retained: boolean;
  unavailable: boolean;
  readOnly: boolean;
  onToggle: (on: boolean) => void;
}) {
  if (unavailable) {
    return (
      <span className="block w-full text-center text-[8px] font-semibold leading-none text-slate-400">—</span>
    );
  }
  if (readOnly) {
    return retained ? (
      <span className="flex w-full max-w-[3.85rem] items-center justify-center gap-0.5 leading-none">
        <Check className="size-4 shrink-0 text-emerald-600" strokeWidth={3} aria-hidden />
        <span className="text-[8px] font-bold text-emerald-700">OK</span>
      </span>
    ) : null;
  }
  return (
    <label className="flex w-full max-w-[3.85rem] cursor-pointer items-center justify-center gap-0.5 leading-none">
      <input
        type="checkbox"
        checked={retained}
        onChange={(e) => onToggle(e.target.checked)}
        className="size-4 shrink-0 rounded border-border accent-emerald-600"
        aria-label={retained ? "Produit retenu — cliquer pour retirer" : "Inclure ce produit dans votre validation"}
      />
      <span className="text-[8px] font-bold text-muted-foreground">OK</span>
    </label>
  );
}

function RespondedProposedMotifBlock({
  label,
  reason,
  unavailable,
}: {
  label: string;
  reason: string | null;
  unavailable: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/70 border-l-2 border-l-violet-400/60 bg-muted/20 px-2 py-1",
        unavailable && "opacity-90"
      )}
    >
      <p className="text-[10px] leading-snug text-foreground/90">
        <span className="font-semibold text-violet-800/90">{label}</span>
        {reason ? (
          <span className="text-muted-foreground"> — {reason}</span>
        ) : (
          <span className="italic text-muted-foreground"> — motif non renseigné</span>
        )}
      </p>
    </div>
  );
}

function RespondedLineBlock({
  variant,
  retained,
  selQty,
  onToggleRetain,
  onSetQty,
  onPhotoPreview,
  ajoutOfficineLabel = "Ajout Officine",
  variantTabsAbove = false,
  readOnly = false,
  bucketId,
}: {
  variant: VariantData;
  retained: boolean;
  selQty: number;
  onToggleRetain: (on: boolean) => void;
  onSetQty: (qty: number) => void;
  onPhotoPreview?: (url: string, title: string) => void;
  ajoutOfficineLabel?: string;
  /** Onglets Ta demande / Alternative au-dessus — case un peu plus basse pour ne pas gêner. */
  variantTabsAbove?: boolean;
  /** Archive (expirée / annulée en répondue) : pas de case ni changement de qté. */
  readOnly?: boolean;
  bucketId: PatientRespondedBucketId;
}) {
  const unavailable = variant.cap < 1;
  /** Avec onglets : PU/Tot/qty visibles sur l’onglet consulté (comparaison), pas seulement si cette branche est cochée. */
  const showQty = variantTabsAbove
    ? !unavailable && variant.cap > 0
    : retained && !unavailable;
  const notRetained = variantTabsAbove ? false : !retained && !unavailable;
  const total =
    variant.unitPrice != null && Number.isFinite(Number(variant.unitPrice))
      ? selQty * Number(variant.unitPrice)
      : null;

  const thumbInner = variant.photoUrl ? (
    onPhotoPreview ? (
      <button
        type="button"
        className={cn("size-full cursor-zoom-in focus:outline-none focus-visible:ring-2", t.photoRing)}
        onClick={() => onPhotoPreview(variant.photoUrl!, variant.productName)}
        aria-label={`Agrandir la photo · ${variant.productName}`}
      >
        <img src={variant.photoUrl} alt="" className="pointer-events-none h-full w-full object-cover" />
      </button>
    ) : (
      <img src={variant.photoUrl} alt="" className="h-full w-full object-cover" />
    )
  ) : (
    <span className="flex h-full w-full items-center justify-center">
      <Package className="size-5 text-muted-foreground" aria-hidden />
    </span>
  );

  const unit = variant.unitPrice != null ? Number(variant.unitPrice) : null;
  const isProposedBlock = variant.showProposalMotif;

  return (
    <div
      className={cn(
        "w-full min-w-0 transition",
        notRetained && !unavailable && !variantTabsAbove && "opacity-70"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "shrink-0",
            variantTabsAbove ? "w-[3.5rem]" : "flex w-[3.85rem] flex-col items-center gap-1"
          )}
        >
          <div className={cn(RESPONDED_LINE_THUMB, variantTabsAbove && "size-[3.5rem]")}>{thumbInner}</div>
          {!variantTabsAbove ? (
            <RespondedRetainControl
              retained={retained}
              unavailable={unavailable}
              readOnly={readOnly}
              onToggle={onToggleRetain}
            />
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="space-y-1">
            <p
              className={cn(
                "min-w-0 text-[13px] font-semibold leading-snug",
                unavailable ? "text-slate-600" : "text-foreground",
                notRetained && !unavailable && "text-muted-foreground line-through decoration-slate-400/90"
              )}
              title={variant.productName}
            >
              {variant.productName}
            </p>

            {isProposedBlock ? (
              <RespondedProposedMotifBlock
                label={ajoutOfficineLabel}
                reason={variant.proposalReason}
                unavailable={unavailable}
              />
            ) : null}

            {!variantTabsAbove ? (
              <RespondedLineQtyMeta
                bucketId={bucketId}
                isAlt={variant.branch !== "principal"}
                showRequested={variant.showRequested}
                requestedQty={variant.requestedQty}
                expectedDate={variant.expectedDate}
                statusLabel={variant.branch === "principal" ? variant.principalStatusLabel : null}
              />
            ) : variant.expectedDate && bucketId === "to_order" ? (
              <p className="text-[10px] font-medium text-teal-800/85">
                Réception prévue · {formatDateShortFr(variant.expectedDate)}
              </p>
            ) : variant.branch === "principal" ? (
              <RespondedLineQtyMeta
                bucketId={bucketId}
                isAlt={false}
                showRequested={variant.showRequested}
                requestedQty={variant.requestedQty}
                expectedDate={null}
                statusLabel={variant.principalStatusLabel}
              />
            ) : null}
          </div>

          <div className="flex w-full items-end justify-between gap-2 pt-0.5">
            <div className="min-w-0 shrink leading-none">
              <ProductRequestLinePrices
                unitPrice={unit}
                totalValue={showQty && total != null ? total : null}
              />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {showQty ? (
                readOnly ? (
                  <ProductRequestLineQtyReadonly qty={selQty} appearance="neutral" />
                ) : (
                  <ProductRequestLineQtyPicker
                    qty={selQty}
                    maxQty={variant.cap}
                    appearance="neutral"
                    onSelect={(n) => onSetQty(Math.min(variant.cap, Math.max(1, n)))}
                  />
                )
              ) : null}
              <RespondedLineNotesButton
                productName={variant.productName}
                client={variant.clientComment}
                pharmacist={variant.pharmacistComment}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type RespondedProdBrief = {
  product_type?: string | null;
  laboratory?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
};

function resolvedRespondedUnitPrice(
  stored: number | null | undefined,
  productId: string,
  prod: RespondedProdBrief | null,
  resolveCatalog?: (productId: string, prod: RespondedProdBrief | null) => number | null
): number | null {
  if (stored != null && Number.isFinite(Number(stored))) return Number(stored);
  return resolveCatalog?.(productId, prod) ?? null;
}

export type RespondedChooserProps = {
  row: ActionItemRow;
  selState: LineSelState;
  setLineBranch: (itemId: string, branch: LineBranch) => void;
  setLineQty: (itemId: string, qty: number, forBranch: Exclude<LineBranch, null>) => void;
  toggleLineRetention: (itemId: string, on: boolean, branchWhenOn: Exclude<LineBranch, null>) => void;
  onPhotoPreview?: (url: string, title: string) => void;
  pharmacistProposedBadgeLabel: string;
  requestType: string;
  supplyAmendmentBundles: { amendments: unknown }[];
  resolveCatalogUnitPrice?: (productId: string, prod: RespondedProdBrief | null) => number | null;
  readOnly?: boolean;
  bucketId: PatientRespondedBucketId;
};

export function RespondedPatientLineChooser({
  row,
  selState,
  setLineBranch,
  setLineQty,
  toggleLineRetention,
  onPhotoPreview,
  pharmacistProposedBadgeLabel,
  requestType,
  supplyAmendmentBundles,
  resolveCatalogUnitPrice,
  readOnly = false,
  bucketId,
}: RespondedChooserProps) {
  const prod = one(row.products);
  const altList = normalizeAlternatives(row.request_item_alternatives);
  const hasAlts = altList.length > 0;
  const isProposedLine = row.line_source === "pharmacist_proposed";
  const isOrdonnancePrincipal =
    requestType === "prescription" &&
    isPrescriptionOrdonnancePrincipalLine(requestType, row, supplyAmendmentBundles);
  const isExtraProposed =
    requestType === "prescription" &&
    isPrescriptionAdditionalProposedLine(requestType, row, supplyAmendmentBundles);


  const [browseTab, setBrowseTab] = useState("principal");

  /** Onglet consulté (navigation libre, indépendante de la branche cochée). */
  const activeTab = browseTab;

  const selectedTabId: string | null =
    selState.branch === null ? null : selState.branch === "principal" ? "principal" : selState.branch;

  const buildPrincipalVariant = (): VariantData => {
    const stockQty =
      row.available_qty != null && Number.isFinite(Number(row.available_qty))
        ? Math.max(0, Math.floor(Number(row.available_qty)))
        : null;
    return {
      tabId: "principal",
      tabLabel: "Ta demande",
      badgeLabel: lineBadgeLabelFr({
        requestType,
        isAlt: false,
        isProposedLine,
        isOrdonnancePrincipal,
        isExtraProposed,
        pharmacistProposedBadgeLabel,
      }),
      productName: prod?.name ?? "Produit",
      photoUrl: resolvePublicMediaUrl(prod?.photo_url ?? null),
      showRequested: !isProposedLine,
      requestedQty: Math.max(1, Number(row.requested_qty) || 1),
      stockQty,
      unitPrice: resolvedRespondedUnitPrice(
        row.unit_price,
        row.product_id,
        prod,
        resolveCatalogUnitPrice
      ),
      availabilityStatus: row.availability_status,
      expectedDate: row.expected_availability_date,
      clientComment: row.client_comment ?? "",
      pharmacistComment: row.pharmacist_comment ?? "",
      branch: "principal",
      cap: maxQtyPrincipal(row),
      showProposalMotif: isProposedLine || isExtraProposed,
      proposalReason: row.pharmacist_proposal_reason?.trim() || null,
      principalStatusLabel: patientRespondedPrincipalTabStatusFr(row),
    };
  };

  const buildAltVariant = (alt: ActionItemAltRow, index: number): VariantData => {
    const altProd = one(alt.products);
    const stockQty =
      alt.available_qty != null && Number.isFinite(Number(alt.available_qty))
        ? Math.max(0, Math.floor(Number(alt.available_qty)))
        : null;
    return {
      tabId: alt.id,
      tabLabel: `Alt. ${index + 1}`,
      badgeLabel: "Alternative",
      productName: altProd?.name ?? "Alternative",
      photoUrl: resolvePublicMediaUrl(altProd?.photo_url ?? null),
      showRequested: false,
      requestedQty: 0,
      stockQty,
      unitPrice: resolvedRespondedUnitPrice(
        alt.unit_price,
        alt.product_id,
        altProd,
        resolveCatalogUnitPrice
      ),
      availabilityStatus: alt.availability_status,
      expectedDate: alt.expected_availability_date,
      clientComment: "",
      pharmacistComment: alt.pharmacist_comment ?? "",
      branch: alt.id,
      cap: maxQtyAlt(row, alt),
      showProposalMotif: false,
      proposalReason: null,
      principalStatusLabel: null,
    };
  };

  const variants = useMemo(() => {
    const list = [buildPrincipalVariant()];
    altList.forEach((alt, i) => list.push(buildAltVariant(alt, i)));
    return list;
  }, [
    row,
    altList,
    requestType,
    isProposedLine,
    isOrdonnancePrincipal,
    isExtraProposed,
    pharmacistProposedBadgeLabel,
    supplyAmendmentBundles,
    prod?.name,
    prod?.photo_url,
    row.pharmacist_proposal_reason,
    resolveCatalogUnitPrice,
  ]);

  const activeVariant = variants.find((v) => v.tabId === activeTab) ?? variants[0]!;
  const activeBranch = branchFromTab(activeTab);
  const retainedForTab = readOnly ? true : selState.branch === activeBranch;
  const displayQty = lineSelQtyForBranch(selState, activeBranch, activeVariant.cap);

  const onTab = (tabId: string) => {
    setBrowseTab(tabId);
  };

  if (!hasAlts) {
    const v = buildPrincipalVariant();
    return (
      <li className={patientBucketProductRowClass}>
        {requestType === "prescription" && isOrdonnancePrincipal ? (
          <p className="mb-1.5 text-[10px] font-semibold text-muted-foreground">{PRESCRIPTION_ORDONNANCE_SOURCING_LABEL}</p>
        ) : null}
        <RespondedLineBlock
          variant={v}
          retained={readOnly ? true : selState.branch === "principal"}
          selQty={lineSelQtyForBranch(selState, "principal", v.cap)}
          onToggleRetain={(on) => toggleLineRetention(row.id, on, "principal")}
          onSetQty={(qty) => setLineQty(row.id, qty, "principal")}
          onPhotoPreview={onPhotoPreview}
          ajoutOfficineLabel={pharmacistProposedBadgeLabel}
          readOnly={readOnly}
          bucketId={bucketId}
        />
      </li>
    );
  }

  return (
    <li className={cn(patientBucketProductRowClass, "overflow-visible")}>
      <div className="space-y-2 pb-2">
        <RespondedVariantTabs
          tabs={variants.map((v) => ({
            id: v.tabId,
            label: v.tabLabel,
            retainable: v.cap > 0,
          }))}
          activeTab={activeTab}
          selectedTabId={selectedTabId}
          onTab={onTab}
        />
        <RespondedVariantRetainBar
          tabId={activeVariant.tabId}
          retainable={activeVariant.cap > 0}
          isSelected={selectedTabId === activeVariant.tabId}
          readOnly={readOnly}
          onToggle={(on) => {
            toggleLineRetention(row.id, on, activeBranch);
            if (on) setBrowseTab(activeVariant.tabId);
          }}
        />
      </div>
      <div>
        <RespondedLineBlock
          variant={activeVariant}
          retained={retainedForTab}
          selQty={displayQty}
          onToggleRetain={(on) => toggleLineRetention(row.id, on, activeBranch)}
          onSetQty={(qty) => setLineQty(row.id, qty, activeBranch)}
          onPhotoPreview={onPhotoPreview}
          ajoutOfficineLabel={pharmacistProposedBadgeLabel}
          variantTabsAbove
          readOnly={readOnly}
          bucketId={bucketId}
        />
      </div>
    </li>
  );
}
