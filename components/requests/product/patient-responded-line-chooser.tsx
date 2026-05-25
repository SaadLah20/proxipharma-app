"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Ban, Minus, Package, Plus, X } from "lucide-react";
import {
  PriceDhInline,
  ProductRequestLineMessageButton,
} from "@/components/pharmacy/patient-demande-produits-ui";

/** Vignette répondue ~10 % plus grande que le panier (56px → ~62px). */
const RESPONDED_LINE_THUMB =
  "box-border size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import { availabilityStatusUi } from "@/lib/pharmacist-availability-ui";
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
import type { ActionItemAltRow, ActionItemRow, LineBranch, LineSelState } from "@/components/requests/product/patient-product-request-actions";

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

function branchFromTab(tab: string): LineBranch {
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

function badgeToneClass(label: string): string {
  if (label === "Alternative") return "bg-teal-700 text-white";
  if (label === "Ta demande") return "bg-sky-700 text-white";
  if (label === "Ordonnance") return "bg-amber-700 text-white";
  return "bg-violet-700 text-white";
}

/** Date de réception (produit à commander). */
function RespondedReceptionBadgeFr({ dateYmd }: { dateYmd: string }) {
  return (
    <span className="inline-flex max-w-full shrink-0 items-center rounded border border-amber-500/70 bg-amber-100 px-1 py-px text-[8px] font-bold leading-tight text-amber-950">
      Réc. {formatDateShortFr(dateYmd)}
    </span>
  );
}

function RespondedLineQtyMeta({
  showRequested,
  requestedQty,
  stockQty,
  availabilityStatus,
  expectedDate,
  requestType,
  isProposedLine,
}: {
  showRequested: boolean;
  requestedQty: number;
  stockQty: number | null;
  availabilityStatus: string | null;
  expectedDate: string | null;
  requestType: string;
  isProposedLine: boolean;
}) {
  let inferredKey = availabilityStatus ?? "available";
  if (showRequested && stockQty != null) {
    try {
      inferredKey = inferAvailabilityStatusFromQty({
        status: availabilityStatus ?? "available",
        availableQty: stockQty,
        requestedQty,
        isProposedLine:
          (requestType === "product_request" && isProposedLine) || requestType === "free_consultation",
      });
    } catch {
      inferredKey = availabilityStatus ?? "available";
    }
  }
  const availUi = availabilityStatusUi(inferredKey);
  const AvailIcon = availUi.Icon;

  return (
    <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] leading-none text-muted-foreground">
      {showRequested ? (
        <span className="whitespace-nowrap">
          Dem. <strong className="tabular-nums text-foreground">{requestedQty}</strong>
        </span>
      ) : null}
      {stockQty != null ? (
        <span className="whitespace-nowrap">
          Stk <strong className="tabular-nums text-foreground">{stockQty}</strong>
        </span>
      ) : null}
      {availabilityStatus ? (
        <span
          className={cn(
            "inline-flex max-w-[9.5rem] min-w-0 items-center gap-0.5 rounded-full px-1 py-px text-[8px] font-semibold leading-tight ring-1",
            availUi.badgeClass
          )}
          title={availUi.label}
        >
          <AvailIcon className="size-2 shrink-0" aria-hidden />
          <span className="truncate">{availUi.label}</span>
        </span>
      ) : null}
      {availabilityStatus === "to_order" && expectedDate ? (
        <RespondedReceptionBadgeFr dateYmd={expectedDate} />
      ) : null}
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
  const hasNotes = Boolean(c || p);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <ProductRequestLineMessageButton
        hasComment={hasNotes}
        onClick={() => setOpen(true)}
        className="px-1.5 py-0.5 text-[9px]"
      />
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[1px] sm:items-center"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={cn("max-h-[min(80vh,20rem)] w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl", t.modalShell)}
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
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
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
  onTab,
  className,
}: {
  tabs: { id: string; label: string; retainable: boolean }[];
  activeTab: string;
  onTab: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch]",
        className
      )}
      role="tablist"
      aria-label="Options pour ce produit"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        const dim = !tab.retainable;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            title={dim ? "Non retenable — rupture ou indisponible" : undefined}
            className={cn(
              "shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold leading-tight shadow-sm transition",
              active
                ? dim
                  ? "border-slate-300 bg-slate-100 text-slate-600 ring-1 ring-slate-200/90"
                  : "border-sky-500 bg-white text-sky-950 ring-2 ring-sky-300/70"
                : dim
                  ? "border-slate-200/90 bg-slate-50/90 text-slate-500 line-through decoration-slate-400/80"
                  : "border-sky-300/80 bg-sky-100/90 text-sky-900 hover:border-sky-400 hover:bg-white"
            )}
            onClick={() => onTab(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function RespondedLineBlock({
  variant,
  retained,
  selQty,
  onToggleRetain,
  onDecQty,
  onIncQty,
  onPhotoPreview,
  requestType,
  isProposedLine,
  variantTabsAbove = false,
}: {
  variant: VariantData;
  retained: boolean;
  selQty: number;
  onToggleRetain: (on: boolean) => void;
  onDecQty: () => void;
  onIncQty: () => void;
  onPhotoPreview?: (url: string, title: string) => void;
  requestType: string;
  isProposedLine: boolean;
  /** Onglets Ta demande / Alternative au-dessus — case un peu plus basse pour ne pas gêner. */
  variantTabsAbove?: boolean;
}) {
  const unavailable = variant.cap < 1;
  const notRetained = !retained && !unavailable;
  const showQty = retained && !unavailable;
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
        "relative w-full min-w-0 overflow-visible rounded-lg border transition",
        unavailable &&
          "border-slate-300/85 bg-slate-50/95 saturate-[0.72] [&_img]:opacity-90",
        notRetained && !unavailable && "border-slate-200/75 bg-slate-50/75",
        retained && !unavailable && !isProposedBlock && "border-sky-400/90 bg-white ring-1 ring-sky-200/60",
        retained && !unavailable && isProposedBlock && "border-violet-300/80 bg-white ring-1 ring-violet-200/55",
        !retained && !unavailable && !isProposedBlock && "border-slate-200/80 bg-white",
        !retained && !unavailable && isProposedBlock && "border-violet-200/70 bg-violet-50/25"
      )}
      title={unavailable ? "Non retenable — rupture ou indisponible" : undefined}
    >
      {unavailable ? (
        <span
          className={cn(
            "absolute -left-2 z-20 flex size-8 items-center justify-center rounded-md bg-slate-100 shadow ring-1 ring-slate-300/90",
            variantTabsAbove ? "top-1.5" : "-top-2"
          )}
          role="img"
          aria-label="Non retenable — rupture ou indisponible"
        >
          <Ban className="size-4 text-slate-500" strokeWidth={2.25} aria-hidden />
        </span>
      ) : (
        <label
          className={cn(
            "absolute -left-2 z-20 flex size-8 touch-manipulation cursor-pointer items-center justify-center rounded-md bg-white shadow ring-1 ring-sky-400/85 active:bg-sky-50",
            variantTabsAbove ? "top-1.5" : "-top-2"
          )}
        >
          <input
            type="checkbox"
            className="size-4 shrink-0 rounded border-2 border-sky-600 text-sky-600 accent-sky-600"
            checked={retained}
            onChange={(e) => onToggleRetain(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            aria-label={retained ? "Ne plus retenir cette ligne" : "Retenir cette ligne"}
          />
        </label>
      )}
      <div className="flex items-stretch gap-2.5 p-2.5">
        <div className={cn(RESPONDED_LINE_THUMB, "shrink-0 self-center", unavailable && "opacity-95")}>
          {thumbInner}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden leading-none">
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide leading-tight",
                badgeToneClass(variant.badgeLabel),
                unavailable && "opacity-90",
                notRetained && !unavailable && "opacity-80"
              )}
            >
              {variant.badgeLabel}
            </span>
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-[13px] font-semibold leading-none",
                unavailable ? "text-slate-600" : "text-foreground",
                notRetained && !unavailable && "text-muted-foreground line-through decoration-slate-400/90"
              )}
              title={variant.productName}
            >
              {variant.productName}
            </p>
          </div>

          {isProposedBlock ? (
            <p
              className={cn(
                "line-clamp-3 rounded-md px-2 py-1 text-[10px] leading-snug",
                unavailable
                  ? "bg-slate-100/90 text-slate-600 ring-1 ring-slate-200/80"
                  : notRetained
                    ? "bg-violet-50/60 text-violet-900/70 ring-1 ring-violet-100/80"
                    : "bg-violet-50/95 text-violet-950 ring-1 ring-violet-200/60"
              )}
            >
              {variant.proposalReason ? (
                <>
                  <span className="font-semibold text-violet-800">Motif · </span>
                  {variant.proposalReason}
                </>
              ) : (
                <span className="italic text-violet-800/80">Motif non renseigné par l&apos;officine</span>
              )}
            </p>
          ) : null}

          <div className={cn(notRetained && !unavailable && "opacity-85")}>
            <RespondedLineQtyMeta
              showRequested={variant.showRequested}
              requestedQty={variant.requestedQty}
              stockQty={variant.stockQty}
              availabilityStatus={variant.availabilityStatus}
              expectedDate={variant.expectedDate}
              requestType={requestType}
              isProposedLine={isProposedLine}
            />
          </div>

          <div
            className={cn(
              "flex min-w-0 items-center gap-3 leading-none",
              unavailable && "opacity-95",
              notRetained && !unavailable && "opacity-85"
            )}
          >
            <div className="flex shrink-0 flex-col gap-1 leading-none text-muted-foreground">
              <div className="flex items-baseline gap-1.5">
                <span className="w-[1.4rem] shrink-0 text-[11px] leading-none">PU</span>
                <span className="whitespace-nowrap">
                  {unit != null ? (
                    <PriceDhInline
                      value={unit}
                      amountClassName="text-xs font-bold leading-none text-foreground"
                      suffixClassName="text-[9px] leading-none"
                    />
                  ) : (
                    <strong className="text-xs leading-none text-foreground">—</strong>
                  )}
                </span>
              </div>
              {showQty && total != null ? (
                <div className="flex items-baseline gap-1.5">
                  <span className="w-[1.4rem] shrink-0 text-[8px] font-medium leading-none">Tot</span>
                  <span className="whitespace-nowrap text-[8px] font-medium text-muted-foreground/90">
                    <PriceDhInline
                      value={total}
                      amountClassName="text-[9px] font-semibold leading-none text-muted-foreground"
                      suffixClassName="text-[7px] leading-none"
                    />
                  </span>
                </div>
              ) : null}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {showQty ? (
                <div className="flex items-center gap-0.5" role="group" aria-label="Quantité">
                  <button
                    type="button"
                    aria-label="Diminuer la quantité"
                    disabled={selQty <= 1}
                    className="rounded border border-border/80 bg-card p-1 hover:bg-muted/40 disabled:opacity-40"
                    onClick={onDecQty}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">{selQty}</span>
                  <button
                    type="button"
                    aria-label="Augmenter la quantité"
                    disabled={selQty >= variant.cap}
                    className="rounded border border-border/80 bg-card p-1 hover:bg-muted/40 disabled:opacity-40"
                    onClick={onIncQty}
                  >
                    <Plus size={14} />
                  </button>
                </div>
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

export type RespondedChooserProps = {
  row: ActionItemRow;
  selState: LineSelState;
  setLineBranch: (itemId: string, branch: LineBranch) => void;
  setLineQty: (itemId: string, qty: number) => void;
  toggleLineRetention: (itemId: string, on: boolean, branchWhenOn: LineBranch) => void;
  onPhotoPreview?: (url: string, title: string) => void;
  pharmacistProposedBadgeLabel: string;
  requestType: string;
  supplyAmendmentBundles: { amendments: unknown }[];
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

  const activeTab =
    selState.branch === null
      ? browseTab
      : selState.branch === "principal"
        ? "principal"
        : selState.branch;

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
      unitPrice: row.unit_price != null ? Number(row.unit_price) : null,
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
      tabLabel: `Alternative ${index + 1}`,
      badgeLabel: "Alternative",
      productName: altProd?.name ?? "Alternative",
      photoUrl: resolvePublicMediaUrl(altProd?.photo_url ?? null),
      showRequested: false,
      requestedQty: 0,
      stockQty,
      unitPrice: alt.unit_price != null ? Number(alt.unit_price) : null,
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
  ]);

  const activeVariant = variants.find((v) => v.tabId === activeTab) ?? variants[0]!;
  const activeBranch = branchFromTab(activeTab);
  const retainedForTab = selState.branch === activeBranch;

  const onTab = (tabId: string) => {
    setBrowseTab(tabId);
    if (selState.branch !== null) {
      const branch = branchFromTab(tabId);
      const cap = maxQtyForBranch(row, branch, altList);
      if (cap > 0) setLineBranch(row.id, branch);
      else setLineBranch(row.id, null);
    }
  };

  if (!hasAlts) {
    const v = buildPrincipalVariant();
    return (
      <li className="w-full min-w-0">
        {requestType === "prescription" && isOrdonnancePrincipal ? (
          <p className="mb-1 text-[10px] font-semibold text-amber-900">{PRESCRIPTION_ORDONNANCE_SOURCING_LABEL}</p>
        ) : null}
        <RespondedLineBlock
          variant={v}
          retained={selState.branch === "principal"}
          selQty={selState.qty}
          onToggleRetain={(on) => toggleLineRetention(row.id, on, "principal")}
          onDecQty={() => setLineQty(row.id, selState.qty - 1)}
          onIncQty={() => setLineQty(row.id, selState.qty + 1)}
          onPhotoPreview={onPhotoPreview}
          requestType={requestType}
          isProposedLine={isProposedLine}
        />
      </li>
    );
  }

  return (
    <li className="w-full min-w-0 overflow-visible rounded-xl border border-sky-300/75 bg-gradient-to-b from-sky-50/55 via-sky-50/20 to-white ring-1 ring-sky-200/50">
      <div className="px-2 pt-2 pb-1">
        <p className="mb-1.5 px-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-800/85">
          Choisir une option
        </p>
        <RespondedVariantTabs
          tabs={variants.map((v) => ({
            id: v.tabId,
            label: v.tabLabel,
            retainable: v.cap > 0,
          }))}
          activeTab={activeTab}
          onTab={onTab}
        />
      </div>
      <div className="px-2 pb-2">
        <RespondedLineBlock
          variant={activeVariant}
          retained={retainedForTab}
          selQty={selState.qty}
          onToggleRetain={(on) => toggleLineRetention(row.id, on, activeBranch)}
          onDecQty={() => setLineQty(row.id, selState.qty - 1)}
          onIncQty={() => setLineQty(row.id, selState.qty + 1)}
          onPhotoPreview={onPhotoPreview}
          requestType={requestType}
          isProposedLine={isProposedLine && activeTab === "principal"}
          variantTabsAbove
        />
      </div>
    </li>
  );
}
