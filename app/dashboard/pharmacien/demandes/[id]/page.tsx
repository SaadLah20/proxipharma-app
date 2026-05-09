"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  CalendarClock,
  ChevronDown,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  User,
} from "lucide-react";
import { PharmacistLineReactControl } from "@/components/pharmacist/pharmacist-line-react-control";
import { availabilityStatusUi } from "@/lib/pharmacist-availability-ui";
import { supabase } from "@/lib/supabase";
import {
  formatDateShortFr,
  formatDateTimeShort24hFr,
  formatDateShortCasablancaWithTime24hFr,
  formatPlannedVisitFr,
} from "@/lib/datetime-fr";
import {
  PHARMACIST_AVAILABILITY_OPTIONS,
  PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS,
  PHARMACIST_SUPPLY_POST_CONFIRM_AVAILABILITY_OPTIONS,
  inferAvailabilityStatusFromQty,
} from "@/lib/pharmacist-availability";
import { SUPPLY_AMEND_CHANNEL_OPTIONS } from "@/lib/supply-amendment-channels";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  historyActorLabel,
  pharmacistRequestIsClosedSuccess,
  pharmacistRequestIsHardStopped,
  requestStatusFr,
} from "@/lib/request-display";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { one } from "@/lib/embed";
import { pphLabel } from "@/lib/product-price";
import { CompactCard, CompactCardBody, CompactCardHeader, PageShell } from "@/components/ui/compact-shell";
import { InfoHint } from "@/components/ui/info-hint";
import {
  bucketPatientValidatedLinesThreeWays,
  validatedBranchUnitPriceMad,
  validatedProductLabel,
  validatedQtyForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import { buildPatientLineTimelineFr } from "@/lib/build-patient-line-timeline-fr";
import { LineHistoryModalFr } from "@/components/requests/line-history-modal-fr";
import { PharmacistSupplyCompactLine } from "@/components/pharmacist/pharmacist-supply-compact-line";
import {
  stringifyPharmaConfirmAudit,
  type PharmaConfirmAdjustmentAudit,
  type PharmaConfirmAdjustmentLine,
} from "@/lib/patient-request-history-audit";
import { type SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import {
  dispatchRequestDetailRefresh,
  REQUEST_DETAIL_REFRESH_EVENT,
  type RequestDetailRefreshDetail,
} from "@/lib/request-detail-refresh-bus";
import {
  PharmacistSupplyAmendmentConfirmModal,
  type SupplyConfirmBlock,
} from "@/components/pharmacist/pharmacist-supply-amendment-confirm-modal";

type RequestRow = {
  id: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  patient_id: string;
  created_at: string;
  submitted_at: string | null;
  responded_at: string | null;
  confirmed_at: string | null;
  updated_at: string;
  patient_planned_visit_date: string | null;
  patient_planned_visit_time: string | null;
  request_public_ref?: string | null;
  product_requests: { patient_note: string | null } | { patient_note: string | null }[] | null;
};

type ProdEmbedDb = { name: string; price_pph?: number | null; photo_url?: string | null };

type AltRowDb = {
  id: string;
  rank: number;
  product_id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
};

type ItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  client_comment: string | null;
  line_source: string | null;
  pharmacist_proposal_reason: string | null;
  expected_availability_date: string | null;
  counter_outcome: string;
  counter_cancel_reason: string | null;
  counter_cancel_detail: string | null;
  is_selected_by_patient: boolean;
  selected_qty: number | null;
  patient_chosen_alternative_id?: string | null;
  post_confirm_fulfillment?: string | null;
  withdrawn_after_confirm?: boolean | null;
  updated_at: string;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
  request_item_alternatives: AltRowDb | AltRowDb[] | null;
};

type ItemDraft = {
  availability_status: string;
  available_qty: string;
  unit_price: string;
  pharmacist_comment: string;
  expected_availability_date: string;
  withdrawn_after_confirm: boolean;
  /** Quantité retenue avec le patient (lignes sélectionnées, après validation). */
  selected_qty_str: string;
  /** Brouillon jusqu’à « Enregistrer les modifications ». */
  fulfillment_draft: "unset" | "reserved" | "ordered";
  counter_outcome_draft: string;
  counter_cancel_reason_draft: string | null;
  counter_cancel_detail_draft: string | null;
};

type Draft = Record<string, ItemDraft>;

type ProductCatalogHit = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url?: string | null;
  price_pph?: number | null;
};

type PatientBrief = {
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref: string | null;
};

function patientHeadingName(profile: PatientBrief | null, patientId: string): string {
  const n = profile?.full_name?.trim();
  if (n) return n;
  return `Patient #${formatShortId(patientId)}`;
}

function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return `tel:${digits}`;
  return `tel:${raw.trim()}`;
}

function whatsappHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

function smsHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `sms:${digits}`;
}

function normalizeAlts(raw: ItemRow["request_item_alternatives"]): AltRowDb[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [...list].sort((a, b) => a.rank - b.rank);
}

/** Branche retenue par le patient après réponse (principal ou alternative choisie). */
function effectiveAvailForPharmaRow(row: ItemRow): string | null {
  const alts = normalizeAlts(row.request_item_alternatives);
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (chosen) {
    const a = alts.find((x) => x.id === chosen);
    return a?.availability_status ?? row.availability_status ?? null;
  }
  return row.availability_status ?? null;
}

function clampFulfillmentDraftToInferred(
  fd: "unset" | "reserved" | "ordered",
  inferredAvail: string
): "unset" | "reserved" | "ordered" {
  let x = fd;
  if (x === "reserved" && !["available", "partially_available"].includes(inferredAvail)) x = "unset";
  if (x === "ordered" && inferredAvail !== "to_order") x = "unset";
  return x;
}

function fulfillmentDraftFromRow(row: ItemRow): "unset" | "reserved" | "ordered" {
  const p = row.post_confirm_fulfillment ?? "unset";
  if (p === "reserved") return "reserved";
  if (p === "ordered" || p === "arrived_reserved") return "ordered";
  return "unset";
}

function effectiveAvailSupplyDraft(row: ItemRow, f: ItemDraft): string | null {
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (chosen) return effectiveAvailForPharmaRow(row);
  return inferAvailabilityStatusFromQty({
    status: f.availability_status,
    availableQty: Number(f.available_qty || "0"),
    requestedQty: row.requested_qty,
    isProposedLine: row.line_source === "pharmacist_proposed",
  });
}

function effectiveEtaSupplyDraft(row: ItemRow, f: ItemDraft): string | null {
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (chosen) {
    const alts = normalizeAlts(row.request_item_alternatives);
    const a = alts.find((x) => x.id === chosen);
    return a?.expected_availability_date?.trim() || row.expected_availability_date?.trim() || null;
  }
  if (effectiveAvailSupplyDraft(row, f) === "to_order") {
    const d = f.expected_availability_date?.trim();
    return d && d.length > 0 ? d : null;
  }
  return row.expected_availability_date?.trim() || null;
}

function virtualizeItemsForSupplyBuckets(rows: ItemRow[], d: Draft): ItemRow[] {
  return rows.map((row) => {
    const f = d[row.id];
    if (!f) return row;
    if (row.patient_chosen_alternative_id) return row;
    const inf = effectiveAvailSupplyDraft(row, f);
    if (inf === row.availability_status) return row;
    return { ...row, availability_status: inf };
  });
}

function nextAltRank(existing: AltRowDb[]): number | null {
  const used = new Set(existing.map((a) => a.rank));
  for (let r = 1; r <= 3; r += 1) {
    if (!used.has(r)) return r;
  }
  return null;
}

const LOCAL_PROPOSED_ID_PREFIX = "__pp_local:";
const LOCAL_ALT_ID_PREFIX = "__alt_local:";

function isLocalProposedItemId(rowId: string) {
  return rowId.startsWith(LOCAL_PROPOSED_ID_PREFIX);
}

function isLocalAltId(altId: string) {
  return altId.startsWith(LOCAL_ALT_ID_PREFIX);
}

function newLocalProposedId() {
  return `${LOCAL_PROPOSED_ID_PREFIX}${crypto.randomUUID()}`;
}

function newLocalAltId() {
  return `${LOCAL_ALT_ID_PREFIX}${crypto.randomUUID()}`;
}

function buildPharmacistSupplySections(rows: ItemRow[]): { title: string; rows: ItemRow[] }[] {
  const b = bucketPatientValidatedLinesThreeWays(rows);
  const sections: { title: string; rows: ItemRow[] }[] = [
    { title: `À réserver (validé · ${b.dispoOfficine.length})`, rows: b.dispoOfficine },
    { title: `À commander (validé · ${b.aCommander.length})`, rows: b.aCommander },
    { title: `Hors bloc principal (${b.horsPerimetre.length})`, rows: b.horsPerimetre },
    { title: `Écart après validation (${b.retireesApresValidation.length})`, rows: b.retireesApresValidation },
  ];
  return sections.filter((s) => s.rows.length > 0);
}

function flattenPharmacistSupplyListEntries(rows: ItemRow[]): { header: string | null; row: ItemRow }[] {
  const secs = buildPharmacistSupplySections(rows);
  const out: { header: string | null; row: ItemRow }[] = [];
  for (const s of secs) {
    s.rows.forEach((row, i) => {
      out.push({ header: i === 0 ? s.title : null, row });
    });
  }
  return out;
}

type PendingAlternativeEntry = {
  localAltId: string;
  parentItemId: string;
  rank: number;
  product_id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
};

function pendingAltsAsRankedDb(prev: PendingAlternativeEntry[], parentId: string): AltRowDb[] {
  return [...prev]
    .filter((p) => p.parentItemId === parentId)
    .sort((a, b) => a.rank - b.rank)
    .map(
      (e): AltRowDb => ({
        id: e.localAltId,
        rank: e.rank,
        product_id: e.product_id,
        availability_status: e.availability_status,
        available_qty: e.available_qty,
        unit_price: e.unit_price,
        pharmacist_comment: e.pharmacist_comment,
        expected_availability_date: e.expected_availability_date,
        products: e.products,
      })
    );
}

/** Alternatives encore non persistées, fusion de la ligne vue écran. */
function mergePendingAlternativesOntoRows(rows: ItemRow[], pendingAlternatives: PendingAlternativeEntry[]): ItemRow[] {
  return rows.map((row) => {
    const extra = pendingAltsAsRankedDb(pendingAlternatives, row.id);
    if (extra.length === 0) return row;
    const existing = normalizeAlts(row.request_item_alternatives);
    const merged = [...existing, ...extra].sort((a, b) => a.rank - b.rank);
    return { ...row, request_item_alternatives: merged };
  });
}

function counterOutcomeLabelPharmacien(outcome: string, cancelReason: string | null = null): string {
  if (outcome === "cancelled_at_counter") {
    if (cancelReason === "client_request") return "Annulé à la demande du client";
    if (cancelReason === "pharmacy_unable") return "Annulé par la pharmacie";
    return "Annulé";
  }
  switch (outcome) {
    case "unset":
      return "En attente";
    case "picked_up":
      return "Récupéré";
    case "deferred_next_visit":
      return "En attente";
    default:
      return counterOutcomeFr[outcome] ?? outcome;
  }
}

/** Comptoir figé en base (ne plus modifier via le brouillon). */
function counterOutcomeFrozenInDb(row: ItemRow): boolean {
  const co = row.counter_outcome ?? "unset";
  return co === "picked_up" || co === "cancelled_at_counter";
}

/** Sélecteur comptoir : seulement en attente / récupéré (legacy « plus tard » → en attente). */
function counterSelectKeyNormalized(row: ItemRow, f: ItemDraft): "picked_up" | "unset" {
  if (counterOutcomeFrozenInDb(row)) {
    return row.counter_outcome === "picked_up" ? "picked_up" : "unset";
  }
  const raw = f.counter_outcome_draft ?? row.counter_outcome ?? "unset";
  if (raw === "picked_up") return "picked_up";
  return "unset";
}

function normalizeCounterOutcomeForPersist(row: ItemRow, f: ItemDraft): { outcome: string; cancelReason: null; cancelDetail: null } | null {
  if (counterOutcomeFrozenInDb(row)) return null;
  const raw = f.counter_outcome_draft ?? row.counter_outcome ?? "unset";
  const outcome = raw === "picked_up" ? "picked_up" : "unset";
  return { outcome, cancelReason: null, cancelDetail: null };
}

/** Plafond technique saisie stock pour les lignes proposées par l’officine (pas de lien avec la « quantité demandée » initiale). */
const PHARMACIST_PROPOSED_STOCK_CEILING = 9999;

function buildItemUpdatePayload(f: ItemDraft, row: ItemRow) {
  const availQty = Number(f.available_qty);
  const isProposed = row.line_source === "pharmacist_proposed";
  if (Number.isNaN(availQty) || availQty < 0) {
    throw new Error("Quantité disponible invalide sur une ligne.");
  }
  if (isProposed && availQty < 1) {
    throw new Error("Pour une proposition officine, la quantité en stock doit être au moins 1.");
  }
  const price = f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
  if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
    throw new Error("Prix unitaire invalide.");
  }
  const inferred = inferAvailabilityStatusFromQty({
    status: f.availability_status,
    availableQty: availQty,
    requestedQty: row.requested_qty,
    isProposedLine: isProposed,
  });
  return {
    availability_status: inferred,
    available_qty: availQty,
    unit_price: price,
    pharmacist_comment: f.pharmacist_comment.trim() || null,
    expected_availability_date: f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
  };
}

function buildPharmaConfirmAdjustmentAudit(items: ItemRow[], draft: Draft): PharmaConfirmAdjustmentAudit | null {
  const lines: PharmaConfirmAdjustmentLine[] = [];
  for (const row of items) {
    const f = draft[row.id];
    if (!f) continue;
    const newQtyNum = Number(f.available_qty);
    const oldQty = row.available_qty;
    const newAvail = f.availability_status;
    const oldAvail = row.availability_status ?? null;
    if (oldQty === newQtyNum && oldAvail === newAvail) continue;
    const validatedQty = Math.min(10, Math.max(1, Number(row.selected_qty ?? row.requested_qty) || 1));
    lines.push({
      productName: one(row.products)?.name ?? "Produit",
      validatedQty,
      oldAvailQty: oldQty,
      newAvailQty: Number.isFinite(newQtyNum) ? newQtyNum : oldQty ?? 0,
      oldAvailabilityStatus: oldAvail,
      newAvailabilityStatus: newAvail,
      oldAvailLabelFr: oldAvail ? availabilityStatusFr[oldAvail] ?? oldAvail : null,
      newAvailLabelFr: availabilityStatusFr[newAvail] ?? newAvail,
    });
  }
  if (lines.length === 0) return null;
  return { v: 1, kind: "pharma_adjust_confirmed", lines };
}

/** État du formulaire officine depuis une ligne base (chargement ou nouvelle ligne). */
function buildItemDraftFromRow(row: ItemRow): ItemDraft {
  const catalogPph = one(row.products)?.price_pph;
  /* `partially_available` est dérivé automatiquement (qté < demandée). On affiche le brouillon en `available` :
     il sera réinféré au save si la quantité reste < demandée. */
  const rawStatus = row.availability_status ?? "available";
  const draftStatus = rawStatus === "partially_available" ? "available" : rawStatus;
  const reqCap = Math.max(0, Math.floor(Number(row.requested_qty)) || 0);
  let availNum = row.available_qty != null ? Number(row.available_qty) : Number(row.requested_qty);
  if (!Number.isFinite(availNum)) availNum = reqCap;
  availNum = Math.max(0, Math.min(reqCap, Math.floor(availNum)));
  const selBase = Math.min(10, Math.max(1, Number(row.selected_qty ?? row.requested_qty) || 1));
  return {
    availability_status: draftStatus,
    available_qty: String(availNum),
    unit_price:
      row.unit_price != null ? String(row.unit_price) : catalogPph != null ? String(catalogPph) : "",
    pharmacist_comment: row.pharmacist_comment ?? "",
    expected_availability_date: row.expected_availability_date ?? "",
    withdrawn_after_confirm: Boolean(row.withdrawn_after_confirm),
    selected_qty_str: String(selBase),
    fulfillment_draft: fulfillmentDraftFromRow(row),
    counter_outcome_draft: row.counter_outcome ?? "unset",
    counter_cancel_reason_draft: row.counter_cancel_reason ?? null,
    counter_cancel_detail_draft: row.counter_cancel_detail ?? null,
  };
}

