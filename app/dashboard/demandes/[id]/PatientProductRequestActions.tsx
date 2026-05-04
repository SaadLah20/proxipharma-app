"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTime24hFr } from "@/lib/datetime-fr";
import {
  PATIENT_CANCEL_REASON_CODES,
  PATIENT_CANCEL_REASON_LABELS,
  type PatientCancelReasonCode,
} from "@/lib/patient-flow-reasons";
import { availabilityStatusFr, requestItemLineSourceFr } from "@/lib/request-display";
import { plannedVisitWindow } from "@/lib/planned-visit";
import { pphLabel } from "@/lib/product-price";
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

export function PatientProductRequestActions({ requestId, status, items, initialPatientNote, onReload }: Props) {
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon">("");
  const [abandonCode, setAbandonCode] = useState<PatientCancelReasonCode>("no_longer_needed");
  const [abandonDetail, setAbandonDetail] = useState("");

  /** Confirmation responded -> confirmed — reset via parent `key` when server rows change */
  const [sel, setSel] = useState(() => computeSelFromItems(items));

  /** Créneau de passage officine (`''` = défaut automatique borne min) */
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");

  /** Resubmit draft — idem */
  const [noteDraft, setNoteDraft] = useState(() => initialPatientNote ?? "");
  const [lines, setLines] = useState<ResubmitLine[]>(() => computeResubmitLinesFromItems(items));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);

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

  /** Sans alternative : comportement ancien checkbox principal seulement */
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

  const allowed =
    status === "submitted" || status === "in_review" || status === "responded" || status === "confirmed";
  if (!allowed) return null;

  const showConfirm = status === "responded";
  const showResubmit = status === "responded" || status === "submitted" || status === "in_review";
  const showAbandonAfterResponse = status === "responded" || status === "confirmed";

  const visitTimeFr = visitTime.trim() ? formatTime24hFr(htmlTimeToPg(visitTime) ?? visitTime) : "";

  return (
    <section className="mt-3 rounded-lg border border-border/90 bg-muted/15 p-2.5 sm:p-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        {status === "responded"
          ? "Choix principal / alternative ou rien par ligne, puis valide ou renvoie ta liste."
          : status === "confirmed"
            ? "Ta sélection est validée. Tu peux encore abandonner la demande si besoin."
            : "Tu peux ajuster les quantités ou la liste, puis renvoyer à la pharmacie."}
      </p>

      {actionError ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{actionError}</p>
      ) : null}

      {showConfirm ? (
        <div className="mt-2 rounded-md border border-border/70 bg-card p-2 sm:p-2.5">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Confirmer ta réservation</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Une option par produit. Ruptures marché exclues.
          </p>
          <ul className="mt-2 space-y-2">
            {items.map((row) => {
              const prod = one(row.products);
              const prodPph = pphLabel(prod?.price_pph);
              const altList = normalizeAlternatives(row.request_item_alternatives);
              const st = sel[row.id] ?? { branch: null, qty: 1 };
              const hasAlts = altList.length > 0;
              const capPrincipal = maxQtyPrincipal(row);

              const radioName = `line-choice-${row.id}`;
              const currentBranch = st.branch;

              return (
                <li key={row.id} className="rounded-md border border-border/60 bg-muted/10 px-2 py-1.5">
                  <p className="text-xs font-semibold text-foreground sm:text-sm">{prod?.name ?? "Produit"}</p>
                  {prodPph ? <p className="text-[10px] font-medium text-teal-800 sm:text-xs">{prodPph}</p> : null}

                  {!hasAlts ? (
                    <>
                      <label className="mt-2 flex gap-2 text-sm font-medium text-gray-900">
                        <input
                          type="checkbox"
                          checked={currentBranch === "principal" && capPrincipal > 0}
                          disabled={capPrincipal === 0}
                          onChange={(e) => togglePrincipalOnlyLine(row.id, e.target.checked)}
                        />
                        <span>Je prends ce produit</span>
                      </label>
                      {capPrincipal === 0 ? (
                        <p className="ml-6 mt-1 text-xs text-amber-800">
                          Indisponible ou rupture marché sur ce produit : tu ne peux pas valider cette branche.
                        </p>
                      ) : (
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
                        </div>
                      )}
                    </>
                  ) : (
                    <fieldset className="mt-2 space-y-2 border-0 p-0">
                      <legend className="sr-only">Choix pour {prod?.name ?? "Produit"}</legend>
                      <label className={`flex gap-2 text-sm ${capPrincipal === 0 ? "text-gray-400" : ""}`}>
                        <input
                          type="radio"
                          name={radioName}
                          checked={currentBranch === null}
                          onChange={() => setLineBranch(row.id, null)}
                        />
                        <span>Je ne prends aucune des options ci-dessous</span>
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
                            {prodPph ? (
                              <span className="ml-1 text-xs font-normal text-teal-800">· {prodPph}</span>
                            ) : null}
                            {row.availability_status ? (
                              <span className="ml-1 text-xs font-normal text-gray-600">
                                ({availabilityStatusFr[row.availability_status] ?? row.availability_status}
                                {row.unit_price != null
                                  ? ` · Prix pharma ${Number(row.unit_price).toFixed(2)} MAD`
                                  : ""})
                              </span>
                            ) : row.unit_price != null ? (
                              <span className="ml-1 text-xs font-normal text-gray-600">
                                · Prix pharma {Number(row.unit_price).toFixed(2)} MAD
                              </span>
                            ) : null}
                          </span>
                        </span>
                        {isMarketShortage(row.availability_status) ? (
                          <span className="ml-6 text-xs text-gray-500">Rupture marché — sélection désactivée.</span>
                        ) : capPrincipal === 0 ? (
                          <span className="ml-6 text-xs text-gray-500">Stock insuffisant pour ce produit.</span>
                        ) : null}
                      </label>
                      {altList.map((alt) => {
                        const altProd = one(alt.products);
                        const altPph = pphLabel(altProd?.price_pph);
                        const capA = maxQtyAlt(row, alt);
                        const disabled = capA === 0;
                        return (
                          <label
                            key={alt.id}
                            className={`flex flex-col gap-0.5 text-sm ${disabled ? "text-gray-400" : ""}`}
                          >
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
                                {altPph ? <span className="ml-1 text-xs font-normal text-teal-800">· {altPph}</span> : null}
                                {alt.availability_status ? (
                                  <span className="ml-1 text-xs font-normal text-gray-600">
                                    ({availabilityStatusFr[alt.availability_status] ?? alt.availability_status}
                                    {alt.unit_price != null
                                      ? ` · Prix pharma ${Number(alt.unit_price).toFixed(2)} MAD`
                                      : ""})
                                  </span>
                                ) : alt.unit_price != null ? (
                                  <span className="ml-1 text-xs font-normal text-gray-600">
                                    · Prix pharma {Number(alt.unit_price).toFixed(2)} MAD
                                  </span>
                                ) : null}
                              </span>
                            </span>
                            {isMarketShortage(alt.availability_status) ? (
                              <span className="ml-6 text-xs text-gray-500">Rupture marché — sélection désactivée.</span>
                            ) : disabled ? (
                              <span className="ml-6 text-xs text-gray-500">Non disponible en quantité suffisante.</span>
                            ) : null}
                            {alt.pharmacist_comment ? (
                              <span className="ml-6 text-xs text-gray-700">{alt.pharmacist_comment}</span>
                            ) : null}
                          </label>
                        );
                      })}
                      {currentBranch !== null && maxQtyForBranch(row, currentBranch, altList) > 0 ? (
                        <div className="ml-6 mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span className="text-gray-500">
                            Quantité max. {maxQtyForBranch(row, currentBranch, altList)}
                          </span>
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
                        </div>
                      ) : null}
                    </fieldset>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2 sm:p-2.5">
            <h4 className="text-[10px] font-bold uppercase tracking-wide text-primary">Passage en pharmacie</h4>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              {visitWin.hasToOrder
                ? `Avec « à commander » : date au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (règle ETA + 3 j).`
                : `Sans « à commander » : date dans les 4 jours (max ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")}).`}
            </p>
            {visitWin.missingEtaOnToOrder ? (
              <p className="mt-1 text-[11px] font-semibold text-amber-900">
                Produit « à commander » sans date côté pharmacie — contacte l’officine.
              </p>
            ) : null}
            <label className="mt-2 block text-[11px] font-medium text-foreground">
              Date <span className="text-destructive">*</span>
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
              Heure (format 24 h, optionnel)
              <input
                type="time"
                step={60}
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="mt-0.5 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
              />
              {visitTimeFr ? (
                <span className="mt-0.5 block text-[10px] text-muted-foreground">Affichage : {visitTimeFr}</span>
              ) : (
                <span className="mt-0.5 block text-[10px] text-muted-foreground">ex. 18h30 → saisis 18:30</span>
              )}
            </label>
          </div>

          <button
            type="button"
            disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
            onClick={() => void runConfirm()}
            className="mt-2 w-full rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:text-sm"
          >
            {busyAction === "confirm" ? "Confirmation…" : "Valider ma sélection"}
          </button>
        </div>
      ) : null}

      {showResubmit ? (
      <div className="mt-2 rounded-md border border-border/70 bg-card p-2 sm:p-2.5">
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {status === "responded" ? "Modifier la liste" : "Liste à envoyer"}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {status === "responded"
            ? "Une nouvelle liste relance le traitement depuis le début côté pharmacie."
            : "Les changements remplacent ta demande actuelle."}
        </p>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={2}
          placeholder="Message (optionnel)"
          className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
        />

        <p className="mt-2 text-[11px] font-semibold text-foreground">Lignes</p>
        <ul className="mt-1 space-y-2">
          {lines.map((l, idx) => (
            <li key={`${l.product_id}-${idx}`} className="rounded border border-gray-100 px-2 py-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-[120px] flex-1">
                  <span className="block font-medium">{l.name}</span>
                  {pphLabel(l.price_pph) ? (
                    <span className="mt-0.5 block text-xs font-medium text-teal-800">{pphLabel(l.price_pph)}</span>
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
                    value={l.qty}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, qty: Math.min(10, Math.max(1, Number(e.target.value) || 1)) } : row
                        )
                      )
                    }
                    className="w-14 rounded border px-1"
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-red-700 underline"
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Retirer
                </button>
              </div>
              <label className="mt-2 block text-[11px] text-muted-foreground">
                Note sur ce produit (optionnel, max 500 car.)
                <input
                  type="text"
                  value={l.client_comment}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, client_comment: e.target.value.slice(0, 500) } : row
                      )
                    )
                  }
                  className="mt-1 w-full rounded border border-input px-2 py-1 text-xs"
                  placeholder="Ex. précision posologie…"
                />
              </label>
            </li>
          ))}
        </ul>

        <label className="mt-3 block text-xs font-medium text-gray-600">Ajouter un produit</label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (2 caractères min.)"
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
        {visibleHits.length > 0 ? (
          <ul className="mt-2 max-h-36 overflow-auto rounded border bg-gray-50 p-2 text-sm">
            {visibleHits.map((h) => (
              <li key={h.id}>
                <button type="button" className="block w-full text-left hover:bg-white px-1 py-1" onClick={() => addProduct(h)}>
                  <span className="font-medium">{h.name}</span>
                  {pphLabel(h.price_pph) ? (
                    <span className="mt-0.5 block text-xs text-teal-800">{pphLabel(h.price_pph)}</span>
                  ) : null}
                  <span className="block text-[11px] text-gray-500">
                    {h.product_type}
                    {h.laboratory ? ` · ${h.laboratory}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <button
          type="button"
          disabled={busyAction !== "" || lines.length === 0}
          onClick={() => void runResubmit()}
          className="mt-4 w-full rounded-lg border border-amber-600 bg-amber-50 py-2.5 text-sm font-semibold text-amber-950 disabled:opacity-50"
        >
          {busyAction === "resubmit"
            ? "Envoi…"
            : status === "responded"
              ? "Renvoyer la liste à la pharmacie"
              : "Mettre à jour et renvoyer"}
        </button>
      </div>
      ) : null}

      {showAbandonAfterResponse ? (
      <div className="mt-2 rounded-md border border-destructive/25 bg-destructive/5 p-2 sm:p-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-destructive">Abandon après réponse</p>
        <label className="mt-3 block text-xs font-medium text-gray-700">
          Motif
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
          <label className="mt-2 block text-xs font-medium text-gray-700">
            Précise (min. 8 caractères)
            <textarea
              value={abandonDetail}
              rows={2}
              onChange={(e) => setAbandonDetail(e.target.value)}
              placeholder="Ton motif…"
              className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900"
            />
          </label>
        ) : null}
        <button
          type="button"
          disabled={busyAction !== "" || (abandonCode === "other" && abandonDetail.trim().length < 8)}
          onClick={() => void runAbandon()}
          className="mt-3 w-full rounded-lg border border-red-400 bg-white py-2 text-sm font-semibold text-red-950 disabled:opacity-50"
        >
          {busyAction === "abandon" ? "Abandon…" : "Abandonner cette demande"}
        </button>
      </div>
      ) : null}
    </section>
  );
}
