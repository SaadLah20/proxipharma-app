"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateShortFr, formatTime24hFr } from "@/lib/datetime-fr";
import {
  PATIENT_CANCEL_REASON_CODES,
  PATIENT_CANCEL_REASON_LABELS,
  type PatientCancelReasonCode,
} from "@/lib/patient-flow-reasons";
import { availabilityStatusFr, counterOutcomeFr, requestItemLineSourceFr } from "@/lib/request-display";
import { plannedVisitWindow } from "@/lib/planned-visit";
import { unitPriceLabel } from "@/lib/product-price";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/embed";

type ProdBrief = { name: string; price_pph?: number | null };

export type ActionItemAltRow = {
  id: string;
  rank: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdBrief | ProdBrief[] | null;
};

export type ActionItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  selected_qty: number | null;
  is_selected_by_patient: boolean;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  /** Q11 note patient par ligne */
  client_comment?: string | null;
  /** Q20 */
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
  counter_outcome: string;
  expected_availability_date: string | null;
  products: ProdBrief | ProdBrief[] | null;
  patient_chosen_alternative_id?: string | null;
  request_item_alternatives?: ActionItemAltRow | ActionItemAltRow[] | null;
};

/** null = rien pour cette ligne ; "principal" ; sinon id alternative */
export type LineBranch = null | "principal" | string;

export type LineSelState = { branch: LineBranch; qty: number };

function normalizeAlternatives(raw: ActionItemAltRow | ActionItemAltRow[] | null | undefined): ActionItemAltRow[] {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw].sort((a, b) => a.rank - b.rank) : [raw];
}

function isMarketShortage(st: string | null | undefined): boolean {
  return st === "market_shortage";
}

function maxQtyPrincipal(row: ActionItemRow): number {
  if (isMarketShortage(row.availability_status)) return 0;
  let cap = row.requested_qty;
  if (row.available_qty != null) cap = Math.min(cap, row.available_qty);
  return Math.max(0, cap);
}

function maxQtyAlt(row: ActionItemRow, alt: ActionItemAltRow): number {
  if (isMarketShortage(alt.availability_status)) return 0;
  let cap = row.requested_qty;
  if (alt.available_qty != null) cap = Math.min(cap, alt.available_qty);
  return Math.max(0, cap);
}

function maxQtyForBranch(row: ActionItemRow, branch: LineBranch, alts: ActionItemAltRow[]): number {
  if (branch === null) return 0;
  if (branch === "principal") return maxQtyPrincipal(row);
  const alt = alts.find((a) => a.id === branch);
  if (!alt) return 0;
  return maxQtyAlt(row, alt);
}

function counterOutcomeBadgeClass(outcome: string): string {
  switch (outcome) {
    case "picked_up":
      return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200";
    case "cancelled_at_counter":
      return "bg-rose-100 text-rose-900 ring-1 ring-rose-200";
    case "deferred_next_visit":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    default:
      return "bg-sky-100 text-sky-900 ring-1 ring-sky-200";
  }
}

/** Défaut atelier : d’abord le principal disponible, sinon première alternative disponible, sinon rien */
function pickDefaultBranch(row: ActionItemRow, alts: ActionItemAltRow[]): LineBranch {
  if (maxQtyPrincipal(row) > 0) return "principal";
  for (const alt of alts) {
    if (maxQtyAlt(row, alt) > 0) return alt.id;
  }
  return null;
}

function computeSelFromItems(items: ActionItemRow[]): Record<string, LineSelState> {
  const next: Record<string, LineSelState> = {};
  for (const row of items) {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    let branch = pickDefaultBranch(row, alts);
    let cap = maxQtyForBranch(row, branch, alts);
    if (branch !== null && cap < 1) branch = null;
    cap = maxQtyForBranch(row, branch, alts);
    const qty = branch !== null && cap > 0 ? cap : 1;
    next[row.id] = { branch, qty: branch !== null && cap > 0 ? Math.min(qty, cap) : 1 };
  }
  return next;
}

type ResubmitLine = {
  product_id: string;
  name: string;
  qty: number;
  price_pph?: number | null;
  client_comment: string;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
};

