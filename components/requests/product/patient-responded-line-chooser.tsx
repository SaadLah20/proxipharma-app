"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Minus, Package, Plus, X } from "lucide-react";
import {
  PRODUCT_REQUEST_LINE_THUMB,
  PriceDhInline,
  ProductRequestLineMessageButton,
} from "@/components/pharmacy/patient-demande-produits-ui";
import {
  lineConversationStripButtonClass,
  lineConversationStripLabel,
  lineConversationVisual,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";
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
    <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] leading-none text-muted-foreground">
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
  const visual = lineConversationVisual(c, p);
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
}: {
  tabs: { id: string; label: string; retainable: boolean }[];
  activeTab: string;
  onTab: (id: string) => void;
}) {
  return (
    <div
      className="mb-1.5 flex gap-0.5 overflow-x-auto overscroll-x-contain border-b border-sky-200/60 pb-0.5 [-webkit-overflow-scrolling:touch]"
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
              "shrink-0 rounded-t border-x border-t px-1.5 py-0.5 text-[9px] font-bold leading-tight transition",
              active
                ? dim
                  ? "border-slate-300 border-b-white bg-slate-50 text-slate-500"
                  : "border-sky-400 border-b-white bg-white text-sky-950"
                : dim
                  ? "border-transparent bg-transparent text-slate-400 line-through decoration-slate-400/80"
                  : "border-transparent bg-transparent text-sky-800/85 hover:bg-sky-50/90"
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

  return (
    <div
      className={cn(
        "w-full min-w-0 rounded-lg border transition",
        unavailable &&
          "border-slate-200/90 bg-slate-100/95 opacity-50 grayscale saturate-50",
        notRetained && "border-slate-200/75 bg-slate-50/70",
        retained && !unavailable && "border-sky-400/90 bg-white ring-1 ring-sky-200/60",
        !retained && !unavailable && "border-slate-200/80 bg-white"
      )}
      title={unavailable ? "Non retenable — rupture ou indisponible" : undefined}
    >
      <div className="flex items-stretch gap-2 p-2">
        <div className="relative shrink-0 self-center">
          <div className={cn(PRODUCT_REQUEST_LINE_THUMB, unavailable && "opacity-80")}>{thumbInner}</div>
          <label
            className={cn(
              "absolute -left-1 -top-1 z-10 flex size-5 items-center justify-center rounded-md bg-white shadow ring-1 ring-sky-300/90",
              unavailable ? "cursor-not-allowed opacity-40" : "cursor-pointer"
            )}
          >
            <input
              type="checkbox"
              className="size-3.5 shrink-0 rounded border-2 border-sky-500 text-sky-600 accent-sky-600 disabled:border-slate-300"
              checked={retained}
              disabled={unavailable}
              onChange={(e) => onToggleRetain(e.target.checked)}
              aria-label={
                unavailable
                  ? "Non retenable — rupture ou indisponible"
                  : retained
                    ? "Ne plus retenir cette ligne"
                    : "Retenir cette ligne"
              }
            />
          </label>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
          <div className="flex min-w-0 items-center gap-1 leading-snug">
            <span
              className={cn(
                "shrink-0 rounded px-1 py-px text-[7px] font-bold uppercase tracking-wide leading-tight",
                badgeToneClass(variant.badgeLabel),
                (unavailable || notRetained) && "opacity-70"
              )}
            >
              {variant.badgeLabel}
            </span>
            <p
              className={cn(
                "min-w-0 flex-1 truncate text-[12px] font-semibold leading-snug",
                unavailable ? "text-muted-foreground" : "text-foreground",
                notRetained && "text-muted-foreground line-through decoration-slate-400/90"
              )}
              title={variant.productName}
            >
              {variant.productName}
            </p>
          </div>

          {variant.showProposalMotif ? (
            <p
              className={cn(
                "text-[9px] leading-snug",
                unavailable || notRetained ? "text-muted-foreground opacity-80" : "text-violet-900"
              )}
            >
              {variant.proposalReason ? (
                <>
                  <span className="font-semibold text-violet-800">Motif · </span>
                  <span className="line-clamp-2">{variant.proposalReason}</span>
                </>
              ) : (
                <span className="italic text-muted-foreground">Motif non renseigné par l&apos;officine</span>
              )}
            </p>
          ) : null}

          <div className={cn((unavailable || notRetained) && "opacity-80")}>
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
              "flex min-w-0 items-center justify-between gap-1.5 leading-none",
              (unavailable || notRetained) && "opacity-75"
            )}
          >
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0 text-[10px]">
              <span className="whitespace-nowrap text-muted-foreground">
                PU{" "}
                {unit != null ? (
                  <PriceDhInline
                    value={unit}
                    amountClassName="text-[11px] font-bold text-foreground"
                    suffixClassName="text-[8px]"
                  />
                ) : (
                  <strong className="text-foreground">—</strong>
                )}
              </span>
              {showQty && total != null ? (
                <span className="whitespace-nowrap text-[9px] text-muted-foreground">
                  Tot{" "}
                  <PriceDhInline value={total} amountClassName="font-semibold" suffixClassName="text-[8px]" />
                </span>
              ) : null}
            </p>

            <div className="flex shrink-0 items-center gap-1">
              {showQty ? (
                <div className="flex items-center gap-0.5" role="group" aria-label="Quantité">
                  <button
                    type="button"
                    aria-label="Diminuer la quantité"
                    disabled={selQty <= 1}
                    className="rounded border border-border/80 bg-card p-0.5 hover:bg-muted/40 disabled:opacity-40"
                    onClick={onDecQty}
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-4 text-center text-xs font-semibold tabular-nums">{selQty}</span>
                  <button
                    type="button"
                    aria-label="Augmenter la quantité"
                    disabled={selQty >= variant.cap}
                    className="rounded border border-border/80 bg-card p-0.5 hover:bg-muted/40 disabled:opacity-40"
                    onClick={onIncQty}
                  >
                    <Plus size={12} />
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


  const initialTab =
    selState.branch !== null && selState.branch !== "principal"
      ? selState.branch
      : "principal";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (selState.branch === null) return;
    if (selState.branch === "principal") setActiveTab("principal");
    else if (altList.some((a) => a.id === selState.branch)) setActiveTab(selState.branch);
  }, [selState.branch, altList]);

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
    setActiveTab(tabId);
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
    <li className="w-full min-w-0 rounded-lg border border-sky-200/70 bg-sky-50/25 p-1.5">
      <RespondedVariantTabs
        tabs={variants.map((v) => ({
          id: v.tabId,
          label: v.tabLabel,
          retainable: v.cap > 0,
        }))}
        activeTab={activeTab}
        onTab={onTab}
      />
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
      />
    </li>
  );
}