function buildSupplyStructuralAmends(items: ItemRow[], draft: Draft): SupplyAmendmentEntryJson[] {
  const out: SupplyAmendmentEntryJson[] = [];
  for (const row of items) {
    const f = draft[row.id];
    if (!f) continue;
    const nm = one(row.products)?.name ?? "Produit";
    if (Boolean(f.withdrawn_after_confirm)) {
      continue;
    }
    const draftSel = Math.min(10, Math.max(1, Number(f.selected_qty_str) || 1));
    const rowSel = Math.min(10, Math.max(1, Number(row.selected_qty ?? row.requested_qty) || 1));
    if (row.is_selected_by_patient && draftSel !== rowSel) {
      out.push({
        kind: "validated_qty_change",
        request_item_id: row.id,
        summary: `${nm} — quantité validée ${rowSel} → ${draftSel}`,
        detail: `${nm} : quantité retenue avec le patient ${rowSel} → ${draftSel}.`,
      });
    }
    let payload: ReturnType<typeof buildItemUpdatePayload>;
    try {
      payload = buildItemUpdatePayload(f, row);
    } catch {
      continue;
    }
    const qtyChanged = (row.available_qty ?? null) !== (payload.available_qty ?? null);
    const avChanged = (row.availability_status ?? null) !== (payload.availability_status ?? null);
    const priceEq =
      (row.unit_price == null && payload.unit_price == null) ||
      (row.unit_price != null &&
        payload.unit_price != null &&
        Number(row.unit_price) === Number(payload.unit_price));
    const priceChanged = !priceEq;
    const ccRow = (row.pharmacist_comment ?? "").trim();
    const ccNew = (payload.pharmacist_comment ?? "").trim();
    const ccChanged = ccRow !== ccNew;
    const dRow = (row.expected_availability_date ?? "").trim();
    const dNew = (payload.expected_availability_date ?? "").trim().slice(0, 10);
    const dateChanged = dRow !== dNew;
    if (qtyChanged || avChanged || priceChanged || ccChanged || dateChanged) {
      const bits: string[] = [];
      if (avChanged) {
        bits.push(
          `disponibilité « ${availabilityStatusFr[row.availability_status ?? ""] ?? row.availability_status ?? "—"} » → « ${availabilityStatusFr[payload.availability_status] ?? payload.availability_status} »`
        );
      }
      if (qtyChanged) bits.push(`quantité officine ${row.available_qty ?? "—"} → ${payload.available_qty}`);
      if (priceChanged) bits.push("prix unitaire");
      if (dateChanged) bits.push("date de disponibilité");
      if (ccChanged) bits.push("commentaire officine");
      out.push({
        kind: "line_adjust_supply",
        request_item_id: row.id,
        summary: `${nm} — ${bits.join(", ")}`,
        detail: bits.join(" · "),
      });
    }
  }
  return out;
}

async function logHistory(requestId: string, oldS: string | null, newS: string, reason?: string) {
  const { data: userData } = await supabase.auth.getUser();
  return supabase.from("request_status_history").insert({
    request_id: requestId,
    old_status: oldS,
    new_status: newS,
    changed_by: userData.user?.id ?? null,
    reason: reason ?? "pharmacien_ui",
  });
}