function computeResubmitLinesFromItems(items: ActionItemRow[]): ResubmitLine[] {
  return items.map((row) => ({
    product_id: row.product_id,
    name: one(row.products)?.name ?? "Produit",
    qty: Math.min(10, Math.max(1, row.requested_qty)),
    price_pph: one(row.products)?.price_pph ?? null,
    client_comment: row.client_comment ?? "",
    line_source: row.line_source ?? null,
    pharmacist_proposal_reason: row.pharmacist_proposal_reason ?? null,
  }));
}

type ProductHit = { id: string; name: string; product_type: string; laboratory: string | null; price_pph?: number | null };

type Props = {
  requestId: string;
  status: string;
  items: ActionItemRow[];
  initialPatientNote: string | null;
  initialPlannedVisitDate?: string | null;
  initialPlannedVisitTime?: string | null;
  onReload: () => Promise<void>;
};

function clampVisitYmd(ymd: string, minY: string, maxY: string): string {
  if (ymd < minY) return minY;
  if (ymd > maxY) return maxY;
  return ymd;
}

function htmlTimeToPg(t: string): string | null {
  const s = t.trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

export function PatientProductRequestActions({
  requestId,
  status,
  items,
  initialPatientNote,
  initialPlannedVisitDate,
  initialPlannedVisitTime,
  onReload,
}: Props) {
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon">("");
  const [abandonCode, setAbandonCode] = useState<PatientCancelReasonCode>("no_longer_needed");
  const [abandonDetail, setAbandonDetail] = useState("");

  /** Confirmation responded -> confirmed — reset via parent `key` when server rows change */
  const [sel, setSel] = useState(() => computeSelFromItems(items));

  /** Créneau de passage officine (`''` = défaut automatique borne min) */
  const [visitDate, setVisitDate] = useState(initialPlannedVisitDate ?? "");
  const [visitTime, setVisitTime] = useState(
    initialPlannedVisitTime ? initialPlannedVisitTime.slice(0, 5) : ""
  );

  /** Resubmit draft — idem */
  const [noteDraft, setNoteDraft] = useState(() => initialPatientNote ?? "");
  const [lines, setLines] = useState<ResubmitLine[]>(() => computeResubmitLinesFromItems(items));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [editMode, setEditMode] = useState(false);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const visitWin = useMemo(() => {
    const linesPayload = items.map((row) => {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const st = sel[row.id] ?? { branch: null, qty: 1 };
      const cap = maxQtyForBranch(row, st.branch, alts);
      return {
        capPositive: st.branch !== null && cap > 0,
        branch: st.branch,
        principalAvail: row.availability_status,
        principalEta: row.expected_availability_date ?? null,
        alternatives: alts.map((a) => ({
          id: a.id,
          availability_status: a.availability_status,
          expected_availability_date: a.expected_availability_date ?? null,
        })),
      };
    });
    return plannedVisitWindow(linesPayload);
  }, [items, sel]);

  const resolvedVisitDate = useMemo(() => {
    const t = visitDate.trim();
    if (t === "") return visitWin.minYmd;
    return clampVisitYmd(t, visitWin.minYmd, visitWin.maxYmd);
  }, [visitDate, visitWin.minYmd, visitWin.maxYmd]);

  const visibleHits = debouncedQuery.length < 2 ? [] : hits;

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${debouncedQuery}%`)
          .order("name")
          .limit(10);
        if (error || !Array.isArray(data)) {
          setHits([]);
          return;
        }
        setHits(data as ProductHit[]);
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [debouncedQuery]);

  const addProduct = (p: ProductHit) => {
    setLines((prev) => {
      if (prev.some((l) => l.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          qty: 1,
          price_pph: p.price_pph ?? null,
          client_comment: "",
          line_source: "patient_request",
          pharmacist_proposal_reason: null,
        },
      ];
    });
    setQuery("");
    setHits([]);
    setActionError("");
  };

  const setLineBranch = (itemId: string, branch: LineBranch) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const cap = maxQtyForBranch(row, branch, alts);
      const qty = branch !== null && cap > 0 ? cap : 1;
      return {
        ...s,
        [itemId]: {
          branch,
          qty: branch !== null && cap > 0 ? Math.min(Math.max(1, qty), cap) : 1,
        },
      };
    });
  };

  const setLineQty = (itemId: string, qty: number) => {
    const row = items.find((i) => i.id === itemId);
    if (!row) return;
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const branch = sel[itemId]?.branch ?? null;
    const cap = maxQtyForBranch(row, branch, alts);
    if (branch === null || cap < 1) return;
    setSel((s) => ({
      ...s,
      [itemId]: {
        ...(s[itemId] ?? { branch, qty: 1 }),
        qty: Math.min(Math.max(1, qty), cap),
      },
    }));
  };

  const togglePrincipalOnlyLine = (itemId: string, on: boolean) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const branch: LineBranch = on ? "principal" : null;
      const cap = maxQtyForBranch(row, branch, alts);
      const qty = on && cap > 0 ? cap : 1;
      return {
        ...s,
        [itemId]: {
          branch,
          qty: on && cap > 0 ? Math.min(Math.max(1, s[itemId]?.qty ?? qty), cap) : 1,
        },
      };
    });
  };

  const runConfirm = async () => {
    setActionError("");
    const payload = items.map((row) => {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const st = sel[row.id] ?? ({ branch: null, qty: 1 } satisfies LineSelState);
      const cap = maxQtyForBranch(row, st.branch, alts);
      const on = st.branch !== null && cap > 0;
      const qty = on ? Math.min(st.qty, cap) : null;
      const chosenAlt =
        on && st.branch !== null && st.branch !== "principal" ? st.branch : null;
      return {
        request_item_id: row.id,
        is_selected: on,
        selected_qty: qty,
        chosen_alternative_id: chosenAlt,
      };
    });
    const anyOn = payload.some((p) => p.is_selected);
    if (!anyOn) {
      setActionError(
        "Garde au moins une ligne sélectionnée, modifie ta liste avant renvoi, ou abandonne la demande."
      );
      return;
    }

    if (visitWin.missingEtaOnToOrder) {
      setActionError(
        "Une ligne « à commander » n’a pas de date de réception côté pharmacie. Contacte l’officine ou modifie ta sélection."
      );
      return;
    }
    const rawVisit = visitDate.trim();
    if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
      setActionError(
        visitWin.hasToOrder
          ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
          : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`
      );
      return;
    }

    setBusyAction("confirm");
    const { error } = await supabase.rpc("patient_confirm_after_response", {
      p_request_id: requestId,
      p_selections: payload.map((p) => ({
        request_item_id: p.request_item_id,
        is_selected: p.is_selected,
        selected_qty: p.selected_qty,
        chosen_alternative_id: p.chosen_alternative_id,
      })),
      p_planned_visit_date: resolvedVisitDate,
      p_planned_visit_time: htmlTimeToPg(visitTime),
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runResubmit = async () => {
    setActionError("");
    if (lines.length === 0) {
      setActionError("Ajoute au moins un produit à la liste.");
      return;
    }

    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.product_id)) {
        setActionError("Chaque produit ne peut apparaître qu’une seule fois dans ta liste.");
        return;
      }
      seen.add(l.product_id);
      if (l.qty < 1 || l.qty > 10) {
        setActionError("Les quantités doivent être entre 1 et 10 pour chaque produit.");
        return;
      }
    }

    const p_items = lines.map((l) => {
      const cc = l.client_comment.trim().slice(0, 500);
      return {
        product_id: l.product_id,
        requested_qty: l.qty,
        ...(cc.length > 0 ? { client_comment: cc } : {}),
      };
    });
    setBusyAction("resubmit");
    const { error } = await supabase.rpc("patient_resubmit_product_request_after_response", {
      p_request_id: requestId,
      p_patient_note: noteDraft.trim() === "" ? null : noteDraft.trim(),
      p_items,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runAbandon = async () => {
    const other = abandonDetail.trim();
    if (abandonCode === "other" && other.length < 8) {
      setActionError("Pour « Autre », précise en au moins 8 caractères.");
      return;
    }

    if (!globalThis.confirm("Abandonner cette demande ? Le pharmacien pourra voir cette décision dans l’historique.")) {
      return;
    }
    setActionError("");
    setBusyAction("abandon");
    const { error } = await supabase.rpc("patient_abandon_request", {
      p_request_id: requestId,
      p_reason_code: abandonCode,
      p_reason_other: abandonCode === "other" ? other : null,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const runUpdateVisit = async () => {
    setActionError("");
    const rawVisit = visitDate.trim();
    if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
      setActionError(
        visitWin.hasToOrder
          ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
          : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`
      );
      return;
    }
    setBusyAction("confirm");
    const { error } = await supabase
      .from("requests")
      .update({
        patient_planned_visit_date: resolvedVisitDate,
        patient_planned_visit_time: htmlTimeToPg(visitTime),
      })
      .eq("id", requestId)
      .eq("status", "confirmed");
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const allowed =
    status === "submitted" || status === "in_review" || status === "responded" || status === "confirmed";
  if (!allowed) return null;

  const showConfirm = status === "responded";
  const showResubmit = status === "submitted" || status === "in_review";
  const showAbandonAfterResponse = status === "responded" || status === "confirmed";
  const showConfirmedCards = status === "confirmed";

  const visitTimeFr = visitTime.trim() ? formatTime24hFr(htmlTimeToPg(visitTime) ?? visitTime) : "";

  return (
    <section className="mt-3 rounded-lg border border-border/90 bg-muted/15 p-2.5 sm:p-3">
      {actionError ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{actionError}</p>
      ) : null}

      {showConfirm ? (
        <ul className="space-y-4">
              {items.map((row) => {
                const prod = one(row.products);
                const prodUnitPrice = unitPriceLabel(prod?.price_pph);
                const altList = normalizeAlternatives(row.request_item_alternatives);
                const st = sel[row.id] ?? { branch: null, qty: 1 };
                const hasAlts = altList.length > 0;
                const capPrincipal = maxQtyPrincipal(row);
                const radioName = `line-choice-${row.id}`;
                const currentBranch = st.branch;
                const isProposedLine = row.line_source === "pharmacist_proposed";

                return (
                  <li
                    key={row.id}
                    className="rounded-xl border-2 border-slate-200/90 bg-white px-3 py-2.5 shadow-md ring-1 ring-black/[0.04]"
                  >
                    {isProposedLine ? (
                      <div className="mb-2.5 rounded-lg border border-violet-300/70 bg-violet-50 px-2.5 py-2 text-[11px] leading-snug text-violet-950">
                        <p className="font-bold text-violet-950">{requestItemLineSourceFr.pharmacist_proposed}</p>
                        {row.pharmacist_proposal_reason?.trim() ? (
                          <p className="mt-1 text-violet-900/95">
                            <span className="font-semibold">Motif : </span>
                            {row.pharmacist_proposal_reason.trim()}
                          </p>
                        ) : (
                          <p className="mt-1 italic text-violet-800/80">Aucun motif renseigné par la pharmacie.</p>
                        )}
                      </div>
                    ) : null}
                    <p className="text-xs font-semibold text-foreground sm:text-sm">{prod?.name ?? "Produit"}</p>
                    {!hasAlts && prodUnitPrice ? (
                      <p className="text-[10px] font-medium text-teal-800 sm:text-xs">{prodUnitPrice}</p>
                    ) : null}

                    {!hasAlts ? (
                      <>
                        <p className="mt-1 text-xs text-gray-600">
                          {row.availability_status ? availabilityStatusFr[row.availability_status] ?? row.availability_status : "—"}
                          {row.availability_status === "to_order" && row.expected_availability_date
                            ? ` · Disponible le ${formatDateShortFr(row.expected_availability_date)}`
                            : ""}
                        </p>
                        {row.pharmacist_comment ? (
                          <p className="mt-1 text-xs text-muted-foreground">{row.pharmacist_comment}</p>
                        ) : null}
                        <label className="mt-2 flex gap-2 text-sm font-medium text-gray-900">
                          <input
                            type="checkbox"
                            checked={currentBranch === "principal" && capPrincipal > 0}
                            disabled={capPrincipal === 0}
                            onChange={(e) => togglePrincipalOnlyLine(row.id, e.target.checked)}
                          />
                          <span>Je prends ce produit</span>
                        </label>
                        {capPrincipal > 0 ? (
                          <div className="ml-6 mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-500">Quantité max. {capPrincipal}</span>
                            <label className="flex items-center gap-1">
                              <span>J’en prends :</span>
                              <input
                                type="number"
                                min={1}
                                max={capPrincipal}
                                disabled={currentBranch !== "principal"}
                                value={currentBranch === "principal" ? st.qty : 0}
                                onChange={(e) => setLineQty(row.id, Number(e.target.value))}
                                className="w-16 rounded border px-1 py-0.5"
                              />
                            </label>
                            {row.unit_price != null ? (
                              <span className="font-semibold text-foreground">
                                Total {Number(st.qty * row.unit_price).toFixed(2)} MAD
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <fieldset className="mt-2 space-y-2 border-0 p-0">
                        <legend className="sr-only">Choix pour {prod?.name ?? "Produit"}</legend>
                        <label className="flex gap-2 text-sm text-foreground">
                          <input type="radio" name={radioName} checked={currentBranch === null} onChange={() => setLineBranch(row.id, null)} />
                          <span>Je ne prends aucune option</span>
                        </label>
                        <label className={`flex flex-col gap-0.5 text-sm ${capPrincipal === 0 ? "text-gray-400" : ""}`}>
                          <span className="flex gap-2">
                            <input
                              type="radio"
                              name={radioName}
                              checked={currentBranch === "principal"}
                              disabled={capPrincipal === 0}
                              onChange={() => setLineBranch(row.id, "principal")}
                            />
                            <span>
                              Produit principal
                              {row.unit_price != null ? (
                                <span className="ml-1 text-xs font-normal text-gray-600">
                                  · Prix pharmacie {Number(row.unit_price).toFixed(2)} MAD
                                </span>
                              ) : null}
                              {row.availability_status ? (
                                <span className="ml-1 text-xs font-normal text-gray-600">
                                  ({availabilityStatusFr[row.availability_status] ?? row.availability_status})
                                </span>
                              ) : null}
                              {row.availability_status === "to_order" && row.expected_availability_date ? (
                                <span className="ml-1 text-xs font-normal text-gray-600">
                                  · Disponible le {formatDateShortFr(row.expected_availability_date)}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </label>
                        {altList.map((alt) => {
                          const altProd = one(alt.products);
                          const capA = maxQtyAlt(row, alt);
                          const disabled = capA === 0;
                          return (
                            <label key={alt.id} className={`flex flex-col gap-0.5 text-sm ${disabled ? "text-gray-400" : ""}`}>
                              <span className="flex gap-2">
                                <input
                                  type="radio"
                                  name={radioName}
                                  checked={currentBranch === alt.id}
                                  disabled={disabled}
                                  onChange={() => setLineBranch(row.id, alt.id)}
                                />
                                <span>
                                  Alternative : {altProd?.name ?? "Produit"}
                                  {alt.unit_price != null ? (
                                    <span className="ml-1 text-xs font-normal text-gray-600">
                                      · Prix pharmacie {Number(alt.unit_price).toFixed(2)} MAD
                                    </span>
                                  ) : null}
                                  {alt.availability_status ? (
                                    <span className="ml-1 text-xs font-normal text-gray-600">
                                      ({availabilityStatusFr[alt.availability_status] ?? alt.availability_status})
                                    </span>
                                  ) : null}
                                  {alt.availability_status === "to_order" && alt.expected_availability_date ? (
                                    <span className="ml-1 text-xs font-normal text-gray-600">
                                      · Disponible le {formatDateShortFr(alt.expected_availability_date)}
                                    </span>
                                  ) : null}
                                </span>
                              </span>
                              {alt.pharmacist_comment ? (
                                <span className="ml-6 text-xs text-muted-foreground">{alt.pharmacist_comment}</span>
                              ) : null}
                            </label>
                          );
                        })}
                        {currentBranch !== null && maxQtyForBranch(row, currentBranch, altList) > 0 ? (
                          <div className="ml-6 mt-1 flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-500">Quantité max. {maxQtyForBranch(row, currentBranch, altList)}</span>
                            <label className="flex items-center gap-1">
                              <span>J’en prends :</span>
                              <input
                                type="number"
                                min={1}
                                max={maxQtyForBranch(row, currentBranch, altList)}
                                value={st.qty}
                                onChange={(e) => setLineQty(row.id, Number(e.target.value))}
                                className="w-16 rounded border px-1 py-0.5"
                              />
                            </label>
                            {(() => {
                              const branchPrice =
                                currentBranch === "principal"
                                  ? row.unit_price
                                  : altList.find((a) => a.id === currentBranch)?.unit_price ?? null;
                              return branchPrice != null ? (
                                <span className="font-semibold text-foreground">
                                  Total {Number(st.qty * branchPrice).toFixed(2)} MAD
                                </span>
                              ) : null;
                            })()}
                          </div>
                        ) : null}
                      </fieldset>
                    )}
                  </li>
                );
              })}
        </ul>
      ) : null}

      {showConfirmedCards ? (
        <ul className="space-y-4">
          {items.map((row) => {
            const prod = one(row.products);
            const altList = normalizeAlternatives(row.request_item_alternatives);
            const chosenAlt = altList.find((a) => a.id === row.patient_chosen_alternative_id);
            const counterOutcome = row.counter_outcome ?? "unset";
            const counterOutcomeLabel = counterOutcomeFr[counterOutcome] ?? counterOutcome;
            const displayName = chosenAlt ? one(chosenAlt.products)?.name ?? "Alternative" : prod?.name ?? "Produit";
            const displayPrice = chosenAlt?.unit_price ?? row.unit_price;
            const displayStatus = chosenAlt?.availability_status ?? row.availability_status;
            const displayEta = chosenAlt?.expected_availability_date ?? row.expected_availability_date;
            const displayComment = chosenAlt?.pharmacist_comment ?? row.pharmacist_comment;
            return (
              <li key={`confirmed-${row.id}`} className="rounded-xl border-2 border-slate-100 bg-white p-2.5 text-[11px] shadow-sm">
                <p className="text-sm font-semibold text-foreground">{displayName}</p>
                <p className="mt-1 text-xs text-gray-600">
                  {displayStatus ? availabilityStatusFr[displayStatus] ?? displayStatus : "—"}
                  {displayPrice != null ? ` · Prix pharmacie ${Number(displayPrice).toFixed(2)} MAD` : ""}
                  {displayStatus === "to_order" && displayEta ? ` · Disponible le ${formatDateShortFr(displayEta)}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-muted-foreground">Qté validée {row.selected_qty ?? row.requested_qty}</p>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${counterOutcomeBadgeClass(counterOutcome)}`}
                  >
                    {counterOutcomeLabel}
                  </span>
                </div>
                {displayComment ? <p className="mt-1 text-xs text-muted-foreground">{displayComment}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {showResubmit ? (
      <div className="mt-2">
            <ul className="space-y-2">
              {lines.map((l, idx) => (
                <li key={`${l.product_id}-${idx}`} className="rounded-xl border-2 border-slate-100 bg-white px-2.5 py-2 text-sm shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-[120px] flex-1">
                      <span className="block font-medium">{l.name}</span>
                      {unitPriceLabel(l.price_pph) ? (
                        <span className="mt-0.5 block text-xs font-medium text-teal-800">{unitPriceLabel(l.price_pph)}</span>
                      ) : null}
                      {l.line_source === "pharmacist_proposed" ? (
                        <span className="mt-1 block text-[10px] font-medium text-violet-900">
                          {requestItemLineSourceFr.pharmacist_proposed}
                          {l.pharmacist_proposal_reason ? ` — ${l.pharmacist_proposal_reason}` : ""}
                        </span>
                      ) : null}
                    </span>
                    <label className="flex items-center gap-1 text-xs">
                      Qté
                      <input
                        type="number"
                        min={1}
                        max={10}
                        disabled={!editMode}
                        value={l.qty}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row, i) =>
                              i === idx ? { ...row, qty: Math.min(10, Math.max(1, Number(e.target.value) || 1)) } : row
                            )
                          )
                        }
                        className="w-14 rounded border px-1 disabled:bg-muted"
                      />
                    </label>
                    {editMode ? (
                      <button
                        type="button"
                        className="text-xs text-red-700 underline"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Retirer
                      </button>
                    ) : null}
                  </div>
                  <label className="mt-2 block text-[11px] text-muted-foreground">
                    Note sur ce produit (optionnel, max 500 car.)
                    <input
                      type="text"
                      disabled={!editMode}
                      value={l.client_comment}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, client_comment: e.target.value.slice(0, 500) } : row
                          )
                        )
                      }
                      className="mt-1 w-full rounded border border-input px-2 py-1 text-xs disabled:bg-muted"
                      placeholder="Vous n’avez ajouté aucune note pour ce produit."
                    />
                  </label>
                </li>
              ))}
            </ul>

      </div>
      ) : null}

      <div className="mt-3 space-y-2 rounded-md border border-border/70 bg-card p-2 sm:p-2.5">
        {showConfirm && (
          <div className="rounded-md border border-primary/20 bg-primary/5 p-2">
            <label className="block text-[11px] font-medium text-foreground">
              Date de passage <span className="text-destructive">*</span>
              <input
                type="date"
                min={visitWin.minYmd}
                max={visitWin.maxYmd}
                value={resolvedVisitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                required
              />
            </label>
            <label className="mt-2 block text-[11px] font-medium text-foreground">
              Heure (optionnel)
              <input
                type="time"
                step={60}
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              />
              {visitTimeFr ? (
                <span className="mt-0.5 block text-[10px] text-muted-foreground">Affichage : {visitTimeFr}</span>
              ) : null}
            </label>
          </div>
        )}

        {showResubmit ? (
          <>
            <div className="rounded-md border border-border/70 bg-background p-2.5">
              <label className="block text-xs font-medium text-gray-700">
                Commentaire général (optionnel)
                <textarea
                  value={noteDraft}
                  disabled={!editMode}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  rows={2}
                  placeholder="Ajoutez un message pour la pharmacie"
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs disabled:bg-muted"
                />
              </label>
              {editMode ? (
                <>
                  <label className="mt-2 block text-xs font-medium text-gray-700">
                    Ajouter un produit
                    <input
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Rechercher (2 caractères min.)"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </label>
                  {visibleHits.length > 0 ? (
                    <ul className="mt-2 max-h-36 overflow-auto rounded border bg-gray-50 p-2 text-sm">
                      {visibleHits.map((h) => (
                        <li key={h.id}>
                          <button type="button" className="block w-full px-1 py-1 text-left hover:bg-white" onClick={() => addProduct(h)}>
                            <span className="font-medium">{h.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="rounded-md border border-amber-200/70 bg-amber-50/40 p-2.5 space-y-2">
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className="w-full rounded-md border border-amber-300 bg-amber-50 py-2 text-xs font-semibold text-amber-900"
              >
                {editMode ? "Fermer la modification" : "Modifier"}
              </button>

              <button
                type="button"
                disabled={busyAction !== "" || lines.length === 0 || !editMode}
                onClick={() => void runResubmit()}
                className="w-full rounded-lg border border-amber-600 bg-amber-50 py-2.5 text-sm font-semibold text-amber-950 disabled:opacity-50"
              >
                {busyAction === "resubmit" ? "Envoi…" : "Mettre à jour et renvoyer"}
              </button>
            </div>
          </>
        ) : null}

        {showConfirm ? (
          <button
            type="button"
            disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
            onClick={() => void runConfirm()}
            className="w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:text-sm"
          >
            {busyAction === "confirm" ? "Confirmation…" : "Valider ma sélection"}
          </button>
        ) : null}

        {status === "confirmed" ? (
          <button
            type="button"
            disabled={busyAction !== ""}
            onClick={() => void runUpdateVisit()}
            className="w-full rounded-md border border-primary/30 bg-primary/10 py-2 text-xs font-semibold text-primary disabled:opacity-50 sm:text-sm"
          >
            {busyAction === "confirm" ? "Mise à jour…" : "Mettre à jour ma date de passage"}
          </button>
        ) : null}

        {showAbandonAfterResponse ? (
          <>
            <label className="block text-xs font-medium text-gray-700">
              Motif d’abandon
              <select
                value={abandonCode}
                onChange={(e) => setAbandonCode(e.target.value as PatientCancelReasonCode)}
                className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
              >
                {PATIENT_CANCEL_REASON_CODES.map((c) => (
                  <option key={c} value={c}>
                    {PATIENT_CANCEL_REASON_LABELS[c]}
                  </option>
                ))}
              </select>
            </label>
            {abandonCode === "other" ? (
              <textarea
                value={abandonDetail}
                rows={2}
                onChange={(e) => setAbandonDetail(e.target.value)}
                placeholder="Précisez votre motif"
                className="w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
              />
            ) : null}
            <button
              type="button"
              disabled={busyAction !== "" || (abandonCode === "other" && abandonDetail.trim().length < 8)}
              onClick={() => void runAbandon()}
              className="w-full rounded-lg border border-red-400 bg-white py-2 text-sm font-semibold text-red-950 disabled:opacity-50"
            >
              {busyAction === "abandon" ? "Abandon…" : "Abandonner la demande"}
            </button>
          </>
        ) : null}
      </div>
    </section>
  );
}
