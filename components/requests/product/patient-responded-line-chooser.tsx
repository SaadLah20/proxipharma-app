"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Package, X, HelpCircle } from "lucide-react";
import {
  ProductRequestLinePrices,
  ProductRequestLineQtyPicker,
  ProductRequestLineQtyReadonly,
} from "@/components/pharmacy/patient-demande-produits-ui";
import {
  lineConversationVisual,
  PharmacistLineMessageButton,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";

/** Vignette répondue un peu plus haute que le panier standard (meilleure lisibilité). */
const RESPONDED_LINE_THUMB =
  "box-border size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";
import { uiActionBtnModalDismiss } from "@/lib/ui-action-buttons";
import { uiSecondaryLabel } from "@/lib/ui-label-styles";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import type { PatientRespondedBucketId } from "@/lib/patient-responded-line-buckets";
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
import {
  lineSelQtyForBranch,
  type ActionItemAltRow,
  type ActionItemRow,
  type LineBranch,
  type LineSelState,
} from "@/components/requests/product/patient-product-request-actions";

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
}: {
  bucketId: PatientRespondedBucketId;
  isAlt: boolean;
  showRequested: boolean;
  requestedQty: number;
  expectedDate: string | null;
}) {
  if (bucketId === "to_order") {
    return (
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {showRequested ? (
          <span className="text-[10px] text-muted-foreground">
            Qté demandée{" "}
            <strong className="tabular-nums text-foreground">{requestedQty}</strong>
          </span>
        ) : null}
        {expectedDate ? (
          <span className="text-[11px] font-semibold leading-snug text-teal-900">
            Réception prévue · {formatDateShortFr(expectedDate)}
          </span>
        ) : (
          <span className="text-[11px] font-medium text-teal-800/90">Date de réception à confirmer</span>
        )}
      </div>
    );
  }

  if (bucketId === "indispo_with_alts" || bucketId === "indispo_no_alts") {
    if (isAlt || !showRequested) return null;
    return (
      <p className="text-[10px] text-muted-foreground">
        Qté demandée <strong className="tabular-nums text-foreground">{requestedQty}</strong>
      </p>
    );
  }

  if (!showRequested) return null;
  return (
    <p className="text-[10px] text-muted-foreground">
      Qté demandée <strong className="tabular-nums text-foreground">{requestedQty}</strong>
    </p>
  );
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
      <PharmacistLineMessageButton visual={visual} open={open} onClick={() => setOpen(true)} />
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
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900">Vous</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-sky-950">{c}</p>
                    </div>
                  ) : null}
                  {p ? (
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-900">Officine</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-emerald-950">{p}</p>
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
};

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
  const activeMeta = tabs.find((t) => t.id === activeTab) ?? tabs[0];
  const selectedMeta = selectedTabId ? tabs.find((t) => t.id === selectedTabId) : null;
  const viewingLabel = activeMeta?.label ?? "Option";
  const choiceLabel = selectedMeta?.label ?? null;

  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <div
        className="grid min-w-0 gap-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(tabs.length, 1)}, minmax(0, 1fr))` }}
        role="tablist"
        aria-label="Options pour ce produit"
      >
        {tabs.map((tab) => {
          const isViewing = tab.id === activeTab;
          const isSelected = selectedTabId === tab.id;
          const dim = !tab.retainable;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isViewing}
              aria-current={isViewing ? "true" : undefined}
              title={
                dim
                  ? "Non retenable — rupture ou indisponible"
                  : isSelected
                    ? isViewing
                      ? "Votre choix — affiché"
                      : "Votre choix — cliquez pour afficher"
                    : isViewing
                      ? "Consulté — pas votre choix"
                      : "Cliquez pour consulter"
              }
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition",
                dim && "border-transparent bg-transparent text-slate-400 line-through",
                !dim &&
                  isViewing &&
                  "border-primary bg-white text-foreground shadow-md ring-2 ring-primary/30",
                !dim &&
                  !isViewing &&
                  "border-border/60 bg-muted/30 text-muted-foreground hover:border-primary/35 hover:bg-white/90 hover:text-foreground",
                !dim && isSelected && !isViewing && "border-emerald-500/60 bg-emerald-50/50 ring-1 ring-emerald-400/30"
              )}
              onClick={() => onTab(tab.id)}
            >
              <span className="w-full truncate text-[10px] font-semibold leading-tight">{tab.label}</span>
              {!dim ? (
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    isSelected ? "bg-emerald-600" : "bg-transparent ring-1 ring-muted-foreground/35"
                  )}
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground" aria-live="polite">
        {selectedMeta && !selectedMeta.retainable ? (
          <>
            Consulté : <span className="font-semibold text-foreground">{viewingLabel}</span>
            {" · "}
            <span className="text-slate-500">aucune option retenable</span>
          </>
        ) : choiceLabel && choiceLabel !== viewingLabel ? (
          <>
            Consulté : <span className="font-semibold text-foreground">{viewingLabel}</span>
            {" · "}
            Votre choix : <span className="font-semibold text-emerald-800">{choiceLabel}</span>
          </>
        ) : choiceLabel ? (
          <>
            Votre choix : <span className="font-semibold text-emerald-800">{choiceLabel}</span>
            {activeTab === selectedTabId ? (
              <span className="text-muted-foreground"> (affiché)</span>
            ) : null}
          </>
        ) : (
          <>
            Consulté : <span className="font-semibold text-foreground">{viewingLabel}</span>
            <span className="text-muted-foreground"> — cochez « Retenir » pour inclure un produit</span>
          </>
        )}
      </p>
    </div>
  );
}

function RespondedRetainHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <AppModalOverlay open aria-labelledby={titleId} onBackdropClick={onClose}>
      <div
        className={cn("w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl sm:mx-auto", t.modalShell)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={cn("flex items-start justify-between gap-2 border-b px-3 py-2", t.modalHeader)}>
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            Retenir un produit
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="space-y-2 px-3 py-3 text-[12px] leading-snug text-muted-foreground">
          <p>
            Cochez <strong className="text-foreground">Retenir</strong> pour inclure ce produit dans votre validation.
          </p>
          <p>
            S&apos;il existe des alternatives, consultez les onglets puis retenez celle que vous choisissez — une seule
            option par ligne.
          </p>
        </div>
        <div className="border-t border-border/60 px-3 py-2">
          <button type="button" className={uiActionBtnModalDismiss()} onClick={onClose}>
            Compris
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}

function RespondedRetainControl({
  retained,
  unavailable,
  readOnly,
  onToggle,
  layout = "inline",
}: {
  retained: boolean;
  unavailable: boolean;
  readOnly: boolean;
  onToggle: (on: boolean) => void;
  layout?: "inline" | "underThumb";
}) {
  const [helpOpen, setHelpOpen] = useState(false);
  const underThumb = layout === "underThumb";

  if (unavailable) {
    return (
      <span
        className={cn(
          "text-center text-[9px] font-semibold leading-tight text-slate-500",
          underThumb ? "w-full px-0.5" : "shrink-0 text-[10px]"
        )}
      >
        Non retenable
      </span>
    );
  }
  if (readOnly) {
    return retained ? (
      <span
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-md border border-emerald-300/80 bg-emerald-50 font-bold text-emerald-800",
          underThumb ? "w-full flex-col px-1 py-1 text-[9px]" : "shrink-0 px-2 py-0.5 text-[10px]"
        )}
      >
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-sm bg-emerald-600 text-white",
            underThumb ? "size-3 text-[8px]" : "size-3.5 text-[9px]"
          )}
          aria-hidden
        >
          ✓
        </span>
        Retenu
      </span>
    ) : null;
  }
  return (
    <>
      <div className={cn("flex items-center gap-1", underThumb && "w-full flex-col gap-0.5")}>
        <label
          className={cn(
            "inline-flex cursor-pointer items-center rounded-lg border border-border bg-background shadow-sm transition hover:bg-muted/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/30",
            underThumb
              ? "w-full flex-col justify-center gap-0.5 px-1 py-1"
              : "gap-1.5 px-2 py-1"
          )}
        >
          <input
            type="checkbox"
            checked={retained}
            onChange={(e) => onToggle(e.target.checked)}
            className={cn("shrink-0 rounded border-border accent-emerald-600", underThumb ? "size-3.5" : "size-4")}
            aria-label={retained ? "Produit retenu — cliquer pour retirer" : "Retenir ce produit dans votre validation"}
          />
          <span className={cn("font-bold text-foreground", underThumb ? "text-[9px] leading-none" : "text-[10px]")}>
            {retained ? "Retenu" : "Retenir"}
          </span>
        </label>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          className={cn(
            "inline-flex items-center justify-center rounded-full border border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            underThumb ? "size-5" : "size-6"
          )}
          aria-label="Aide — retenir un produit"
        >
          <HelpCircle className={cn("shrink-0", underThumb ? "size-3" : "size-3.5")} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
      <RespondedRetainHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
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
        "w-full min-w-0 border-b border-border/70 py-2.5 transition last:border-b-0",
        retained && !unavailable && "bg-emerald-50/40",
        unavailable && "bg-muted/15 saturate-[0.85] [&_img]:opacity-90",
        notRetained && !unavailable && !variantTabsAbove && "opacity-75"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex w-[3.85rem] shrink-0 flex-col items-stretch gap-1.5">
          <div className={RESPONDED_LINE_THUMB}>{thumbInner}</div>
          <RespondedRetainControl
            retained={retained}
            unavailable={unavailable}
            readOnly={readOnly}
            onToggle={onToggleRetain}
            layout="underThumb"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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
            <p
              className={cn(
                "line-clamp-2 text-[10px] leading-snug text-muted-foreground",
                unavailable && "opacity-90"
              )}
            >
              <span className={cn("font-semibold text-foreground/90", uiSecondaryLabel)}>
                {ajoutOfficineLabel}
              </span>
              {variant.proposalReason ? (
                <> — {variant.proposalReason}</>
              ) : (
                <span className="italic"> — motif non renseigné</span>
              )}
            </p>
          ) : null}

          <RespondedLineQtyMeta
            bucketId={bucketId}
            isAlt={variant.branch !== "principal"}
            showRequested={false}
            requestedQty={variant.requestedQty}
            expectedDate={variant.expectedDate}
          />

          <div className="flex w-full items-end justify-between gap-2 pt-0.5">
            <div className="min-w-0 shrink leading-none">
              <ProductRequestLinePrices
                unitPrice={unit}
                totalValue={showQty && total != null ? total : null}
              />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              {showQty && variant.showRequested ? (
                <span className="text-[10px] text-muted-foreground">
                  Qté demandée{" "}
                  <strong className="tabular-nums text-foreground">{variant.requestedQty}</strong>
                </span>
              ) : null}
              <div className="flex items-center justify-end gap-1.5">
                {showQty ? (
                  readOnly ? (
                    <ProductRequestLineQtyReadonly qty={selQty} />
                  ) : (
                    <ProductRequestLineQtyPicker
                      qty={selQty}
                      maxQty={variant.cap}
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
      clientComment: row.client_comment ?? "",
      pharmacistComment: alt.pharmacist_comment ?? "",
      branch: alt.id,
      cap: maxQtyAlt(row, alt),
      showProposalMotif: false,
      proposalReason: null,
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
      <li className="w-full min-w-0">
        {requestType === "prescription" && isOrdonnancePrincipal ? (
          <p className="mb-1 text-[10px] font-semibold text-muted-foreground">{PRESCRIPTION_ORDONNANCE_SOURCING_LABEL}</p>
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
    <li className="w-full min-w-0 overflow-visible border-b border-border/70 py-2 last:border-b-0">
      <div className="pb-2">
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