/** Liste déroulante (pas de `<select>` natif / pas de bouton Terminé sur mobile). */
function PharmacienAvailabilityDropdown({
  rowId,
  disabled,
  menuOpen,
  onOpenChange,
  draftStatus,
  requestedQty,
  availableQtyStr,
  isProposedLine,
  options,
  onPick,
}: {
  rowId: string;
  disabled: boolean;
  menuOpen: boolean;
  onOpenChange: (open: boolean) => void;
  draftStatus: string;
  requestedQty: number;
  availableQtyStr: string;
  isProposedLine: boolean;
  options: readonly { value: string; label: string }[];
  onPick: (value: string) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const qty = Number(availableQtyStr || "0");
  const q = Number.isFinite(qty) ? qty : 0;
  const inferred = inferAvailabilityStatusFromQty({
    status: draftStatus,
    availableQty: q,
    requestedQty,
    isProposedLine,
  });
  const ui = availabilityStatusUi(inferred);
  const CurIcon = ui.Icon;

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) {
      setMenuRect(null);
      return undefined;
    }
    const sync = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = typeof window !== "undefined" ? window.innerWidth : 400;
      const width = Math.max(r.width, 200);
      let left = r.left;
      if (left + width > vw - 8) {
        left = Math.max(8, vw - width - 8);
      }
      setMenuRect({
        top: r.bottom + 4,
        left,
        width,
      });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [menuOpen]);

  return (
    <div ref={anchorRef} className="relative min-w-[8.5rem] flex-1" data-pharma-avail-anchor={rowId}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          onOpenChange(!menuOpen);
        }}
        className={clsx(
          "flex h-9 w-full items-center gap-2 rounded-xl border border-input bg-background px-2 text-left text-[11px] font-semibold shadow-sm transition hover:bg-muted/35 disabled:opacity-55",
          menuOpen && "ring-2 ring-primary/25"
        )}
      >
        <CurIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{ui.label}</span>
        <ChevronDown className={clsx("size-4 shrink-0 text-muted-foreground transition-transform", menuOpen && "rotate-180")} />
      </button>
      {menuOpen && menuRect && typeof document !== "undefined"
        ? createPortal(
            <ul
              role="listbox"
              aria-label="Disponibilité"
              data-pharma-avail-menu={rowId}
              style={{
                position: "fixed",
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
                zIndex: 10050,
                maxHeight: "min(14rem, 55vh)",
              }}
              className="space-y-0.5 overflow-auto rounded-xl border border-border/90 bg-card py-1 shadow-xl ring-1 ring-black/[0.08]"
            >
              {options.map((o) => {
                const inferredOpt = inferAvailabilityStatusFromQty({
                  status: o.value,
                  availableQty: q,
                  requestedQty,
                  isProposedLine,
                });
                const oUi = availabilityStatusUi(inferredOpt);
                const OIcon = oUi.Icon;
                const selected = draftStatus === o.value;
                return (
                  <li key={o.value} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={clsx(
                        "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-medium transition",
                        selected
                          ? "bg-primary/12 text-primary"
                          : "text-foreground hover:bg-muted/65"
                      )}
                      onClick={() => {
                        onPick(o.value);
                        onOpenChange(false);
                      }}
                    >
                      <OIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}

export default function PharmacienDemandeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [altRowsOpen, setAltRowsOpen] = useState<Record<string, boolean>>({});
  const [altPickerOpenFor, setAltPickerOpenFor] = useState<string | null>(null);
  const [availabilityMenuRowId, setAvailabilityMenuRowId] = useState<string | null>(null);
  const [altQuery, setAltQuery] = useState("");
  const [altHits, setAltHits] = useState<ProductCatalogHit[]>([]);
  const [altBusyRow, setAltBusyRow] = useState<string | null>(null);
  const [counterBusyId, setCounterBusyId] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [declareTreatedBusy, setDeclareTreatedBusy] = useState(false);
  const [supplyConfirmOpen, setSupplyConfirmOpen] = useState(false);
  const [supplyConfirmBusy, setSupplyConfirmBusy] = useState(false);
  const [supplyConfirmBlocks, setSupplyConfirmBlocks] = useState<SupplyConfirmBlock[]>([]);
  const [supplyConfirmPending, setSupplyConfirmPending] = useState<
    | { kind: "unlock_modify"; rowId: string }
    | { kind: "add_line"; pick: ProductCatalogHit; reason: string; qty: number }
    | null
  >(null);
  const [lineModifyConsent, setLineModifyConsent] = useState<Record<string, { channel: string; motive: string }>>({});
  const [supplyMenuRowId, setSupplyMenuRowId] = useState<string | null>(null);
  const [pharmaHistoryRowId, setPharmaHistoryRowId] = useState<string | null>(null);
  const [supplyAmendmentBundles, setSupplyAmendmentBundles] = useState<
    { id: string; created_at: string; amendments: unknown }[]
  >([]);
  const [dossierHistoryTimeline, setDossierHistoryTimeline] = useState<
    { created_at: string; old_status: string | null; new_status: string; reason: string | null }[]
  >([]);
  const [patientProfile, setPatientProfile] = useState<PatientBrief | null>(null);
  /** Affiche téléphone / e-mail sous un bouton « Contacter » (noms longs, en-tête aéré). */
  const [patientContactOpen, setPatientContactOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyRows, setHistoryRows] = useState<
    { id: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[]
  >([]);
  const [globalComment, setGlobalComment] = useState("");
  const [initialGlobalComment, setInitialGlobalComment] = useState("");
  /** Après publication (`responded`), affichage figé jusqu'à « Modifier ». */
  const [respondedEditMode, setRespondedEditMode] = useState(false);
  /** Mise à jour immédiate du commentaire officine sur une ligne (vue « réponse publiée »). */
  const [replyPersistBusyRowId, setReplyPersistBusyRowId] = useState<string | null>(null);
  /** Lignes proposées / alternatives encore non écrites en base tant que réponse pas publiée ou enregistrée (hors `confirmed`). */
  const [pendingProposalRows, setPendingProposalRows] = useState<ItemRow[]>([]);
  const [pendingAlternatives, setPendingAlternatives] = useState<PendingAlternativeEntry[]>([]);

  const altDebounced = useMemo(() => altQuery.trim(), [altQuery]);
  const altVisibleHits = altDebounced.length < 2 ? [] : altHits;

  const [propOpen, setPropOpen] = useState(false);
  const [propQuery, setPropQuery] = useState("");
  const [propHits, setPropHits] = useState<ProductCatalogHit[]>([]);
  const [propReason, setPropReason] = useState("");
  const [propQty, setPropQty] = useState("1");
  const [propBusy, setPropBusy] = useState(false);
  const propDebounced = useMemo(() => propQuery.trim(), [propQuery]);
  const propVisibleHits = propDebounced.length < 2 ? [] : propHits;

  /** Avant première réponse : aucune ligne `pharmacist_proposed` ne doit subsister en base (anciens inserts). */
  const hideStaleServerPharmacistProposals = useMemo(
    () =>
      !!request &&
      !["confirmed", "processing", "treated"].includes(request.status) &&
      ["submitted", "in_review"].includes(request.status),
    [request]
  );

  const deferPersistOfficineAdditions = useMemo(
    () =>
      !!request &&
      !["confirmed", "processing", "treated"].includes(request.status) &&
      (["submitted", "in_review"].includes(request.status) ||
        (request.status === "responded" && respondedEditMode)),
    [request, respondedEditMode]
  );

  const displayRows = useMemo(() => {
    const baseRows = hideStaleServerPharmacistProposals
      ? items.filter((r) => r.line_source !== "pharmacist_proposed")
      : items.slice();
    const withSynthetic = [...baseRows, ...pendingProposalRows];
    return mergePendingAlternativesOntoRows(withSynthetic, pendingAlternatives);
  }, [items, hideStaleServerPharmacistProposals, pendingProposalRows, pendingAlternatives]);

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    setPatientProfile(null);
    setPatientContactOpen(false);
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace(`/auth?redirect=/dashboard/pharmacien/demandes/${id}`);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || (profile as { role: string }).role !== "pharmacien") {
      setError("Accès pharmacien uniquement.");
      setLoading(false);
      return;
    }

    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staff?.pharmacy_id) {
      setError("Pharmacie non rattachée.");
      setLoading(false);
      return;
    }

    const { data: reqRow, error: reqErr } = await supabase
      .from("requests")
      .select(
        "id,status,request_type,pharmacy_id,patient_id,created_at,submitted_at,responded_at,confirmed_at,updated_at,patient_planned_visit_date,patient_planned_visit_time,request_public_ref,product_requests(patient_note)"
      )
      .eq("id", id)
      .maybeSingle();

    if (reqErr || !reqRow) {
      setError(reqErr?.message ?? "Demande introuvable.");
      setLoading(false);
      return;
    }

    const r = reqRow as RequestRow;
    if (r.pharmacy_id !== staff.pharmacy_id) {
      setError("Cette demande n’appartient pas à ta pharmacie.");
      setLoading(false);
      return;
    }

    setRequest(r);
    if (r.status !== "responded") {
      setRespondedEditMode(false);
    }
    const { data: contactRpc, error: patErr } = await supabase.rpc("pharmacist_patient_contact_for_request", {
      p_request_id: id,
    });
    if (!patErr && contactRpc != null) {
      const rows = Array.isArray(contactRpc) ? contactRpc : [contactRpc];
      const first = rows[0] as PatientBrief | undefined;
      if (first) {
        setPatientProfile({
          full_name: first.full_name ?? null,
          whatsapp: first.whatsapp ?? null,
          email: first.email ?? null,
          patient_ref: first.patient_ref ?? null,
        });
      }
    }

    const { data: lastComment } = await supabase
      .from("request_comments")
      .select("comment_text")
      .eq("request_id", id)
      .eq("author_role", "pharmacien")
      .eq("is_internal", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const latest = (lastComment?.comment_text ?? "").trim();
    setGlobalComment(latest);
    setInitialGlobalComment(latest);

    const { data: itemsData, error: itemsErr } = await supabase
      .from("request_items")
        .select(
        "id,product_id,requested_qty,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,is_selected_by_patient,selected_qty,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,line_source,pharmacist_proposal_reason,client_comment,updated_at,products(name,price_pph,photo_url),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url))"
      )
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      setError(itemsErr.message);
      setLoading(false);
      return;
    }

    let list = (itemsData as ItemRow[]) ?? [];
    /* Nettoyer d’anciennes propositions officine encore en base alors que la demande n’a pas encore été répondue au patient. */
    if (
      ["submitted", "in_review"].includes(r.status) &&
      list.some((row) => row.line_source === "pharmacist_proposed")
    ) {
      const { error: delStale } = await supabase
        .from("request_items")
        .delete()
        .eq("request_id", id)
        .eq("line_source", "pharmacist_proposed");
      if (delStale) {
        setError(delStale.message);
        setLoading(false);
        return;
      }
      const { data: itemsDataRetry, error: itemsErrRetry } = await supabase
        .from("request_items")
        .select(
        "id,product_id,requested_qty,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,is_selected_by_patient,selected_qty,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,line_source,pharmacist_proposal_reason,client_comment,updated_at,products(name,price_pph,photo_url),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url))"
      )
        .eq("request_id", id)
        .order("created_at", { ascending: true });
      if (itemsErrRetry) {
        setError(itemsErrRetry.message);
        setLoading(false);
        return;
      }
      list = (itemsDataRetry as ItemRow[]) ?? [];
    }

    setItems(list);

    const [{ data: amendRows }, { data: dossierHist }] = await Promise.all([
      supabase.from("request_supply_amendments").select("id,created_at,amendments").eq("request_id", id).order("created_at", { ascending: true }),
      supabase
        .from("request_status_history")
        .select("created_at,old_status,new_status,reason")
        .eq("request_id", id)
        .order("created_at", { ascending: true })
        .limit(120),
    ]);
    setSupplyAmendmentBundles((amendRows as { id: string; created_at: string; amendments: unknown }[]) ?? []);
    setDossierHistoryTimeline(
      (dossierHist as { created_at: string; old_status: string | null; new_status: string; reason: string | null }[]) ?? []
    );

    /** Ne pas réécraser le brouillon des lignes encore présentes (ex. après insert ligne proposée + reload). */
    setDraft((prev) => {
      const next: Draft = {};
      for (const row of list) {
        const built = buildItemDraftFromRow(row);
        const p = prev[row.id];
        next[row.id] = p
          ? {
              ...built,
              ...p,
              withdrawn_after_confirm: built.withdrawn_after_confirm,
              selected_qty_str: built.selected_qty_str,
            }
          : built;
      }
      return next;
    });
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent<RequestDetailRefreshDetail>).detail;
      if (detail?.requestId !== id) return;
      void load();
    };
    window.addEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
    return () => window.removeEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
  }, [id, load]);

  useEffect(() => {
    if (altDebounced.length < 2 || !altPickerOpenFor) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,photo_url,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${altDebounced}%`)
          .order("name")
          .limit(12);
        if (error || !Array.isArray(data)) {
          setAltHits([]);
          return;
        }
        setAltHits(data as ProductCatalogHit[]);
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [altDebounced, altPickerOpenFor]);

  useEffect(() => {
    if (availabilityMenuRowId === null) return undefined;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const anchor = document.querySelector(`[data-pharma-avail-anchor="${availabilityMenuRowId}"]`);
      const menu = document.querySelector(`[data-pharma-avail-menu="${availabilityMenuRowId}"]`);
      if (anchor instanceof HTMLElement && anchor.contains(t)) return;
      if (menu instanceof HTMLElement && menu.contains(t)) return;
      setAvailabilityMenuRowId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [availabilityMenuRowId]);

  useEffect(() => {
    if (propDebounced.length < 2 || !propOpen) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,photo_url,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${propDebounced}%`)
          .order("name")
          .limit(12);
        if (error || !Array.isArray(data)) {
          setPropHits([]);
          return;
        }
        setPropHits(data as ProductCatalogHit[]);
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [propDebounced, propOpen]);

  const setField = (itemId: string, field: keyof ItemDraft, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const patchItemDraft = useCallback((itemId: string, patch: Partial<ItemDraft>) => {
    setDraft((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return { ...prev, [itemId]: { ...cur, ...patch } };
    });
  }, []);

  /** Ligne validée : quantité préparation ≤ choix patient tant que pas « récupéré » ; sinon plafonné à 10. */
  const maxPreparationQtyForRow = useCallback(
    (row: ItemRow): number => {
      if (!request || !["confirmed", "processing", "treated"].includes(request.status)) return 10;
      if (!row.is_selected_by_patient) return 10;
      const co = row.counter_outcome ?? "unset";
      const baseline = Math.min(10, Math.max(1, Number(row.selected_qty ?? row.requested_qty) || 1));
      if (co === "picked_up") return 10;
      return baseline;
    },
    [request]
  );

  /** Plafond de saisie « Stock » : lignes patient ≤ quantité demandée (+ règle comptoir si applicable) ; propositions officine : plafond technique seulement. */
  const draftStockCeilingForRow = useCallback(
    (row: ItemRow): number => {
      if (row.line_source === "pharmacist_proposed") {
        return PHARMACIST_PROPOSED_STOCK_CEILING;
      }
      const rqRaw = Number(row.requested_qty);
      const reqCap = Number.isFinite(rqRaw) ? Math.max(0, Math.floor(rqRaw)) : 0;
      return Math.min(maxPreparationQtyForRow(row), reqCap);
    },
    [maxPreparationQtyForRow]
  );

  const setAvailabilityStatus = (row: ItemRow, nextStatus: string) => {
    const isProp = row.line_source === "pharmacist_proposed";
    setDraft((prev) => {
      const current = prev[row.id];
      if (!current) return prev;
      let qty = Number(current.available_qty || "0");
      if (!Number.isFinite(qty)) qty = 0;
      if (nextStatus === "market_shortage" || nextStatus === "unavailable") qty = 0;
      const cap = draftStockCeilingForRow(row);
      if (nextStatus === "to_order") {
        qty = isProp ? Math.max(1, qty || Number(row.requested_qty) || 1) : Math.min(cap, row.requested_qty);
      }
      if (nextStatus === "available" && qty <= 0) {
        qty = isProp ? 1 : Math.min(cap, row.requested_qty);
      }
      const minQty = isProp ? 1 : 0;
      const nextAvail = String(Math.max(minQty, Math.min(cap, qty)));
      const inferred = inferAvailabilityStatusFromQty({
        status: nextStatus,
        availableQty: Number(nextAvail),
        requestedQty: row.requested_qty,
        isProposedLine: isProp,
      });
      const fulfillment_draft = clampFulfillmentDraftToInferred(current.fulfillment_draft, inferred);
      return {
        ...prev,
        [row.id]: {
          ...current,
          availability_status: nextStatus,
          available_qty: nextAvail,
          fulfillment_draft,
        },
      };
    });
  };

  const setAvailableQty = (row: ItemRow, raw: string) => {
    const status = draft[row.id]?.availability_status ?? "available";
    if (status === "market_shortage" || status === "to_order") return;
    const isProp = row.line_source === "pharmacist_proposed";
    const digits = raw.replace(/[^\d]/g, "");
    const max = draftStockCeilingForRow(row);
    if (digits === "") {
      setField(row.id, "available_qty", "");
      return;
    }
    const n = Math.min(max, Math.max(isProp ? 1 : 0, Number(digits)));
    const nextQty = Number.isFinite(n) ? n : 0;
    const inferred = inferAvailabilityStatusFromQty({
      status: "available",
      availableQty: nextQty,
      requestedQty: row.requested_qty,
      isProposedLine: row.line_source === "pharmacist_proposed",
    });
    setDraft((prev) => {
      const cur = prev[row.id];
      if (!cur) return prev;
      const nextStatus = status === "to_order" ? "to_order" : inferred;
      const fulfillment_draft = clampFulfillmentDraftToInferred(cur.fulfillment_draft, nextStatus);
      return {
        ...prev,
        [row.id]: {
          ...cur,
          available_qty: String(nextQty),
          availability_status: nextStatus,
          fulfillment_draft,
        },
      };
    });
  };

  const nudgeAvailableQty = (row: ItemRow, delta: number) => {
    const status = draft[row.id]?.availability_status ?? "available";
    if (status === "market_shortage" || status === "to_order") return;
    const isProp = row.line_source === "pharmacist_proposed";
    const max = draftStockCeilingForRow(row);
    const current = Number(draft[row.id]?.available_qty ?? "0");
    const floor = isProp ? 1 : 0;
    const next = Math.min(
      max,
      Math.max(floor, Number.isFinite(current) ? current + delta : delta > 0 ? 1 : 0)
    );
    const inferred = inferAvailabilityStatusFromQty({
      status: "available",
      availableQty: next,
      requestedQty: row.requested_qty,
      isProposedLine: row.line_source === "pharmacist_proposed",
    });
    setDraft((prev) => {
      const cur = prev[row.id];
      if (!cur) return prev;
      const nextStatus = status === "to_order" ? "to_order" : inferred;
      const fulfillment_draft = clampFulfillmentDraftToInferred(cur.fulfillment_draft, nextStatus);
      return {
        ...prev,
        [row.id]: {
          ...cur,
          available_qty: String(next),
          availability_status: nextStatus,
          fulfillment_draft,
        },
      };
    });
  };

  const resetAltPicker = () => {
    setAltPickerOpenFor(null);
    setAltQuery("");
    setAltHits([]);
  };

  const isAltOpen = (rowId: string) => altRowsOpen[rowId] ?? false;
  const toggleAltOpen = (rowId: string) =>
    setAltRowsOpen((prev) => ({ ...prev, [rowId]: !(prev[rowId] ?? false) }));

  const resetPropForm = () => {
    setPropQuery("");
    setPropHits([]);
    setPropReason("");
    setPropQty("1");
  };

  const insertPharmacistProposedLine = async (pick: ProductCatalogHit) => {
    if (!id) return;
    setError("");
    const reason = propReason.trim();
    if (reason.length < 3) {
      setError("Indique un motif d’au moins 3 caractères pour proposer ce produit.");
      return;
    }
    const qty = Math.min(10, Math.max(1, parseInt(propQty, 10) || 1));
    if (displayRows.some((i) => i.product_id === pick.id)) {
      setError("Ce produit figure déjà dans la demande.");
      return;
    }
    if (deferPersistOfficineAdditions) {
      const prefPrice =
        pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null;
      const syntheticId = newLocalProposedId();
      const syntheticRow: ItemRow = {
        id: syntheticId,
        product_id: pick.id,
        requested_qty: qty,
        availability_status: "available",
        available_qty: qty,
        unit_price: prefPrice,
        pharmacist_comment: null,
        client_comment: null,
        line_source: "pharmacist_proposed",
        pharmacist_proposal_reason: reason,
        expected_availability_date: null,
        counter_outcome: "unset",
        counter_cancel_reason: null,
        counter_cancel_detail: null,
        is_selected_by_patient: true,
        selected_qty: qty,
        patient_chosen_alternative_id: null,
        post_confirm_fulfillment: null,
        withdrawn_after_confirm: false,
        updated_at: new Date().toISOString(),
        products: {
          name: pick.name,
          price_pph: pick.price_pph ?? null,
          photo_url: pick.photo_url ?? null,
        },
        request_item_alternatives: null,
      };
      setPendingProposalRows((prev) => [...prev, syntheticRow]);
      setDraft((prev) => ({ ...prev, [syntheticId]: buildItemDraftFromRow(syntheticRow) }));
      setPropOpen(false);
      resetPropForm();
      return;
    }
    if (request && ["confirmed", "processing", "treated"].includes(request.status)) {
      setSupplyConfirmBlocks([
        {
          key: "add-line",
          title: `Ajouter « ${pick.name} »`,
          subtitle: `${qty} unité(s) · Motif : ${reason}`,
        },
      ]);
      setSupplyConfirmPending({ kind: "add_line", pick, reason, qty });
      setSupplyConfirmOpen(true);
      setPropOpen(false);
      resetPropForm();
      return;
    }
    setPropBusy(true);
    const { error: insErr } = await supabase.from("request_items").insert({
      request_id: id,
      product_id: pick.id,
      requested_qty: qty,
      line_source: "pharmacist_proposed",
      pharmacist_proposal_reason: reason,
      is_selected_by_patient: true,
      selected_qty: qty,
      counter_outcome: "unset",
    });
    setPropBusy(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_product_added");
      if (h) {
        setError(h.message);
        return;
      }
    }
    setPropOpen(false);
    resetPropForm();
    dispatchRequestDetailRefresh(id);
    await load();
  };

  const insertAlternative = async (parentRow: ItemRow, pick: ProductCatalogHit) => {
    const catalogProductId = pick.id;
    setError("");
    if (catalogProductId === parentRow.product_id) {
      setError("Choisis un produit différent de la ligne principale.");
      return;
    }
    if (deferPersistOfficineAdditions) {
      setAltBusyRow(parentRow.id);
      const prefPrice = pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null;
      let validationError: string | null = null;
      let added = false;
      flushSync(() => {
        setPendingAlternatives((prev) => {
          const mergedExisting: AltRowDb[] = [
            ...normalizeAlts(parentRow.request_item_alternatives),
            ...pendingAltsAsRankedDb(prev, parentRow.id),
          ];
          if (mergedExisting.some((a) => a.product_id === catalogProductId)) {
            validationError = "Cette alternative figure déjà sur la liste.";
            return prev;
          }
          const rank = nextAltRank(mergedExisting);
          if (rank == null) {
            validationError = "Maximum 3 alternatives par ligne.";
            return prev;
          }
          added = true;
          return [
            ...prev,
            {
              localAltId: newLocalAltId(),
              parentItemId: parentRow.id,
              rank,
              product_id: catalogProductId,
              availability_status: "available",
              available_qty: Math.max(1, parentRow.requested_qty),
              pharmacist_comment: null,
              unit_price: prefPrice,
              expected_availability_date: null,
              products: {
                name: pick.name,
                price_pph: pick.price_pph ?? null,
                photo_url: pick.photo_url ?? null,
              },
            },
          ];
        });
      });
      setAltBusyRow(null);
      if (validationError) {
        setError(validationError);
        return;
      }
      if (added) {
        resetAltPicker();
        setAltRowsOpen((prev) => ({ ...prev, [parentRow.id]: true }));
      }
      return;
    }
    const existing = normalizeAlts(parentRow.request_item_alternatives);
    const rank = nextAltRank(existing);
    if (existing.some((a) => a.product_id === catalogProductId)) {
      setError("Cette alternative figure déjà sur la liste.");
      return;
    }
    if (rank == null) {
      setError("Maximum 3 alternatives par ligne.");
      return;
    }
    setAltBusyRow(parentRow.id);
    const prefPrice = pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null;
    const { error: insErr } = await supabase.from("request_item_alternatives").insert({
      request_item_id: parentRow.id,
      rank,
      product_id: catalogProductId,
      availability_status: "available",
      available_qty: Math.max(1, parentRow.requested_qty),
      pharmacist_comment: null,
      unit_price: prefPrice,
      expected_availability_date: null,
    });
    setAltBusyRow(null);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    resetAltPicker();
    setAltRowsOpen((prev) => ({ ...prev, [parentRow.id]: true }));

    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_alternative_added");
      if (h) {
        setError(h.message);
        return;
      }
    }

    const { data: altRows, error: fetchErr } = await supabase
      .from("request_item_alternatives")
      .select(
        "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url)"
      )
      .eq("request_item_id", parentRow.id)
      .order("rank", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }

    setItems((prev) =>
      prev.map((r) => (r.id === parentRow.id ? { ...r, request_item_alternatives: altRows ?? [] } : r))
    );
  };

  const deleteAlternativeRow = async (altId: string, parentRowId?: string) => {
    setError("");
    if (deferPersistOfficineAdditions && isLocalAltId(altId)) {
      setPendingAlternatives((prev) => prev.filter((a) => a.localAltId !== altId));
      if (altPickerOpenFor === parentRowId) resetAltPicker();
      return;
    }
    setAltBusyRow(altId);
    const { error: delErr } = await supabase.from("request_item_alternatives").delete().eq("id", altId);
    setAltBusyRow(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_alternative_removed");
      if (h) {
        setError(h.message);
        return;
      }
    }
    if (altPickerOpenFor === parentRowId) resetAltPicker();

    if (parentRowId) {
      const { data: altRows, error: fetchErr } = await supabase
        .from("request_item_alternatives")
        .select(
          "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url)"
        )
        .eq("request_item_id", parentRowId)
        .order("rank", { ascending: true });
      if (!fetchErr) {
        setItems((prev) =>
          prev.map((r) => (r.id === parentRowId ? { ...r, request_item_alternatives: altRows ?? [] } : r))
        );
      }
    }
  };

  /** Écrit en base les propositions / alternatives tenues en mémoire locale (flux avant `confirmed`). */
  const flushDeferredOfficineAdds = async (
    draftSnap: Draft,
    proposalSnap: ItemRow[],
    altSnap: PendingAlternativeEntry[]
  ) => {
    if (!id) throw new Error("Requête invalide.");
    if (proposalSnap.length === 0 && altSnap.length === 0) return;

    const proposedIdMap = new Map<string, string>();

    for (const row of proposalSnap) {
      const f = draftSnap[row.id];
      if (!f?.availability_status) {
        throw new Error("Choisis une disponibilité pour chaque ligne (propositions officine).");
      }
      const availQty = Number(f.available_qty);
      if (Number.isNaN(availQty) || availQty < 1) {
        throw new Error("Pour chaque proposition officine, la quantité en stock doit être au moins 1.");
      }
      const price = f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
      if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
        throw new Error("Prix unitaire invalide.");
      }
      const inferredStatus = inferAvailabilityStatusFromQty({
        status: f.availability_status,
        availableQty: availQty,
        requestedQty: row.requested_qty,
        isProposedLine: row.line_source === "pharmacist_proposed",
      });

      const { data: inserted, error: insErr } = await supabase
        .from("request_items")
        .insert({
          request_id: id,
          product_id: row.product_id,
          requested_qty: row.requested_qty,
          line_source: "pharmacist_proposed",
          pharmacist_proposal_reason: row.pharmacist_proposal_reason,
          is_selected_by_patient: true,
          selected_qty: row.requested_qty,
          counter_outcome: "unset",
          availability_status: inferredStatus,
          available_qty: availQty,
          unit_price: price,
          pharmacist_comment: f.pharmacist_comment.trim() || null,
          expected_availability_date:
            f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
        })
        .select("id")
        .single();

      if (insErr || !inserted?.id) {
        throw new Error(insErr?.message ?? "Échec de l'enregistrement d'une proposition.");
      }
      proposedIdMap.set(row.id, inserted.id);
    }

    for (const p of altSnap) {
      const parentResolved = isLocalProposedItemId(p.parentItemId)
        ? proposedIdMap.get(p.parentItemId)
        : p.parentItemId;
      if (!parentResolved) {
        throw new Error("Référence de ligne invalide pour une alternative.");
      }
      const { error: altErr } = await supabase.from("request_item_alternatives").insert({
        request_item_id: parentResolved,
        rank: p.rank,
        product_id: p.product_id,
        availability_status: p.availability_status,
        available_qty: p.available_qty,
        pharmacist_comment: p.pharmacist_comment,
        unit_price: p.unit_price,
        expected_availability_date: p.expected_availability_date,
      });
      if (altErr) throw new Error(altErr.message);
    }
  };

  const saveCounterOutcome = async (
    requestItemId: string,
    outcome: string,
    cancelReason: string | null = null,
    cancelDetail: string | null = null
  ) => {
    const rowSnap = items.find((r) => r.id === requestItemId);
    const prevCo = rowSnap?.counter_outcome ?? "unset";
    const shouldResetPrepQtyAfterDropPickup =
      request?.status === "confirmed" &&
      Boolean(rowSnap?.is_selected_by_patient) &&
      prevCo === "picked_up" &&
      outcome !== "picked_up";

    setCounterBusyId(requestItemId);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_set_item_counter_outcome", {
      p_request_item_id: requestItemId,
      p_outcome: outcome,
      p_cancel_reason: outcome === "cancelled_at_counter" ? cancelReason : null,
      p_cancel_detail: outcome === "cancelled_at_counter" ? cancelDetail : null,
    });
    setCounterBusyId(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    if (shouldResetPrepQtyAfterDropPickup && rowSnap) {
      const baseline = Math.min(10, Math.max(1, Number(rowSnap.selected_qty ?? rowSnap.requested_qty) || 1));
      setField(requestItemId, "available_qty", String(baseline));
    }
    if (request?.status === "confirmed") {
      const reasonStr =
        outcome === "cancelled_at_counter" && cancelReason
          ? `counter_outcome:cancelled_at_counter:${cancelReason}`
          : `counter_outcome:${outcome}`;
      const { error: h } = await logHistory(id, "confirmed", "confirmed", reasonStr);
      if (h) {
        setError(h.message);
        return;
      }
    }
    await load();
  };

  const persistGlobalCommentIfChanged = async () => {
    const next = globalComment.trim();
    if (next.length === 0 || next === initialGlobalComment) return;
    const { data: authData } = await supabase.auth.getUser();
    const { error: cErr } = await supabase.from("request_comments").insert({
      request_id: id,
      author_id: authData.user?.id ?? null,
      author_role: "pharmacien",
      comment_text: next,
      is_internal: false,
    });
    if (cErr) throw new Error(cErr.message);
    setInitialGlobalComment(next);
  };

  const saveFrozenPharmacistLineReaction = useCallback(
    async (rowId: string, raw: string) => {
      if (!id || !request || request.status !== "responded" || respondedEditMode) return;
      if (!items.some((r) => r.id === rowId)) return;
      const next = raw.trim().length === 0 ? null : raw.trim().slice(0, 1000);
      setReplyPersistBusyRowId(rowId);
      setError("");
      const { error: upErr } = await supabase
        .from("request_items")
        .update({ pharmacist_comment: next })
        .eq("id", rowId);
      setReplyPersistBusyRowId(null);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      await load();
    },
    [id, request, respondedEditMode, items, load]
  );

  const declarationTreatedEligible = useMemo(() => {
    if (!request?.status || !["confirmed", "processing"].includes(request.status)) return false;
    for (const i of items) {
      if (!i.is_selected_by_patient) continue;
      const f = draft[i.id];
      if (!f || f.withdrawn_after_confirm) continue;
      const eff = effectiveAvailSupplyDraft(i, f);
      const pcf = f.fulfillment_draft;
      if (eff === "available" || eff === "partially_available") {
        if (pcf !== "reserved") return false;
      } else if (eff === "to_order") {
        if (pcf !== "ordered") return false;
      } else {
        return false;
      }
    }
    return true;
  }, [request, items, draft]);

  const runDeclareRequestTreated = async () => {
    if (!id) return;
    setDeclareTreatedBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_mark_request_treated", {
      p_request_id: id,
    });
    setDeclareTreatedBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    dispatchRequestDetailRefresh(id);
    await load();
  };

  const saveConfirmedAdjustmentsCore = async (structuralEnriched: SupplyAmendmentEntryJson[] | null) => {
    if (!request || !["confirmed", "processing", "treated"].includes(request.status) || !id) return;
    setBusy(true);
    setError("");
    try {
      for (const row of items) {
        const f = draft[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const qtyPrep = Number(f.available_qty);
        if (Number.isNaN(qtyPrep) || qtyPrep < 0) throw new Error("Quantité disponible invalide sur une ligne.");
        const nm = one(row.products)?.name ?? "ce produit";
        const isProp = row.line_source === "pharmacist_proposed";
        if (isProp && qtyPrep < 1 && !f.withdrawn_after_confirm) {
          throw new Error(`« ${nm} » (proposition officine) : quantité en stock minimale 1.`);
        }
        if (!isProp && qtyPrep > row.requested_qty) {
          throw new Error(`« ${nm} » : la quantité en stock ne peut pas dépasser la quantité demandée (${row.requested_qty}).`);
        }
        const coNorm = counterSelectKeyNormalized(row, f);
        const draftSel = Math.min(10, Math.max(1, Number(f.selected_qty_str) || 1));
        const maxQ =
          !isProp && row.is_selected_by_patient && !f.withdrawn_after_confirm && coNorm !== "picked_up"
            ? draftSel
            : maxPreparationQtyForRow(row);
        if (
          !isProp &&
          row.is_selected_by_patient &&
          !f.withdrawn_after_confirm &&
          coNorm !== "picked_up" &&
          qtyPrep > maxQ
        ) {
          throw new Error(
            `« ${nm} » : jusqu'à récupération, la quantité ne peut pas dépasser celle validée par le patient (${maxQ}).`
          );
        }
        const payload = buildItemUpdatePayload(f, row);
        const inf = payload.availability_status;
        let pcf: "unset" | "reserved" | "ordered" = f.fulfillment_draft;
        if (f.withdrawn_after_confirm) {
          pcf = "unset";
        } else {
          pcf = clampFulfillmentDraftToInferred(pcf, inf);
        }
        const pcfDb = pcf === "unset" ? null : pcf;
        const { error: up } = await supabase
          .from("request_items")
          .update({
            ...payload,
            post_confirm_fulfillment: pcfDb,
            withdrawn_after_confirm: Boolean(f.withdrawn_after_confirm),
            selected_qty: row.is_selected_by_patient && !f.withdrawn_after_confirm ? draftSel : row.selected_qty,
          })
          .eq("id", row.id);
        if (up) throw new Error(up.message);
      }

      for (const row of items) {
        const f = draft[row.id];
        if (!f) continue;
        const normalized = normalizeCounterOutcomeForPersist(row, f);
        if (normalized === null) continue;
        const nextCo = normalized.outcome;
        const nextReason = normalized.cancelReason;
        const nextDetail = normalized.cancelDetail;
        const curCo = row.counter_outcome ?? "unset";
        const curReason = row.counter_cancel_reason ?? null;
        const curDetail = row.counter_cancel_detail ?? null;
        if (nextCo === curCo && (nextReason ?? null) === (curReason ?? null) && (nextDetail ?? null) === (curDetail ?? null)) {
          continue;
        }
        const { error: rpcCo } = await supabase.rpc("pharmacist_set_item_counter_outcome", {
          p_request_item_id: row.id,
          p_outcome: nextCo,
          p_cancel_reason: nextReason,
          p_cancel_detail: nextDetail,
        });
        if (rpcCo) throw new Error(rpcCo.message);
      }

      const audit = buildPharmaConfirmAdjustmentAudit(items, draft);
      const histReason = audit ? stringifyPharmaConfirmAudit(audit) : "pharmacist_adjustments_after_confirmation";
      const { error: h } = await logHistory(id, request.status, request.status, histReason);
      if (h) throw new Error(h.message);

      const withdrawAmends: SupplyAmendmentEntryJson[] = [];
      for (const row of items) {
        const f = draft[row.id];
        if (!f || !row.is_selected_by_patient) continue;
        const was = Boolean(row.withdrawn_after_confirm);
        const next = Boolean(f.withdrawn_after_confirm);
        if (was === next) continue;
        const nm = one(row.products)?.name ?? "Produit";
        const fill = lineModifyConsent[row.id];
        if (!fill?.channel?.trim()) {
          throw new Error(`Accord patient requis pour écarter ou réintégrer « ${nm} ».`);
        }
        withdrawAmends.push({
          kind: next ? "withdraw_after_confirm" : "reintegrate_after_confirm",
          request_item_id: row.id,
          summary: next ? `${nm} retiré avec accord patient` : `${nm} réintégré`,
          detail: next ? `${nm} : ligne retirée après validation.` : `${nm} : ligne réintégrée.`,
          client_confirmation_channel: fill.channel.trim(),
          client_motive: fill.motive.trim() === "" ? null : fill.motive.trim(),
        });
      }

      const allAmends = [...(structuralEnriched ?? []), ...withdrawAmends];
      if (allAmends.length > 0) {
        const { error: rpcA } = await supabase.rpc("pharmacist_record_supply_amendments", {
          p_request_id: id,
          p_amendments: allAmends,
        });
        if (rpcA) throw new Error(rpcA.message);
      }

      await persistGlobalCommentIfChanged();
      dispatchRequestDetailRefresh(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const startSaveConfirmedAdjustments = () => {
    if (!request || !["confirmed", "processing", "treated"].includes(request.status)) return;
    const structuralBefore = buildSupplyStructuralAmends(items, draft);
    const rowIds = new Set<string>();
    for (const e of structuralBefore) {
      if (e.request_item_id) rowIds.add(e.request_item_id);
    }
    const withdrawTransitionIds = items.filter((row) => {
      const fd = draft[row.id];
      if (!fd || !row.is_selected_by_patient) return false;
      return Boolean(row.withdrawn_after_confirm) !== Boolean(fd.withdrawn_after_confirm);
    }).map((r) => r.id);
    for (const wid of withdrawTransitionIds) rowIds.add(wid);
    for (const rid of rowIds) {
      const c = lineModifyConsent[rid];
      if (!c?.channel?.trim()) {
        setError(
          "Pour chaque ligne concernée, indiquez le canal d’accord (menu ⋮ → Modifier ou Écarter / Réintégrer), puis enregistrez."
        );
        return;
      }
    }
    void (async () => {
      try {
        const enriched: SupplyAmendmentEntryJson[] | null =
          structuralBefore.length > 0
            ? structuralBefore.map((a) => {
                const rid = a.request_item_id ?? "";
                const fill = rid ? lineModifyConsent[rid] : undefined;
                return {
                  ...a,
                  client_confirmation_channel: (fill?.channel ?? "autre").trim(),
                  client_motive: (fill?.motive ?? "").trim() === "" ? null : (fill?.motive ?? "").trim(),
                };
              })
            : null;
        await saveConfirmedAdjustmentsCore(enriched);
        if (rowIds.size > 0) {
          setLineModifyConsent((prev) => {
            const next = { ...prev };
            for (const rid of rowIds) delete next[rid];
            return next;
          });
        }
      } catch {
        /* setError dans saveConfirmedAdjustmentsCore */
      }
    })();
  };

  const applySupplyModalConfirm = async (fills: { channel: string; motive: string }[]) => {
    const pending = supplyConfirmPending;
    if (!pending || !id) return;
    setSupplyConfirmBusy(true);
    setError("");
    try {
      if (pending.kind === "unlock_modify") {
        const fill = fills[0];
        if (!fill?.channel?.trim()) throw new Error("Indiquez le canal utilisé.");
        setLineModifyConsent((prev) => ({
          ...prev,
          [pending.rowId]: { channel: fill.channel.trim(), motive: (fill.motive ?? "").trim() },
        }));
      } else if (pending.kind === "add_line") {
        const fill = fills[0];
        if (!fill) throw new Error("Confirmation incomplète.");
        const { pick, reason, qty } = pending;
        const { data: insRow, error: insErr } = await supabase
          .from("request_items")
          .insert({
            request_id: id,
            product_id: pick.id,
            requested_qty: qty,
            line_source: "pharmacist_proposed",
            pharmacist_proposal_reason: reason,
            is_selected_by_patient: true,
            selected_qty: qty,
            counter_outcome: "unset",
          })
          .select("id")
          .maybeSingle();
        if (insErr) throw new Error(insErr.message);
        const newId = (insRow as { id?: string } | null)?.id;
        if (!newId) throw new Error("Insertion sans identifiant retourné.");
        const amendments: SupplyAmendmentEntryJson[] = [
          {
            kind: "line_added_after_confirm",
            request_item_id: newId,
            summary: `${pick.name} ajouté avec accord patient`,
            detail: `${pick.name} : proposition officine après validation (${qty} unité(s)).`,
            client_confirmation_channel: fill.channel.trim(),
            client_motive: fill.motive.trim() === "" ? null : fill.motive.trim(),
          },
        ];
        const { error: rpcA } = await supabase.rpc("pharmacist_record_supply_amendments", {
          p_request_id: id,
          p_amendments: amendments,
        });
        if (rpcA) throw new Error(rpcA.message);
        await logHistory(id, request?.status ?? null, request?.status ?? "confirmed", "counter_product_added");
        setPropOpen(false);
        resetPropForm();
        dispatchRequestDetailRefresh(id);
        await load();
      }
      setSupplyConfirmOpen(false);
      setSupplyConfirmPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setSupplyConfirmBusy(false);
  };

  const saveRespondedAdjustments = async () => {
    if (!request || request.status !== "responded") return;
    setBusy(true);
    setError("");
    const draftSnap = draft;
    const proposalSnap = [...pendingProposalRows];
    const altSnap = [...pendingAlternatives];
    try {
      for (const row of displayRows) {
        if (isLocalProposedItemId(row.id)) continue;
        const f = draftSnap[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const { error: up } = await supabase
          .from("request_items")
          .update(buildItemUpdatePayload(f, row))
          .eq("id", row.id);
        if (up) throw new Error(up.message);
      }
      await flushDeferredOfficineAdds(draftSnap, proposalSnap, altSnap);
      setPendingProposalRows([]);
      setPendingAlternatives([]);
      const { error: h } = await logHistory(id, "responded", "responded", "pharmacist_response_updated");
      if (h) throw new Error(h.message);
      await persistGlobalCommentIfChanged();
      setRespondedEditMode(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setBusy(false);
  };

  const publishResponse = async () => {
    if (!request) return;
    if (request.request_type !== "product_request") {
      setError("Pour l’instant, seules les demandes « Produits » sont traitées ici.");
      return;
    }
    if (displayRows.length === 0) {
      setError("Aucune ligne produit à renseigner.");
      return;
    }

    for (const row of displayRows) {
      const f = draft[row.id];
      if (!f?.availability_status) {
        setError("Choisis une disponibilité pour chaque ligne.");
        return;
      }
      const qty = Number(f.available_qty);
      if (Number.isNaN(qty) || qty < 0) {
        setError("Quantité disponible invalide sur une ligne.");
        return;
      }
      const isProposedLine =
        row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id);
      if (isProposedLine) {
        if (qty < 1) {
          const nm = one(row.products)?.name ?? "Produit";
          setError(`« ${nm} » (proposition officine) : indiquez une quantité en stock d’au moins 1.`);
          return;
        }
      } else if (qty > row.requested_qty) {
        const nm = one(row.products)?.name ?? "Produit";
        setError(`« ${nm} » : la quantité en stock ne peut pas dépasser la quantité demandée (${row.requested_qty}).`);
        return;
      }
    }

    setBusy(true);
    setError("");

    let currentStatus = request.status;
    /** Pour `request_status_history` : doit refléter le statut réel avant passage à `responded`. */
    let oldStatusForRespondedTransition = currentStatus;

    const draftSnap = draft;
    const proposalSnap = [...pendingProposalRows];
    const altSnap = [...pendingAlternatives];

    try {
      if (currentStatus === "submitted") {
        const { error: u1 } = await supabase.from("requests").update({ status: "in_review" }).eq("id", id);
        if (u1) throw new Error(u1.message);
        const { error: h1 } = await logHistory(id, "submitted", "in_review");
        if (h1) throw new Error(h1.message);
        currentStatus = "in_review";
        oldStatusForRespondedTransition = "in_review";
        setRequest((prev) => (prev && prev.id === id ? { ...prev, status: "in_review" } : prev));
      }

      if (currentStatus !== "in_review") {
        throw new Error(
          `Impossible d’envoyer la réponse (statut : ${request.status}). Réouvrez la demande ou contactez le support si le problème persiste.`
        );
      }

      for (const row of displayRows) {
        if (isLocalProposedItemId(row.id)) continue;
        const f = draftSnap[row.id]!;
        const availQty = Number(f.available_qty);
        const price =
          f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
        if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
          throw new Error("Prix unitaire invalide.");
        }
        const inferredStatus = inferAvailabilityStatusFromQty({
          status: f.availability_status,
          availableQty: availQty,
          requestedQty: row.requested_qty,
          isProposedLine: row.line_source === "pharmacist_proposed",
        });

        const { error: up } = await supabase
          .from("request_items")
          .update({
            availability_status: inferredStatus,
            available_qty: availQty,
            unit_price: price,
            pharmacist_comment: f.pharmacist_comment.trim() || null,
            expected_availability_date:
              f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
          })
          .eq("id", row.id);

        if (up) throw new Error(up.message);
      }

      await flushDeferredOfficineAdds(draftSnap, proposalSnap, altSnap);
      setPendingProposalRows([]);
      setPendingAlternatives([]);

      /* Pilote Q38/Q6 : pas d’expiration +7 j après réponse ; l’état passe par abandon 24 h (cron) après `responded` si aucune confirmation. */
      const { error: u2 } = await supabase
        .from("requests")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
          expires_at: null,
        })
        .eq("id", id);

      if (u2) throw new Error(u2.message);

      const { error: h2 } = await logHistory(
        id,
        oldStatusForRespondedTransition,
        "responded",
        "publication_disponibilites"
      );
      if (h2) throw new Error(h2.message);
      await persistGlobalCommentIfChanged();

      setError("");
      setRespondedEditMode(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const runPharmacistCancelRequest = async () => {
    if (!id) return;
    const motif = cancelReason.trim();
    if (motif.length < 5) {
      setError("Précisez un motif d'annulation d'au moins 5 caractères.");
      return;
    }
    if (!globalThis.confirm("Annuler définitivement cette demande ? Le patient sera notifié.")) {
      return;
    }
    setCancelBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_cancel_request", {
      p_request_id: id,
      p_reason_text: motif,
    });
    setCancelBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setCancelReason("");
    await load();
  };

  const loadHistory = useCallback(async () => {
    if (!id) return;
    setHistoryBusy(true);
    const { data, error: histErr } = await supabase
      .from("request_status_history")
      .select("id,created_at,old_status,new_status,reason")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!histErr && Array.isArray(data)) {
      setHistoryRows(data as typeof historyRows);
    }
    setHistoryBusy(false);
  }, [id]);

  const runCompleteAfterCounter = async () => {
    if (!id || !request) return;
    const selectedLines = items.filter((i) => i.is_selected_by_patient);
    const tracked = selectedLines.filter((i) => !i.withdrawn_after_confirm);
    const pendingPickup = tracked.filter((i) => (i.counter_outcome ?? "unset") !== "picked_up").length;
    const msg =
      pendingPickup > 0
        ? `Clôturer ce dossier ? ${pendingPickup} produit(s) retenu(s) ne sont pas encore enregistrés comme récupérés au comptoir.`
        : "Confirmer la clôture du dossier ?";
    if (!globalThis.confirm(msg)) return;
    setCompleteBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_complete_request_after_counter", {
      p_request_id: id,
      p_reason: "pharmacist_ui_confirm_close",
    });
    setCompleteBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await load();
  };

  const canEditResponse = request && ["submitted", "in_review"].includes(request.status);
  const canManageSupply = request && ["confirmed", "processing", "treated"].includes(request.status);
  const canManageResponded = request?.status === "responded";
  const respondedFrozenView = Boolean(request?.status === "responded" && !respondedEditMode);
  const showLineAndPublishEdits =
    !!request &&
    (["submitted", "in_review"].includes(request.status) ||
      (request.status === "responded" && respondedEditMode) ||
      request.status === "confirmed" ||
      request.status === "processing" ||
      request.status === "treated");
  const isProduct = request?.request_type === "product_request";

  const lineEntriesForList = useMemo(() => {
    if (request && ["confirmed", "processing", "treated"].includes(request.status)) {
      const virt = virtualizeItemsForSupplyBuckets(displayRows, draft);
      const flat = flattenPharmacistSupplyListEntries(virt);
      if (flat.length > 0) return flat;
    }
    return displayRows.map((row) => ({ header: null as string | null, row }));
  }, [request, displayRows, draft]);

  const pharmaHistoryBlocks = useMemo(() => {
    if (!pharmaHistoryRowId || !request) return [];
    const row = items.find((i) => i.id === pharmaHistoryRowId);
    if (!row) return [];
    return buildPatientLineTimelineFr({
      row: row as PatientLineLike,
      requestCreatedAt: request.created_at,
      requestSubmittedAt: request.submitted_at,
      requestRespondedAt: request.responded_at,
      requestConfirmedAt: request.confirmed_at ?? null,
      supplyBundles: supplyAmendmentBundles,
      dossierHistory: dossierHistoryTimeline,
    });
  }, [pharmaHistoryRowId, request, items, supplyAmendmentBundles, dossierHistoryTimeline]);

  let hardStopMotif: string | null = null;
  if (request && pharmacistRequestIsHardStopped(request.status)) {
    for (let i = dossierHistoryTimeline.length - 1; i >= 0; i--) {
      const h = dossierHistoryTimeline[i];
      if (h.new_status === request.status && h.reason?.trim()) {
        hardStopMotif = h.reason.trim();
        break;
      }
    }
  }

  const closedSuccessPickupCount =
    request && pharmacistRequestIsClosedSuccess(request.status)
      ? items.filter(
          (i) =>
            i.is_selected_by_patient && !i.withdrawn_after_confirm && (i.counter_outcome ?? "unset") === "picked_up"
        ).length
      : null;

  const resetDraftFromRows = useCallback(() => {
    setDraft(() => {
      const next: Draft = {};
      for (const row of items) {
        next[row.id] = buildItemDraftFromRow(row);
      }
      return next;
    });
  }, [items]);

  let canCompleteCounter = false;
  let counterClosurePendingTracked = 0;
  if (
    request &&
    isProduct &&
    (request.status === "confirmed" || request.status === "processing" || request.status === "treated")
  ) {
    const selectedLines = items.filter((i) => i.is_selected_by_patient);
    const tracked = selectedLines.filter((i) => !i.withdrawn_after_confirm);
    const pickedPersisted = tracked.filter((i) => (i.counter_outcome ?? "unset") === "picked_up").length;
    counterClosurePendingTracked = tracked.filter((i) => (i.counter_outcome ?? "unset") !== "picked_up").length;
    canCompleteCounter = tracked.length > 0 && pickedPersisted >= 1;
  }

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
        <p className="text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (error && !request) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
        <Link href="/dashboard/pharmacien/demandes" className="mt-3 inline-block text-xs font-medium text-emerald-900 underline">
          Demandes de produits
        </Link>
      </PageShell>
    );
  }

  if (!request) return null;

  const pr = one(request.product_requests);
  const patientNote = pr?.patient_note;

  const patientPhone = patientProfile?.whatsapp?.trim();
  const patientEmail = patientProfile?.email?.trim();
  const selectedLinesCount = items.filter((i) => i.is_selected_by_patient).length;
  const pendingCounterCount = items.filter(
    (i) =>
      i.is_selected_by_patient &&
      !i.withdrawn_after_confirm &&
      (i.counter_outcome ?? "unset") === "unset"
  ).length;
  const pickedUpCount = items.filter(
    (i) =>
      i.is_selected_by_patient &&
      !i.withdrawn_after_confirm &&
      (i.counter_outcome ?? "unset") === "picked_up"
  ).length;

  const showPassageInPharmaHeader =
    request.status === "confirmed" ||
    request.status === "processing" ||
    request.status === "treated" ||
    request.status === "completed" ||
    request.status === "partially_collected" ||
    request.status === "fully_collected";

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-2 sm:space-y-3">
      <Link href="/dashboard/pharmacien/demandes" className="inline-block text-xs font-medium text-sky-800 underline">
        ← Retour aux demandes de produits
      </Link>

      <header className="mt-2 rounded-xl border-2 border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 px-2.5 py-1.5 shadow-md shadow-sky-900/[0.06] ring-1 ring-sky-200/55 sm:px-3">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] sm:gap-x-2">
            <span className="shrink-0 font-bold uppercase tracking-wide text-sky-950/85">Demande prod.</span>
            <span className="font-mono text-[11px] font-semibold text-foreground">
              {displayRequestPublicRef(request)}
            </span>
            {isProduct ? (
              <span className="shrink-0 rounded-full border border-sky-200/90 bg-white/90 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-sky-950">
                {displayRows.length} ligne{displayRows.length > 1 ? "s" : ""}
              </span>
            ) : null}
            <span className="text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="text-muted-foreground">
              Envoyée{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatDateShortCasablancaWithTime24hFr(request.submitted_at ?? request.created_at)}
              </span>
            </span>
            {showPassageInPharmaHeader ? (
              <>
                <span className="text-muted-foreground" aria-hidden>
                  ·
                </span>
                <span className="text-muted-foreground">
                  Passage{" "}
                  <span className="font-semibold text-foreground">
                    {request.patient_planned_visit_date
                      ? formatPlannedVisitFr(request.patient_planned_visit_date, request.patient_planned_visit_time)
                      : "À définir"}
                  </span>
                </span>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 sm:ms-auto">
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Statut</span>
            <span
              className={clsx(
                "inline-flex max-w-[min(100%,16rem)] justify-center truncate rounded-full border px-2 py-0.5 text-center text-[10px] font-bold leading-tight shadow-sm sm:max-w-[14rem]",
                ["submitted", "in_review"].includes(request.status)
                  ? "border-sky-400/85 bg-sky-100 text-sky-950 ring-1 ring-sky-200/80"
                  : request.status === "responded"
                    ? "border-amber-300/95 bg-amber-50 text-amber-950"
                    : ["confirmed", "processing", "treated", "completed", "in_progress_virtual"].includes(request.status)
                      ? "border-teal-400/80 bg-teal-50 text-teal-950"
                      : "border-primary/35 bg-primary/10 text-primary"
              )}
              title={(requestStatusFr[request.status] ?? request.status) + ""}
            >
              {requestStatusFr[request.status] ?? request.status}
            </span>
          </div>
        </div>
      </header>

      {pharmacistRequestIsHardStopped(request.status) && isProduct ? (
        <section className="rounded-xl border border-slate-300/90 bg-slate-50 px-3 py-2.5 text-[11px] text-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Motif (sans suite)</p>
          <p className="mt-1 whitespace-pre-wrap break-words leading-snug">
            {hardStopMotif ?? "Aucun détail enregistré dans l’historique pour ce statut."}
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">Lecture seule — état figé tel qu’avant l’interruption.</p>
        </section>
      ) : null}

      {pharmacistRequestIsClosedSuccess(request.status) && isProduct ? (
        <section className="rounded-xl border border-emerald-300/80 bg-emerald-50/90 px-3 py-2.5 text-[11px] text-emerald-950">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-900">Clôture comptoir</p>
          <p className="mt-1 font-semibold tabular-nums text-emerald-950">
            Produits récupérés (lignes retenues)&nbsp;: {closedSuccessPickupCount ?? 0}
          </p>
          <p className="mt-1 text-[10px] text-emerald-900/85">Lecture seule.</p>
        </section>
      ) : null}

      <section className="rounded-xl border border-emerald-300/60 bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/40 p-2 shadow-sm ring-1 ring-emerald-200/45">
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-emerald-950">Client</h3>
        <p className="mt-1 text-[10px] leading-snug text-emerald-950/88">Coordonnées et référence patient.</p>
        <div className="mt-2 flex gap-2 sm:items-center sm:gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm"
            title="Client"
            aria-hidden
          >
            <User className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
              <p className="min-w-[40%] flex-1 break-words text-[12px] font-bold leading-snug text-emerald-950 sm:text-[13px]">
                {patientHeadingName(patientProfile, request.patient_id)}
              </p>
              {patientPhone || patientEmail ? (
                <button
                  type="button"
                  aria-expanded={patientContactOpen}
                  onClick={() => setPatientContactOpen((v) => !v)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/70 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-50"
                >
                  <Phone className="size-3.5 shrink-0 opacity-90" aria-hidden />
                  Contacter
                  <ChevronDown
                    className={clsx("size-3.5 shrink-0 text-emerald-800/80 transition-transform", patientContactOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] text-emerald-950/90">
              <span className="font-semibold uppercase tracking-wide text-emerald-950/80">Réf. client </span>
              <span className="break-all font-mono font-semibold text-emerald-950">
                {patientProfile?.patient_ref?.trim() || `#${formatShortId(request.patient_id)}`}
              </span>
            </p>
            {(patientPhone || patientEmail) && patientContactOpen ? (
              <div className="mt-1.5 flex flex-wrap gap-1 border-t border-emerald-200/80 pt-1.5">
                {patientPhone ? (
                  <>
                    <a
                      href={telHref(patientPhone)}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                      title={`Appeler ${patientPhone}`}
                    >
                      <Phone className="size-4" aria-hidden />
                    </a>
                    <a
                      href={smsHref(patientPhone)}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                      title="SMS"
                    >
                      <MessageSquare className="size-4" aria-hidden />
                    </a>
                    <a
                      href={whatsappHref(patientPhone)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                      title="WhatsApp"
                    >
                      <MessageCircle className="size-4" aria-hidden />
                    </a>
                  </>
                ) : null}
                {patientEmail ? (
                  <a
                    href={`mailto:${patientEmail}`}
                    className="inline-flex size-9 items-center justify-center rounded-lg border border-sky-400/70 bg-white text-sky-900 shadow-sm transition hover:bg-sky-50"
                    title={patientEmail}
                  >
                    <Mail className="size-4" aria-hidden />
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {respondedFrozenView && isProduct ? (
        <section className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-sky-200/80 bg-sky-50/65 px-2.5 py-1.5 text-[10px] leading-snug text-sky-950 shadow-sm sm:text-[11px]">
          <span className="font-bold uppercase tracking-wide">Réponse publiée&nbsp;:</span>
          <span>
            Le{" "}
            <span className="font-semibold tabular-nums">
              {request.responded_at ? formatDateTimeShort24hFr(request.responded_at) : "—"}
            </span>
          </span>
          <span className="text-sky-700/45" aria-hidden>
            ·
          </span>
          <span>
            Dernière MAJ&nbsp;:{" "}
            <span className="font-semibold tabular-nums">{formatDateTimeShort24hFr(request.updated_at)}</span>
          </span>
          <InfoHint label="Aide — réponse publiée">
            <p>
              C&apos;est la vision actuelle pour le patient. Vous pouvez ajuster votre réaction aux commentaires de ligne sans
              réouvrir toute la fiche ; pour le reste (prix, dispo, alternatives), utilisez «&nbsp;Modifier la réponse&nbsp;».
            </p>
          </InfoHint>
        </section>
      ) : null}

      {patientNote ? (
        <section className="rounded-xl border-2 border-amber-400/90 bg-gradient-to-br from-amber-100 via-amber-50 to-orange-50/90 px-3 py-3 shadow-md ring-1 ring-amber-900/20 sm:px-3.5 sm:py-3.5">
          <h2 className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-950/92 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm ring-1 ring-amber-800/80">
              <MessageCircle className="size-3 shrink-0 text-amber-100" strokeWidth={2.5} aria-hidden />
              Message du client
            </span>
          </h2>
          <p className="mt-3 min-h-[4.75rem] max-h-[min(55vh,20rem)] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-amber-300/55 bg-white px-3 py-3 text-[13px] font-normal leading-relaxed text-foreground shadow-inner sm:text-xs sm:leading-snug">
            {patientNote}
          </p>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{error}</p>
      ) : null}

      {!isProduct ? (
        <p className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
          Type de demande non géré dans cet écran (hors produits).
        </p>
      ) : (
        <>
          {displayRows.length === 0 ? (
            <p className="mt-2 text-[11px] text-muted-foreground">Aucune ligne produit.</p>
          ) : (
            <>
              {respondedFrozenView && initialGlobalComment.trim() ? (
                <section className="rounded-xl border border-violet-200/70 bg-violet-50/40 px-3 py-2 shadow-sm">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-violet-950">Commentaire général envoyé</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-snug text-violet-950/90">{initialGlobalComment}</p>
                </section>
              ) : null}

              <div className="flex flex-wrap items-end justify-between gap-1.5 sm:gap-2">
            <div>
              <h2 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">Produits</h2>
              {["confirmed", "processing", "treated", "completed"].includes(request.status) ? (
                <div className="mt-1 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                  <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground">Sél. {selectedLinesCount}</span>
                  <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground">
                    Attente comptoir {pendingCounterCount}
                  </span>
                  <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground">
                    Récp. {pickedUpCount}
                  </span>
                </div>
              ) : null}
            </div>
            <span className="text-[10px] text-muted-foreground">{displayRows.length} article(s)</span>
          </div>
          <ul className="mt-2 space-y-2 sm:space-y-3">
            {lineEntriesForList.map(({ header, row }) => {
              const prod = one(row.products);
              const linePph = pphLabel(prod?.price_pph);
              const f = draft[row.id];
              if (!f) return null;
              const co = row.counter_outcome ?? "unset";
              const selected = Boolean(row.is_selected_by_patient);
              const lineLockedTrace = co === "cancelled_at_counter";
              const canEditThisRow = showLineAndPublishEdits && !lineLockedTrace;
              const rowAlts = normalizeAlts(row.request_item_alternatives);
              const chosenAltId = row.patient_chosen_alternative_id ?? null;
              const chosenAltRow = chosenAltId ? rowAlts.find((a) => a.id === chosenAltId) : null;
              const withdrawnDraft = Boolean(f.withdrawn_after_confirm);
              const showPatientConfirmedChoice =
                selected &&
                (request.status === "confirmed" ||
                  request.status === "processing" ||
                  request.status === "treated" ||
                  request.status === "completed");
              const showInlineCounter =
                request.status === "completed" ||
                request.status === "treated" ||
                request.status === "confirmed" ||
                request.status === "processing";
              const outcomeSelectDisabled =
                request.status === "completed" ||
                counterBusyId === row.id ||
                !selected ||
                !showInlineCounter;
              const draftAvailQty = Number(f.available_qty);
              const draftInferredStatus = inferAvailabilityStatusFromQty({
                status: f.availability_status,
                availableQty: Number.isFinite(draftAvailQty) ? draftAvailQty : 0,
                requestedQty: row.requested_qty,
                isProposedLine: row.line_source === "pharmacist_proposed",
              });
              const statusForBadge =
                lineLockedTrace || respondedFrozenView || !canEditThisRow
                  ? row.availability_status
                  : draftInferredStatus;
              const availUi = availabilityStatusUi(statusForBadge);
              const AvailIcon = availUi.Icon;
              const isProposedLine = row.line_source === "pharmacist_proposed";
              const stockCeiling = draftStockCeilingForRow(row);
              const stockParsedQty = Number(f.available_qty);
              const stockPlusDisabled =
                !canEditThisRow ||
                withdrawnDraft ||
                f.availability_status === "market_shortage" ||
                f.availability_status === "to_order" ||
                (!isProposedLine && Number.isFinite(stockParsedQty) && stockParsedQty >= stockCeiling);
              const stockStepperDisabled =
                !canEditThisRow ||
                withdrawnDraft ||
                f.availability_status === "market_shortage" ||
                f.availability_status === "to_order";
              const stockMinusDisabled =
                stockStepperDisabled || (isProposedLine && Number.isFinite(stockParsedQty) && stockParsedQty <= 1);
              const patientLineCc = row.client_comment?.trim() ?? "";
              const pharmaNotePreview = (
                canEditThisRow ? f.pharmacist_comment?.trim() ?? "" : row.pharmacist_comment?.trim() ?? ""
              );
              const showLineReactControl =
                patientLineCc.length > 0 && !lineLockedTrace && canEditThisRow;
              const showCommentBand =
                patientLineCc.length > 0 || canEditThisRow || (!canEditThisRow && pharmaNotePreview.length > 0);
              const availabilityOptions =
                row.line_source === "pharmacist_proposed"
                  ? PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS
                  : PHARMACIST_AVAILABILITY_OPTIONS;

              if (canManageSupply) {
                const pl = row as PatientLineLike;
                const validatedName = validatedProductLabel(pl);
                const validatedQty = validatedQtyForPatientLine(pl);
                const effSupply = effectiveAvailSupplyDraft(row, f);
                const etaSupply = effectiveEtaSupplyDraft(row, f);
                let availSentence = "";
                if (!selected) availSentence = "Non retenu";
                else if (effSupply === "to_order") {
                  availSentence = `À commander${etaSupply ? ` · dispo indicative ${formatDateShortFr(etaSupply)}` : ""}`;
                } else if (effSupply) availSentence = availabilityStatusFr[effSupply] ?? effSupply;
                else availSentence = "—";

                const branchPrice = validatedBranchUnitPriceMad(pl);
                const lineTot = branchPrice != null ? branchPrice * validatedQty : null;
                const unitLabel = branchPrice != null ? `${branchPrice.toFixed(2)} MAD` : "—";
                const totalLabel = lineTot != null ? `${lineTot.toFixed(2)} MAD` : "—";
                const altProdThumb = chosenAltRow ? one(chosenAltRow.products) : null;
                const thumbUrl = altProdThumb?.photo_url ?? prod?.photo_url ?? null;
                const hasConsent = Boolean(lineModifyConsent[row.id]?.channel?.trim());
                const consent = lineModifyConsent[row.id];
                const ring =
                  effSupply === "to_order"
                    ? "border-teal-200/85"
                    : withdrawnDraft || row.withdrawn_after_confirm
                      ? "border-amber-300/80"
                      : "border-emerald-200/80";
                const lineCounterLocked = (row.counter_outcome ?? "unset") === "picked_up";
                const canMarkReservedSupply =
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  (effSupply === "available" || effSupply === "partially_available");
                const canMarkOrderedSupply =
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  effSupply === "to_order";
                const supplyAvailabilityOptions = isProposedLine
                  ? PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS
                  : PHARMACIST_SUPPLY_POST_CONFIRM_AVAILABILITY_OPTIONS;

                const consentChannelBlock = (
                  <div className="space-y-1.5 rounded-md border border-sky-200/80 bg-sky-50/55 p-2">
                    <p className="text-[8px] font-bold uppercase tracking-wide text-sky-950">
                      Accord patient (enregistré avec la ligne)
                    </p>
                    <label className="block text-[9px] font-semibold text-muted-foreground">
                      Canal
                      <select
                        className="mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] font-medium shadow-sm"
                        value={consent?.channel ?? "phone_call"}
                        onChange={(e) =>
                          setLineModifyConsent((p) => ({
                            ...p,
                            [row.id]: {
                              channel: e.target.value,
                              motive: p[row.id]?.motive ?? "",
                            },
                          }))
                        }
                      >
                        {SUPPLY_AMEND_CHANNEL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[9px] font-semibold text-muted-foreground">
                      Description (optionnelle)
                      <textarea
                        rows={2}
                        value={consent?.motive ?? ""}
                        onChange={(e) =>
                          setLineModifyConsent((p) => ({
                            ...p,
                            [row.id]: {
                              channel: p[row.id]?.channel ?? "phone_call",
                              motive: e.target.value.slice(0, 1000),
                            },
                          }))
                        }
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm"
                      />
                    </label>
                  </div>
                );

                const modifyFieldsBlock = (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
                      <div className="flex min-w-[9.5rem] flex-1 flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          Disponibilité
                        </span>
                        <PharmacienAvailabilityDropdown
                          rowId={row.id}
                          disabled={!canEditThisRow || !hasConsent}
                          menuOpen={availabilityMenuRowId === row.id}
                          onOpenChange={(open) =>
                            setAvailabilityMenuRowId((cur) => (open ? row.id : cur === row.id ? null : cur))
                          }
                          draftStatus={f.availability_status}
                          requestedQty={row.requested_qty}
                          availableQtyStr={f.available_qty}
                          isProposedLine={isProposedLine}
                          options={supplyAvailabilityOptions}
                          onPick={(v) => setAvailabilityStatus(row, v)}
                        />
                      </div>
                      <label className="flex w-[5.5rem] flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Stock</span>
                        <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
                          <button
                            type="button"
                            disabled={stockMinusDisabled || !hasConsent}
                            onClick={() => nudgeAvailableQty(row, -1)}
                            className="h-full w-8 border-r border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                            aria-label="Diminuer la quantité"
                          >
                            −
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={
                              !canEditThisRow ||
                              !hasConsent ||
                              f.availability_status === "market_shortage" ||
                              f.availability_status === "to_order"
                            }
                            value={f.available_qty}
                            onChange={(e) => setAvailableQty(row, e.target.value)}
                            className={clsx(
                              "h-full w-full min-w-[2rem] border-0 bg-transparent px-1 text-center text-[12px] font-semibold tabular-nums focus:outline-none",
                              f.availability_status === "market_shortage" && "bg-muted text-muted-foreground",
                              f.availability_status === "to_order" && "cursor-not-allowed bg-muted/50 text-muted-foreground"
                            )}
                          />
                          <button
                            type="button"
                            disabled={stockPlusDisabled || !hasConsent}
                            onClick={() => nudgeAvailableQty(row, 1)}
                            className="h-full w-8 border-l border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                            aria-label="Augmenter la quantité"
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <label className="flex min-w-[5rem] flex-1 flex-col gap-0.5 sm:max-w-[7rem]">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          Prix <span className="normal-case opacity-70">MAD</span>
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="—"
                          disabled
                          value={f.unit_price}
                          title={linePph ? `PPH catalogue : ${linePph}` : undefined}
                          className="h-9 w-full rounded-xl border border-dashed border-border bg-muted/30 px-2 text-[12px] font-semibold tabular-nums opacity-80"
                        />
                      </label>
                    </div>
                    {canEditThisRow && hasConsent && effectiveAvailSupplyDraft(row, f) === "to_order" ? (
                      <label className="flex max-w-sm flex-col gap-0">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Date prévision commande
                        </span>
                        <input
                          type="date"
                          disabled={!canEditThisRow}
                          value={f.expected_availability_date}
                          onChange={(e) => setField(row.id, "expected_availability_date", e.target.value)}
                          className="h-7 w-full rounded border border-input bg-background px-1.5 text-[11px] shadow-sm disabled:opacity-60 sm:w-auto sm:min-w-[9rem]"
                        />
                      </label>
                    ) : null}
                    {canManageSupply && selected && !lineLockedTrace && !withdrawnDraft ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-300/80 bg-sky-50/90 px-1.5 py-1 text-[10px] text-sky-950">
                        <span className="text-[8px] font-bold uppercase tracking-wide text-sky-900/90">
                          Qté validée (patient)
                        </span>
                        <div className="inline-flex items-center gap-1 rounded-md border border-sky-400/60 bg-white px-0.5 py-0.5">
                          <button
                            type="button"
                            disabled={!canEditThisRow || !hasConsent || busy}
                            className="size-7 rounded border border-sky-200 bg-sky-50 text-sm font-bold text-sky-950 hover:bg-sky-100 disabled:opacity-40"
                            aria-label="Diminuer la quantité validée"
                            onClick={() => {
                              const cap = Math.min(10, Math.max(1, row.requested_qty));
                              const cur = Math.min(cap, Math.max(1, Number(f.selected_qty_str) || 1));
                              setField(row.id, "selected_qty_str", String(Math.max(1, cur - 1)));
                            }}
                          >
                            −
                          </button>
                          <span className="min-w-[1.5rem] text-center text-[11px] font-bold tabular-nums">
                            {Math.min(
                              Math.min(10, Math.max(1, row.requested_qty)),
                              Math.max(1, Number(f.selected_qty_str) || 1)
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={!canEditThisRow || !hasConsent || busy}
                            className="size-7 rounded border border-sky-200 bg-sky-50 text-sm font-bold text-sky-950 hover:bg-sky-100 disabled:opacity-40"
                            aria-label="Augmenter la quantité validée"
                            onClick={() => {
                              const cap = Math.min(10, Math.max(1, row.requested_qty));
                              const cur = Math.min(cap, Math.max(1, Number(f.selected_qty_str) || 1));
                              setField(row.id, "selected_qty_str", String(Math.min(cap, cur + 1)));
                            }}
                          >
                            +
                          </button>
                        </div>
                        <span className="text-[9px] leading-tight text-sky-900/85">
                          Max {Math.min(10, Math.max(1, row.requested_qty))}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );

                const expandedEditor = (
                  <div className="space-y-1.5">
                    {withdrawnDraft ? (
                      <div className="space-y-1.5 rounded-md border border-amber-300/85 bg-amber-50/90 p-2">
                        <p className="text-[9px] font-bold uppercase tracking-wide text-amber-950">Produit retiré (écart)</p>
                        <p className="text-[10px] leading-snug text-amber-950/90">
                          Canal et description (comme pour une modification). Rien n’est enregistré tant que vous n’avez pas
                          cliqué sur « Enregistrer les modifications ».
                        </p>
                        {consentChannelBlock}
                        <button
                          type="button"
                          disabled={busy || supplyConfirmBusy}
                          className="w-full rounded-md border border-amber-500/80 bg-white px-2 py-1.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-100/80 disabled:opacity-45"
                          onClick={() => {
                            patchItemDraft(row.id, buildItemDraftFromRow(row));
                            setLineModifyConsent((p) => {
                              const n = { ...p };
                              delete n[row.id];
                              return n;
                            });
                            setAvailabilityMenuRowId((cur) => (cur === row.id ? null : cur));
                            setSupplyMenuRowId(null);
                          }}
                        >
                          Annuler l’écart (rétablir la ligne telle qu’avant)
                        </button>
                      </div>
                    ) : null}
                    {!withdrawnDraft && hasConsent ? (
                      <div className="space-y-1.5">
                        {consentChannelBlock}
                        <button
                          type="button"
                          disabled={busy || supplyConfirmBusy}
                          className="w-full rounded-md border border-sky-400/80 bg-white px-2 py-1.5 text-[10px] font-semibold text-sky-950 hover:bg-sky-100/80 disabled:opacity-45"
                          onClick={() => {
                            patchItemDraft(row.id, buildItemDraftFromRow(row));
                            setLineModifyConsent((p) => {
                              const n = { ...p };
                              delete n[row.id];
                              return n;
                            });
                            setAvailabilityMenuRowId((cur) => (cur === row.id ? null : cur));
                            setSupplyMenuRowId(null);
                          }}
                        >
                          Annuler les modifications sur cette ligne
                        </button>
                        {modifyFieldsBlock}
                      </div>
                    ) : null}
                  </div>
                );

                const counterSelectInteractive =
                  selected &&
                  showInlineCounter &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  request.status !== "completed";

                const treatedCounterSlot =
                  showInlineCounter && request.status !== "completed" ? (
                    <div className="border-t border-slate-100 bg-slate-50/25 px-2 py-2">
                      {!selected ? (
                        <p className="text-[10px] text-muted-foreground">
                          Patient n&apos;ayant pas retenu cette ligne après votre réponse. État au comptoir :{" "}
                          <strong className="text-foreground">
                            {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                          </strong>
                        </p>
                      ) : lineLockedTrace ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                        </p>
                      ) : lineCounterLocked ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          Récupéré — plus modifiable.
                        </p>
                      ) : (
                        <div className="flex max-w-[320px] flex-col gap-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Résultat comptoir (enregistrement global)
                          </p>
                          <label className="flex flex-col gap-0.5 text-[10px] font-normal text-muted-foreground">
                            <span className="text-[9px] font-semibold uppercase tracking-wide">État</span>
                            <select
                              value={counterSelectKeyNormalized(row, f)}
                              disabled={!counterSelectInteractive || busy}
                              onChange={(e) => {
                                const v = e.target.value as "unset" | "picked_up";
                                patchItemDraft(row.id, {
                                  counter_outcome_draft: v,
                                  counter_cancel_reason_draft: null,
                                  counter_cancel_detail_draft: null,
                                });
                              }}
                              className="h-7 w-full rounded border border-input bg-background px-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <option value="unset">En attente</option>
                              <option value="picked_up">Récupéré</option>
                            </select>
                          </label>
                          <p className="text-[9px] leading-snug text-muted-foreground">
                            Pour retirer une ligne du dossier validé, utilisez « Écarter la ligne » dans le menu ⋮.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null;

                return (
                  <Fragment key={row.id}>
                    <PharmacistSupplyCompactLine
                      header={header}
                      validatedName={validatedName}
                      validatedQty={validatedQty}
                      availSentence={availSentence}
                      unitLabel={unitLabel}
                      totalLabel={totalLabel}
                      thumbUrl={thumbUrl}
                      ringClass={ring}
                      selected={selected}
                      lineLockedTrace={lineLockedTrace}
                      withdrawn={withdrawnDraft}
                      effAvailRow={effSupply}
                      canMarkReserved={canMarkReservedSupply}
                      canMarkOrdered={canMarkOrderedSupply}
                      fulfillmentDraft={f.fulfillment_draft}
                      onToggleReserved={() =>
                        patchItemDraft(row.id, {
                          fulfillment_draft: f.fulfillment_draft === "reserved" ? "unset" : "reserved",
                        })
                      }
                      onToggleOrdered={() =>
                        patchItemDraft(row.id, {
                          fulfillment_draft: f.fulfillment_draft === "ordered" ? "unset" : "ordered",
                        })
                      }
                      hasModifyConsent={hasConsent}
                      busy={busy}
                      supplyConfirmBusy={supplyConfirmBusy}
                      lineCounterLocked={lineCounterLocked}
                      showExpandedEditor={
                        selected &&
                        !lineLockedTrace &&
                        !lineCounterLocked &&
                        request.status !== "completed" &&
                        (withdrawnDraft || hasConsent)
                      }
                      expandedEditor={expandedEditor}
                      treatedCounterSlot={treatedCounterSlot}
                      menuOpen={supplyMenuRowId === row.id}
                      onMenuOpenChange={(open) => setSupplyMenuRowId(open ? row.id : null)}
                      onMenuModify={() => {
                        if (withdrawnDraft) {
                          setError("Annulez d’abord l’écart sur cette ligne (bouton dans le bloc orange), puis modifiez.");
                          setSupplyMenuRowId(null);
                          return;
                        }
                        setSupplyConfirmBlocks([
                          {
                            key: `unlock-${row.id}`,
                            title: `Accord patient · ${validatedName}`,
                            subtitle: "Canal obligatoire ; précision optionnelle.",
                          },
                        ]);
                        setSupplyConfirmPending({ kind: "unlock_modify", rowId: row.id });
                        setSupplyConfirmOpen(true);
                      }}
                      onMenuWithdraw={() => {
                        setError("");
                        patchItemDraft(row.id, {
                          withdrawn_after_confirm: true,
                          fulfillment_draft: "unset",
                        });
                        setLineModifyConsent((p) => ({
                          ...p,
                          [row.id]: p[row.id] ?? { channel: "phone_call", motive: "" },
                        }));
                        setSupplyMenuRowId(null);
                      }}
                      onMenuHistory={() => setPharmaHistoryRowId(row.id)}
                      withdrawDisabled={f.fulfillment_draft === "reserved" || lineCounterLocked}
                      withdrawDisabledReason={
                        lineCounterLocked
                          ? "Ligne déjà enregistrée comme récupérée."
                          : "Retirez d’abord le statut « réservé »."
                      }
                    />
                  </Fragment>
                );
              }

              return (
                <Fragment key={row.id}>
                  {header ? (
                    <li className="list-none pt-2 first:pt-0 sm:pt-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{header}</div>
                    </li>
                  ) : null}
                  <li
                    className={clsx(
                      "overflow-visible rounded-2xl border bg-white",
                      isProposedLine
                        ? "border-violet-400/80 bg-gradient-to-br from-violet-50/90 via-fuchsia-50/[0.35] to-white shadow-[0_4px_22px_rgba(109,40,217,0.13)] ring-1 ring-violet-300/45"
                        : "border-slate-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.045)] ring-1 ring-slate-900/[0.025]",
                      availUi.accentClass,
                      isProposedLine ? "border-l-[4px] border-l-violet-500" : "border-l-[3px]"
                    )}
                  >
                  <div
                    className={clsx(
                      "flex gap-2 border-b px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2",
                      isProposedLine
                        ? "border-violet-200/55 bg-gradient-to-r from-violet-100/[0.42] via-white to-transparent"
                        : "border-slate-100/90 bg-slate-50/25"
                    )}
                  >
                    <div
                      className={clsx(
                        "relative h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl border bg-white shadow-sm sm:h-[5.125rem] sm:w-[5.125rem]",
                        isProposedLine ? "border-violet-200/80 ring-1 ring-violet-200/35" : "border-slate-200/75"
                      )}
                    >
                      {prod?.photo_url ? (
                        <img src={prod.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Package
                            className={clsx("size-8 sm:size-9", isProposedLine ? "text-violet-400/90" : "text-slate-400")}
                            aria-hidden
                          />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                        {prod?.name ?? "Produit"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                        <span
                          className={clsx(
                            "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1",
                            availUi.badgeClass
                          )}
                          title={availUi.label}
                        >
                          <AvailIcon className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">{availUi.label}</span>
                        </span>
                        {!isProposedLine ? (
                          <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                            <Package className="size-3 text-muted-foreground/80" aria-hidden />
                            <span>
                              Demandé <strong className="text-foreground">{row.requested_qty}</strong>
                            </span>
                          </span>
                        ) : null}
                        {lineLockedTrace ? (
                          <span className="rounded-md bg-rose-100 px-1.5 py-px text-[9px] font-semibold text-rose-900 ring-1 ring-rose-200/80">
                            Non distribué
                          </span>
                        ) : [
                            "confirmed",
                            "processing",
                            "treated",
                            "completed",
                            "partially_collected",
                            "fully_collected",
                          ].includes(request.status) ? (
                          selected ? (
                            <span className="rounded-md bg-emerald-100 px-1.5 py-px text-[9px] font-semibold text-emerald-900">
                              Retenu
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-100 px-1.5 py-px text-[9px] font-semibold text-slate-700">
                              Non retenu
                            </span>
                          )
                        ) : null}
                      </div>
                      {isProposedLine ? (
                        <p className="rounded-md border border-violet-300/80 bg-gradient-to-br from-violet-200/55 to-violet-100/40 px-2 py-1 text-[10px] leading-snug text-violet-950 shadow-sm ring-1 ring-violet-300/35">
                          {row.pharmacist_proposal_reason?.trim() ? (
                            <>
                              <span className="font-semibold text-violet-950">Motif · </span>
                              <span className="text-violet-950/92">{row.pharmacist_proposal_reason.trim()}</span>
                            </>
                          ) : (
                            <span className="italic text-violet-800/85">Aucun motif renseigné.</span>
                          )}
                        </p>
                      ) : null}
                      {showPatientConfirmedChoice ? (
                        <div className="rounded-md border border-sky-300/70 bg-sky-50/95 px-1.5 py-1 text-[10px] leading-snug text-sky-950">
                          <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900/90">Choix patient</p>
                          <p className="mt-0.5 font-medium">
                            {chosenAltRow ? (
                              <>
                                <span className="text-sky-800/90">Alternative retenue · </span>
                                <strong>{one(chosenAltRow.products)?.name ?? "Produit"}</strong>
                              </>
                            ) : (
                              <>
                                <span className="text-sky-800/90">Produit principal retenu · </span>
                                <strong>{prod?.name ?? "Produit"}</strong>
                              </>
                            )}
                            <span className="text-sky-900/80">
                              {" "}
                              · Quantité <strong>{row.selected_qty ?? row.requested_qty}</strong>
                            </span>
                          </p>
                          {chosenAltId && !chosenAltRow ? (
                            <p className="mt-1 text-[10px] text-amber-900/90">
                              Réf. alternative en base introuvable dans la liste affichée — vérifiez les alternatives de la ligne.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {canManageSupply && selected && !lineLockedTrace && request.status !== "completed" ? (
                        <div className="flex flex-wrap gap-1.5 rounded-md border border-amber-400/85 bg-amber-50/80 px-1.5 py-1 text-[10px] text-amber-950 shadow-sm ring-1 ring-amber-200/55">
                          {!row.withdrawn_after_confirm ? (
                            <button
                              type="button"
                              disabled={!canEditThisRow || busy || supplyConfirmBusy}
                              onClick={() => {
                                setError("");
                                patchItemDraft(row.id, {
                                  withdrawn_after_confirm: true,
                                  fulfillment_draft: "unset",
                                });
                                setLineModifyConsent((p) => ({
                                  ...p,
                                  [row.id]: p[row.id] ?? { channel: "phone_call", motive: "" },
                                }));
                              }}
                              className="rounded-md border border-amber-600/90 bg-white px-2 py-1 text-[10px] font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
                            >
                              Écarter (accord patient)…
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canEditThisRow || busy || supplyConfirmBusy}
                              onClick={() => {
                                setError("");
                                const d = buildItemDraftFromRow({ ...row, withdrawn_after_confirm: false });
                                patchItemDraft(row.id, d);
                                setLineModifyConsent((p) => ({
                                  ...p,
                                  [row.id]: p[row.id] ?? { channel: "phone_call", motive: "" },
                                }));
                              }}
                              className="rounded-md border border-amber-600/90 bg-white px-2 py-1 text-[10px] font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
                            >
                              Réintégrer (accord patient)…
                            </button>
                          )}
                        </div>
                      ) : null}
                      {canManageSupply && selected && !lineLockedTrace && withdrawnDraft ? (
                        <div className="rounded-md border border-amber-500/85 bg-gradient-to-br from-amber-100/95 to-orange-50/80 px-1.5 py-1 text-[10px] text-amber-950 shadow-sm ring-1 ring-amber-300/50">
                          <strong className="font-semibold">Ligne écartée</strong> après validation&nbsp;: aucun statut réservé / commandé
                          ne s’applique ici.
                        </div>
                      ) : null}
                      {canManageSupply &&
                      selected &&
                      !lineLockedTrace &&
                      request.status !== "completed" &&
                      !row.withdrawn_after_confirm ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2 rounded-md border border-sky-300/80 bg-sky-50/90 px-1.5 py-1 text-[10px] text-sky-950">
                          <span className="text-[8px] font-bold uppercase tracking-wide text-sky-900/90">
                            Qté validée (patient)
                          </span>
                          <div className="inline-flex items-center gap-1 rounded-md border border-sky-400/60 bg-white px-0.5 py-0.5">
                            <button
                              type="button"
                              disabled={!canEditThisRow || busy}
                              className="size-7 rounded border border-sky-200 bg-sky-50 text-sm font-bold text-sky-950 hover:bg-sky-100 disabled:opacity-40"
                              aria-label="Diminuer la quantité validée"
                              onClick={() => {
                                const cap = Math.min(10, Math.max(1, row.requested_qty));
                                const cur = Math.min(cap, Math.max(1, Number(f.selected_qty_str) || 1));
                                setField(row.id, "selected_qty_str", String(Math.max(1, cur - 1)));
                              }}
                            >
                              −
                            </button>
                            <span className="min-w-[1.5rem] text-center text-[11px] font-bold tabular-nums">
                              {Math.min(
                                Math.min(10, Math.max(1, row.requested_qty)),
                                Math.max(1, Number(f.selected_qty_str) || 1)
                              )}
                            </span>
                            <button
                              type="button"
                              disabled={!canEditThisRow || busy}
                              className="size-7 rounded border border-sky-200 bg-sky-50 text-sm font-bold text-sky-950 hover:bg-sky-100 disabled:opacity-40"
                              aria-label="Augmenter la quantité validée"
                              onClick={() => {
                                const cap = Math.min(10, Math.max(1, row.requested_qty));
                                const cur = Math.min(cap, Math.max(1, Number(f.selected_qty_str) || 1));
                                setField(row.id, "selected_qty_str", String(Math.min(cap, cur + 1)));
                              }}
                            >
                              +
                            </button>
                          </div>
                          <span className="text-[9px] leading-tight text-sky-900/85">
                            Max {Math.min(10, Math.max(1, row.requested_qty))} · inclus dans «&nbsp;Enregistrer avec traçabilité&nbsp;»
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {showCommentBand ? (
                    <div
                      className={clsx(
                        "border-b px-2.5 py-2 sm:px-3",
                        isProposedLine ? "border-violet-200/40 bg-white/40" : "border-slate-100/90 bg-muted/10"
                      )}
                    >
                      {patientLineCc ? (
                        <div className="space-y-2 rounded-xl border border-sky-300/55 bg-gradient-to-br from-sky-50/90 to-white px-2.5 py-2 shadow-sm sm:px-3">
                          <div className="flex flex-col gap-2">
                            <p className="min-w-0 text-[11px] leading-snug text-sky-950">
                              <span className="block text-[9px] font-bold uppercase tracking-wide text-sky-800/95">
                                Commentaire patient
                              </span>
                              <span className="mt-0.5 block whitespace-pre-wrap break-words text-[12px] sm:text-[11px]">
                                {patientLineCc}
                              </span>
                            </p>
                            {showLineReactControl ? (
                              <div className="flex shrink-0 justify-end border-t border-sky-100/80 pt-2 sm:border-0 sm:pt-0">
                                <PharmacistLineReactControl
                                  lineId={row.id}
                                  pharmacistReply={
                                    canEditThisRow ? f.pharmacist_comment : row.pharmacist_comment ?? ""
                                  }
                                  disabled={busy || replyPersistBusyRowId === row.id}
                                  onReplyChange={(text) => {
                                    if (canEditThisRow) {
                                      setField(row.id, "pharmacist_comment", text);
                                      return;
                                    }
                                    void saveFrozenPharmacistLineReaction(row.id, text);
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>
                          {(canEditThisRow ? f.pharmacist_comment?.trim() : row.pharmacist_comment?.trim()) ? (
                            <p className="rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2 py-1.5 text-[10px] leading-snug text-emerald-950">
                              <span className="font-bold text-emerald-900">Réponse officine · </span>
                              {(canEditThisRow ? f.pharmacist_comment : row.pharmacist_comment)?.trim()}
                            </p>
                          ) : null}
                        </div>
                      ) : canEditThisRow ? (
                        <textarea
                          aria-label="Note pour le patient, visible avec votre réponse (optionnel)"
                          rows={2}
                          value={f.pharmacist_comment}
                          onChange={(e) => setField(row.id, "pharmacist_comment", e.target.value.slice(0, 1000))}
                          placeholder="Note optionnelle, visible avec votre réponse"
                          className="w-full resize-y touch-manipulation rounded-xl border-2 border-emerald-200/70 bg-emerald-50/30 px-3 py-2 text-[13px] leading-snug placeholder:text-muted-foreground/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 sm:text-sm"
                        />
                      ) : pharmaNotePreview ? (
                        <p className="rounded-lg border border-border/70 bg-muted/25 px-2.5 py-1.5 text-[10px] leading-snug text-muted-foreground">
                          <span className="font-semibold text-foreground">Note officine · </span>
                          {pharmaNotePreview}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {lineLockedTrace ? (
                    <div className="space-y-1.5 border-t border-rose-200/50 bg-rose-50/20 px-2 py-1.5 text-[10px] leading-snug text-foreground">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-rose-950">
                        Lecture seule · {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                      </p>
                      {row.counter_cancel_detail ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Détail : </span>
                          {row.counter_cancel_detail}
                        </p>
                      ) : null}
                      <p>
                        <span className="text-muted-foreground">Dispo renseignée : </span>
                        <strong>{row.availability_status ? availabilityStatusFr[row.availability_status] : "—"}</strong>
                        {row.availability_status === "to_order" && row.expected_availability_date ? (
                          <span className="text-muted-foreground"> · Prévu le {row.expected_availability_date}</span>
                        ) : null}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Qté disponible : </span>
                        <strong>{row.available_qty != null ? row.available_qty : "—"}</strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Prix MAD : </span>
                        <strong>{row.unit_price != null ? Number(row.unit_price).toFixed(2) : "—"}</strong>
                      </p>
                      {row.pharmacist_comment ? (
                        <p className="whitespace-pre-wrap text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Note enregistrée : </span>
                          {row.pharmacist_comment}
                        </p>
                      ) : null}
                    </div>
                  ) : showLineAndPublishEdits ? (
                    <div className="space-y-1.5 px-2 py-2 sm:space-y-2 sm:px-3 sm:py-2.5">
                      <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
                        <div className="flex min-w-[9.5rem] flex-1 flex-col gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Disponibilité
                          </span>
                          <PharmacienAvailabilityDropdown
                            rowId={row.id}
                            disabled={!canEditThisRow}
                            menuOpen={availabilityMenuRowId === row.id}
                            onOpenChange={(open) =>
                              setAvailabilityMenuRowId((cur) =>
                                open ? row.id : cur === row.id ? null : cur
                              )
                            }
                            draftStatus={f.availability_status}
                            requestedQty={row.requested_qty}
                            availableQtyStr={f.available_qty}
                            isProposedLine={row.line_source === "pharmacist_proposed"}
                            options={availabilityOptions}
                            onPick={(v) => setAvailabilityStatus(row, v)}
                          />
                        </div>
                        <label className="flex w-[5.5rem] flex-col gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Stock</span>
                          <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
                            <button
                              type="button"
                              disabled={stockMinusDisabled}
                              onClick={() => nudgeAvailableQty(row, -1)}
                              className="h-full w-8 border-r border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                              aria-label="Diminuer la quantité"
                            >
                              −
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              disabled={!canEditThisRow || f.availability_status === "market_shortage" || f.availability_status === "to_order"}
                              value={f.available_qty}
                              onChange={(e) => setAvailableQty(row, e.target.value)}
                              className={clsx(
                                "h-full w-full min-w-[2rem] border-0 bg-transparent px-1 text-center text-[12px] font-semibold tabular-nums focus:outline-none",
                                f.availability_status === "market_shortage" && "bg-muted text-muted-foreground",
                                f.availability_status === "to_order" && "cursor-not-allowed bg-muted/50 text-muted-foreground"
                              )}
                            />
                            <button
                              type="button"
                              disabled={stockPlusDisabled}
                              onClick={() => nudgeAvailableQty(row, 1)}
                              className="h-full w-8 border-l border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                              aria-label="Augmenter la quantité"
                            >
                              +
                            </button>
                          </div>
                        </label>
                        <label className="flex min-w-[5rem] flex-1 flex-col gap-0.5 sm:max-w-[7rem]">
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Prix <span className="normal-case opacity-70">MAD</span>
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            disabled
                            value={f.unit_price}
                            title={linePph ? `PPH catalogue : ${linePph}` : undefined}
                            className="h-9 w-full rounded-xl border border-dashed border-border bg-muted/30 px-2 text-[12px] font-semibold tabular-nums opacity-80"
                          />
                        </label>
                      </div>
                      {canEditThisRow && f.availability_status === "to_order" ? (
                        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-[9px] leading-snug text-amber-950">
                          <strong>À commander</strong> ·{" "}
                          {isProposedLine ? (
                            <>
                              quantité pour cette ligne : <strong className="tabular-nums">{f.available_qty || row.requested_qty}</strong> (min. 1) —
                              le stock ne peut pas être modifié en « À commander » ; repassez en « Disponible » pour ajuster.
                            </>
                          ) : (
                            <>
                              la quantité reste forcément{" "}
                              <strong className="tabular-nums">{row.requested_qty}</strong> (demande client) — aucune modification du stock n&apos;est
                              possible ici.
                            </>
                          )}
                        </p>
                      ) : null}
                      {canEditThisRow &&
                      f.availability_status !== "market_shortage" &&
                      f.availability_status !== "unavailable" &&
                      f.availability_status !== "to_order"
                        ? isProposedLine ? (
                          <p className="text-[9px] leading-snug text-violet-900/90">
                            <strong>Proposition officine</strong> · stock minimum <strong>1</strong>, sans plafond lié à la quantité initialement
                            indiquée sur la ligne.
                          </p>
                        ) : (
                          <p className="text-[9px] leading-snug text-muted-foreground">
                            Stock · max.&nbsp;
                            <strong className="text-foreground">{stockCeiling}</strong>
                            {" "}(≤ quantité demandée&nbsp;
                            <strong className="text-foreground">{row.requested_qty}</strong>
                            ).
                            {request.status === "confirmed" &&
                            row.is_selected_by_patient &&
                            (row.counter_outcome ?? "unset") !== "picked_up" &&
                            maxPreparationQtyForRow(row) < row.requested_qty ? (
                              <span className="text-muted-foreground">
                                {" "}
                                Au comptoir, plafonné à <strong className="text-foreground">{maxPreparationQtyForRow(row)}</strong> jusqu&apos;à
                                récupération.
                              </span>
                            ) : null}
                          </p>
                        )
                      : null}

                      {f.availability_status === "to_order" ? (
                        <label className="flex max-w-sm flex-col gap-0">
                          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Date prévision commande
                          </span>
                          <input
                            type="date"
                            disabled={!canEditThisRow}
                            value={f.expected_availability_date}
                            onChange={(e) => setField(row.id, "expected_availability_date", e.target.value)}
                            className="h-7 w-full rounded border border-input bg-background px-1.5 text-[11px] shadow-sm disabled:opacity-60 sm:w-auto sm:min-w-[9rem]"
                          />
                        </label>
                      ) : null}
                    </div>
                  ) : (
                    <div className="border-t border-slate-100/90 bg-slate-50/30 px-3 py-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                        {respondedFrozenView
                          ? "Réponse publiée · lecture seule"
                          : "Lecture seule · dossier non modifiable"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-background px-2 py-1 text-[11px] font-medium shadow-sm tabular-nums">
                          <Package className="size-3.5 text-muted-foreground" aria-hidden />
                          Qté&nbsp;
                          <strong>{row.available_qty != null ? row.available_qty : "—"}</strong>
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-xl border border-border/70 bg-background px-2 py-1 text-[11px] font-medium shadow-sm tabular-nums">
                          <span className="text-[10px] text-muted-foreground">MAD</span>
                          <strong>{row.unit_price != null ? Number(row.unit_price).toFixed(2) : "—"}</strong>
                        </span>
                        {row.availability_status === "to_order" && row.expected_availability_date ? (
                          <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200/80 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950">
                            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                            {formatDateShortFr(row.expected_availability_date)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}

                  <div className="mx-2 mb-2 mt-1.5 overflow-hidden rounded-xl border border-teal-200/55 border-l-[3px] border-l-teal-500/65 bg-gradient-to-br from-teal-50/50 via-cyan-50/25 to-transparent pl-2.5 pr-2 pb-1.5 pt-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:mx-3 sm:mt-2 sm:pl-3 sm:pb-2 sm:pt-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-expanded={isAltOpen(row.id)}
                        onClick={() => toggleAltOpen(row.id)}
                        className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl bg-white/90 px-2.5 py-2 text-left ring-1 ring-teal-200/40 shadow-sm backdrop-blur-[2px] transition hover:bg-white"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Layers className="size-4 shrink-0 text-teal-600" strokeWidth={2} aria-hidden />
                          <span className="truncate text-[11px] font-semibold text-teal-950">
                            <span className="text-teal-800/85">Alternatives </span>
                            <span className="font-mono tabular-nums text-teal-700">
                              {rowAlts.length}/3
                            </span>
                          </span>
                        </span>
                        <ChevronDown
                          className={clsx("size-[18px] shrink-0 text-teal-600 transition-transform duration-200", isAltOpen(row.id) && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                      {canEditThisRow && rowAlts.length < 3 && altPickerOpenFor !== row.id ? (
                        <button
                          type="button"
                          disabled={altBusyRow === row.id}
                          title="Ajouter une alternative"
                          aria-label="Ajouter une alternative"
                          onClick={() => {
                            setAltPickerOpenFor(row.id);
                            setAltQuery("");
                            setAltHits([]);
                            setAltRowsOpen((prev) => ({ ...prev, [row.id]: true }));
                          }}
                          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm ring-1 ring-teal-500/35 transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
                        </button>
                      ) : null}
                    </div>

                    {canEditThisRow && rowAlts.length < 3 && altPickerOpenFor === row.id ? (
                      <div className="mt-2 rounded-xl border-2 border-teal-400/55 bg-white p-2.5 shadow-md ring-2 ring-teal-200/35">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-950">
                            <Search className="size-3.5 shrink-0 text-teal-600" aria-hidden />
                            Catalogue alternatives
                          </span>
                          <button
                            type="button"
                            className="rounded-md px-2 py-0.5 text-[10px] font-medium text-teal-800 hover:bg-teal-100/70"
                            onClick={resetAltPicker}
                          >
                            Fermer
                          </button>
                        </div>
                        <div className="relative mt-2">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-teal-600/90"
                            aria-hidden
                          />
                          <input
                            type="search"
                            value={altQuery}
                            onChange={(e) => setAltQuery(e.target.value)}
                            placeholder="Rechercher un produit (2 car. min.)"
                            className="h-10 w-full rounded-xl border-2 border-teal-400/50 bg-background py-2 pl-10 pr-3 text-[13px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/35"
                          />
                        </div>
                        {altVisibleHits.length > 0 ? (
                          <ul className="mt-1 max-h-[11rem] space-y-0.5 overflow-auto rounded-xl border border-border/70 bg-card p-1 shadow-inner ring-1 ring-teal-200/35">
                            {altVisibleHits.map((h) => (
                              <li key={h.id}>
                                <button
                                  type="button"
                                  disabled={altBusyRow === row.id}
                                  onClick={() => void insertAlternative(row, h)}
                                  className="flex w-full flex-col rounded-lg px-2.5 py-2 text-left text-[11px] transition hover:bg-muted/65 active:bg-muted/80 disabled:opacity-50"
                                >
                                  <span className="font-semibold leading-tight text-foreground">{h.name}</span>
                                  {pphLabel(h.price_pph) ? (
                                    <span className="mt-0.5 text-[10px] font-semibold text-primary">{pphLabel(h.price_pph)}</span>
                                  ) : null}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : altDebounced.length >= 2 ? (
                          <p className="mt-1 text-[10px] text-teal-800/80">Aucun résultat.</p>
                        ) : null}
                      </div>
                    ) : null}

                    {isAltOpen(row.id) ? (
                      <div className="mt-2 border-t border-teal-200/40 pt-2">
                        {rowAlts.length === 0 ? (
                          <p className="text-[10px] leading-snug text-teal-900/85">Pas encore d&apos;alternative sur cette ligne.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {rowAlts.map((alt) => {
                              const altProd = one(alt.products);
                              const altName = altProd?.name ?? "Alternative";
                              const altPph = pphLabel(altProd?.price_pph);
                              const chosenAltId = row.patient_chosen_alternative_id ?? null;
                              const patientChoseHere =
                                request.status === "confirmed" &&
                                selected &&
                                chosenAltId != null &&
                                chosenAltId === alt.id;
                              const showIndicatif =
                                request.status === "confirmed" && selected && rowAlts.length > 0 && !patientChoseHere;
                              return (
                                <li
                                  key={alt.id}
                                  className={clsx(
                                    "flex items-center justify-between gap-2 rounded-xl border px-2 py-1.5 text-[10px] shadow-sm ring-1",
                                    patientChoseHere
                                      ? "border-emerald-300/70 bg-emerald-50/80 ring-emerald-200/50"
                                      : showIndicatif
                                        ? "border-teal-200/35 bg-white/50 opacity-70 ring-transparent"
                                        : "border-teal-200/50 bg-white/95 ring-teal-100/60"
                                  )}
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-teal-200/50 bg-teal-50/50">
                                      {altProd?.photo_url ? (
                                        <img src={altProd.photo_url} alt={altName} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-teal-600/70">
                                          <Layers className="size-5" aria-hidden />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-semibold text-teal-950">{altName}</p>
                                      <p className="mt-0.5 text-[10px] text-teal-800/85">
                                        #{alt.rank} · Qté {row.requested_qty}
                                        {altPph ? <span className="text-teal-700"> · {altPph}</span> : null}
                                      </p>
                                    </div>
                                  </div>
                                  {canEditThisRow ? (
                                    <button
                                      type="button"
                                      disabled={altBusyRow === alt.id}
                                      onClick={() => void deleteAlternativeRow(alt.id, row.id)}
                                      className="shrink-0 rounded-lg border border-rose-200/80 bg-rose-50/80 px-2 py-1 text-[9px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                                    >
                                      Retirer
                                    </button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {showInlineCounter ? (
                    <div className="border-t border-slate-100 bg-slate-50/25 px-3 py-2">
                      {!selected ? (
                        <p className="text-[10px] text-muted-foreground">
                          Patient n&apos;ayant pas retenu cette ligne après votre réponse. État au comptoir :{" "}
                          <strong className="text-foreground">
                            {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                          </strong>
                        </p>
                      ) : co === "cancelled_at_counter" ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                        </p>
                      ) : (row.counter_outcome ?? "unset") === "picked_up" ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          Récupéré — plus modifiable.
                        </p>
                      ) : (
                        <div className="flex max-w-[320px] flex-col gap-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Résultat comptoir
                          </p>
                          <label className="flex flex-col gap-0.5 text-[10px] font-normal text-muted-foreground">
                            <span className="text-[9px] font-semibold uppercase tracking-wide">État</span>
                            <select
                              value={counterSelectKeyNormalized(row, draft[row.id] ?? buildItemDraftFromRow(row))}
                              disabled={outcomeSelectDisabled}
                              onChange={(e) => {
                                const v = e.target.value as "unset" | "picked_up";
                                void saveCounterOutcome(row.id, v, null, null);
                              }}
                              className={`h-7 w-full rounded border border-input bg-background px-1.5 text-[11px] ${
                                request.status === "completed" ? "cursor-not-allowed opacity-60" : ""
                              }`}
                            >
                              <option value="unset">En attente</option>
                              <option value="picked_up">Récupéré</option>
                            </select>
                          </label>
                          {counterBusyId === row.id ? (
                            <span className="text-[10px] text-muted-foreground">Enregistrement…</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                  </li>
                </Fragment>
              );
            })}
          </ul>

          {showLineAndPublishEdits ? (
            <section className="mt-2 rounded-xl border border-violet-300/70 bg-gradient-to-br from-violet-50/80 via-fuchsia-50/35 to-white px-2 py-1.5 shadow-sm ring-1 ring-violet-300/35 sm:px-2.5 sm:py-2">
              <button
                type="button"
                aria-expanded={propOpen}
                onClick={() => {
                  const next = !propOpen;
                  setPropOpen(next);
                  setError("");
                  if (next) resetPropForm();
                }}
                className="flex w-full min-h-11 items-start justify-between gap-2 rounded-lg bg-white/90 px-2 py-2 text-left ring-1 ring-violet-200/55 shadow-sm transition hover:bg-violet-50/60 sm:min-h-0 sm:items-center sm:px-2.5"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-violet-950">Proposer un produit</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-violet-900/85 sm:text-[11px]">
                    Une ligne après la liste — motif et catalogue ci-dessous.
                  </span>
                </span>
                <ChevronDown
                  className={clsx("mx-px size-6 shrink-0 text-violet-700 transition-transform sm:size-5", propOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {propOpen ? (
                <div className="mt-2 space-y-1.5">
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Motif
                    <textarea
                      rows={2}
                      value={propReason}
                      onChange={(e) => setPropReason(e.target.value.slice(0, 1000))}
                      placeholder="Motif visible client"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Quantité
                    <div className="mt-1 flex h-8 w-32 items-center overflow-hidden rounded-md border border-input bg-background">
                      <button
                        type="button"
                        onClick={() => setPropQty((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)))}
                        className="h-full w-7 border-r border-input text-xs font-bold text-muted-foreground"
                        aria-label="Diminuer la quantité proposée"
                      >
                        −
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={propQty}
                        onChange={(e) => setPropQty(e.target.value.replace(/[^\d]/g, ""))}
                        className="h-full w-full border-0 px-2 text-xs tabular-nums focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setPropQty((q) => String(Math.min(10, (parseInt(q, 10) || 1) + 1)))}
                        className="h-full w-7 border-l border-input text-xs font-bold text-muted-foreground"
                        aria-label="Augmenter la quantité proposée"
                      >
                        +
                      </button>
                    </div>
                  </label>
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[1.125rem] -translate-y-1/2 text-violet-600"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={propQuery}
                      onChange={(e) => setPropQuery(e.target.value)}
                      placeholder="Rechercher dans le catalogue (2 caractères min.)"
                      className="h-11 w-full rounded-xl border-2 border-violet-400/70 bg-white py-2 pl-10 pr-3 text-[13px] shadow-sm ring-2 ring-violet-200/50 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
                    />
                  </div>
                  {propVisibleHits.length > 0 ? (
                    <ul className="max-h-36 space-y-0.5 overflow-auto rounded-md border border-border/60 bg-muted/20 p-1">
                      {propVisibleHits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            disabled={propBusy}
                            onClick={() => void insertPharmacistProposedLine(h)}
                            className="flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm hover:bg-card disabled:opacity-50"
                          >
                            <span className="font-medium text-foreground">{h.name}</span>
                            {pphLabel(h.price_pph) ? (
                              <span className="text-[11px] font-medium text-teal-800">{pphLabel(h.price_pph)}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : propDebounced.length >= 2 ? (
                    <p className="text-[11px] text-muted-foreground">Aucun résultat.</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {showLineAndPublishEdits ? (
            <section className="mt-2 rounded-xl border-2 border-violet-200/60 bg-gradient-to-br from-violet-50/40 via-card to-card px-3 py-2 shadow-sm sm:px-3 sm:py-2">
              <label className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="size-3 text-violet-600" aria-hidden />
                  Commentaire général pour le patient
                </span>
                <textarea
                  rows={3}
                  value={globalComment}
                  onChange={(e) => setGlobalComment(e.target.value.slice(0, 1200))}
                  placeholder="Message global (optionnel), visible avec la réponse"
                  className="mt-2 min-h-[5.5rem] w-full rounded-xl border-2 border-violet-200/70 bg-background px-3 py-2.5 text-[13px] leading-relaxed shadow-inner placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 sm:min-h-0 sm:text-xs sm:leading-normal"
                />
              </label>
            </section>
          ) : null}

          {respondedFrozenView ? (
            <section className="mt-3 space-y-2 rounded-xl border border-amber-200/85 bg-amber-50/50 p-2.5 shadow-sm sm:mt-4 sm:p-3">
              <button
                type="button"
                onClick={() => {
                  resetDraftFromRows();
                  setGlobalComment(initialGlobalComment);
                  setPendingProposalRows([]);
                  setPendingAlternatives([]);
                  setRespondedEditMode(true);
                }}
                className="inline-flex h-10 min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-md border border-amber-400/90 bg-white px-3 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50/90 sm:min-h-10 sm:text-sm"
              >
                <Pencil className="size-[15px] shrink-0" strokeWidth={2} aria-hidden />
                Modifier la réponse
              </button>
              <p className="text-center text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                Lecture seule pour le patient jusqu’à modification. L’annulation de la demande reste disponible ci-dessous.
              </p>
            </section>
          ) : null}

          {showLineAndPublishEdits ? (
            <section className="mt-3 space-y-2 sm:mt-4">
              {canEditResponse ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void publishResponse()}
                  className="inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl bg-emerald-700 px-6 py-3 text-base font-bold tracking-tight text-white shadow-lg ring-2 ring-emerald-900/15 transition hover:bg-emerald-800 hover:shadow-xl disabled:opacity-50 sm:min-h-[3.5rem] sm:text-[1.05rem]"
                >
                  {busy ? "Publication…" : "Envoyer la réponse au patient"}
                </button>
              ) : null}
              {canManageResponded && respondedEditMode ? (
                <div className="rounded-xl border border-amber-400/90 bg-gradient-to-br from-amber-50 via-orange-50/50 to-background p-2.5 shadow-sm ring-1 ring-amber-300/40 sm:p-3">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveRespondedAdjustments()}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-600 bg-amber-100/95 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-200/80 disabled:opacity-50"
                    >
                      {busy ? "Enregistrement…" : "Enregistrer les changements"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        resetDraftFromRows();
                        setGlobalComment(initialGlobalComment);
                        setRespondedEditMode(false);
                        setPendingProposalRows([]);
                        setPendingAlternatives([]);
                      }}
                      className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-amber-400/90 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50/90 disabled:opacity-50"
                    >
                      Annuler les modifications
                    </button>
                  </div>
                </div>
              ) : null}
              {canManageSupply ? (
                <div className="space-y-2 rounded-xl border border-sky-400/85 bg-gradient-to-br from-sky-50 via-white to-white p-3 shadow-sm ring-1 ring-sky-400/55 sm:p-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startSaveConfirmedAdjustments()}
                      className="inline-flex h-11 min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl border border-sky-700/80 bg-sky-950 px-4 text-[13px] font-bold text-white shadow-md transition hover:bg-sky-900 disabled:opacity-50 sm:min-w-[220px] sm:text-sm"
                    >
                      {busy ? "Enregistrement…" : "Enregistrer les modifications"}
                    </button>
                    {(request.status === "confirmed" || request.status === "processing") &&
                    declarationTreatedEligible &&
                    request.request_type === "product_request" ? (
                      <button
                        type="button"
                        disabled={declareTreatedBusy}
                        onClick={() => void runDeclareRequestTreated()}
                        title="Déclare la demande prête côté officine (le dossier reste lisible de la même façon)"
                        className="inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-xl border border-cyan-500/95 bg-white px-5 text-center text-sm font-semibold leading-tight text-cyan-950 shadow-sm transition hover:bg-cyan-50 disabled:opacity-50 sm:max-w-[220px] sm:text-[13px]"
                      >
                        {declareTreatedBusy ? (
                          "Déclaration…"
                        ) : (
                          <span className="block whitespace-nowrap">Demande prête · 100&nbsp;%</span>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>
          ) : !respondedFrozenView ? (
            <p className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
              {request.status === "confirmed" || request.status === "processing"
                ? "Passage dossier après validation : vérifiez les blocs, les réservations/commandes puis le suivi au comptoir."
                : request.status === "treated"
                  ? "Déclarez les retraits au comptoir puis clôturer quand tous les événements du comptoir sont renseignés."
                  : request.status === "completed"
                    ? "Dossier clôturé côté comptoir ; les lignes restent lisibles sans modification."
                    : `Statut : ${requestStatusFr[request.status] ?? request.status}.`}
            </p>
          ) : null}

          {(request.status === "confirmed" || request.status === "processing" || request.status === "treated") &&
          items.length > 0 ? (
            <section className="mt-2">
              <button
                type="button"
                disabled={completeBusy || !canCompleteCounter}
                onClick={() => void runCompleteAfterCounter()}
                className={`w-full rounded-md py-2 text-xs font-semibold disabled:opacity-50 sm:text-sm ${
                  canCompleteCounter
                    ? "bg-foreground text-background shadow-sm"
                    : "border border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                {completeBusy ? "Clôture…" : "Clôturer le dossier (comptoir OK)"}
              </button>
              {!canCompleteCounter ? (
                <p className="mt-2 text-[11px] text-amber-900">
                  Enregistrez au moins une ligne retenue comme « Récupéré » au comptoir pour activer la clôture.
                </p>
              ) : counterClosurePendingTracked > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {counterClosurePendingTracked} ligne(s) encore en attente au comptoir — la confirmation vous le rappellera.
                </p>
              ) : null}
            </section>
          ) : null}

          {(request.status === "submitted" ||
            request.status === "in_review" ||
            request.status === "responded" ||
            request.status === "confirmed" ||
            request.status === "processing" ||
            request.status === "treated") ? (
            <CompactCard className="mt-3 border-rose-200/60 bg-rose-50/[0.35] shadow-sm">
              <CompactCardHeader title="Annuler cette demande" className="border-rose-200/50 bg-rose-100/40" />
              <CompactCardBody className="space-y-2 px-3 py-2.5 text-xs sm:px-3.5">
                <p className="text-[11px] text-rose-950/80">
                  Annulation définitive par la pharmacie avec motif (obligatoire, ≥ 5 caractères). Le patient sera notifié.
                </p>
                <label className="block text-[11px] font-medium text-rose-950">
                  Motif visible dans l&apos;historique
                  <textarea
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value.slice(0, 1000))}
                    placeholder="Ex. demande dupliquée, erreur de saisie, indisponibilité prolongée…"
                    className="mt-1 w-full rounded-lg border border-rose-200/60 bg-background px-2 py-1.5 text-xs shadow-sm"
                  />
                </label>
                <button
                  type="button"
                  disabled={cancelBusy || cancelReason.trim().length < 5}
                  onClick={() => void runPharmacistCancelRequest()}
                  className="w-full rounded-lg border border-rose-400/60 bg-background py-2.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {cancelBusy ? "Annulation…" : "Annuler définitivement cette demande"}
                </button>
              </CompactCardBody>
            </CompactCard>
          ) : null}

          <section className="mt-3 rounded-lg border border-border/70 bg-card p-2.5 shadow-sm">
            <button
              type="button"
              onClick={() => {
                const next = !historyOpen;
                setHistoryOpen(next);
                if (next && historyRows.length === 0 && !historyBusy) {
                  void loadHistory();
                }
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-semibold text-foreground hover:bg-muted/40"
            >
              {historyOpen ? "Masquer l'historique" : "Voir l'historique"}
            </button>
            {historyOpen ? (
              <div className="mt-2 space-y-1.5">
                {historyBusy ? (
                  <p className="text-xs text-muted-foreground">Chargement…</p>
                ) : historyRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun événement.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {historyRows.map((h) => (
                      <li key={h.id} className="rounded-lg border border-border/60 bg-muted/15 px-2 py-1.5 text-xs">
                        <p className="font-medium text-foreground">
                          {h.old_status ? `${requestStatusFr[h.old_status] ?? h.old_status} → ` : ""}
                          {requestStatusFr[h.new_status] ?? h.new_status}
                        </p>
                        {h.reason ? (
                          <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">Motif/contexte : </span>
                            {h.reason}
                          </p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>
                            Par <strong className="font-medium text-foreground">{historyActorLabel("pharmacien", h.reason)}</strong>
                          </span>
                          <span aria-hidden>·</span>
                          <time dateTime={h.created_at} className="tabular-nums">
                            {formatDateTimeShort24hFr(h.created_at)}
                          </time>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
            </>
          )}
        </>
      )}
      <PharmacistSupplyAmendmentConfirmModal
        open={supplyConfirmOpen}
        onClose={() => {
          if (supplyConfirmBusy) return;
          setSupplyConfirmOpen(false);
          setSupplyConfirmPending(null);
        }}
        heading={
          supplyConfirmPending?.kind === "unlock_modify"
            ? "Autoriser la modification de la ligne"
            : "Ajouter un produit après validation"
        }
        intro={
          supplyConfirmPending?.kind === "unlock_modify"
            ? "Le canal et la précision optionnelle sont enregistrés pour le patient."
            : "Indiquez comment le patient a donné son accord."
        }
        blocks={supplyConfirmBlocks}
        confirmLabel={supplyConfirmPending?.kind === "add_line" ? "Valider et enregistrer" : "Valider"}
        busy={supplyConfirmBusy}
        onConfirm={(fills) => void applySupplyModalConfirm(fills)}
      />
      <LineHistoryModalFr
        open={pharmaHistoryRowId != null}
        title={
          pharmaHistoryRowId
            ? validatedProductLabel(items.find((i) => i.id === pharmaHistoryRowId) as PatientLineLike)
            : ""
        }
        blocks={pharmaHistoryBlocks}
        onClose={() => setPharmaHistoryRowId(null)}
      />
    </PageShell>
  );
}
