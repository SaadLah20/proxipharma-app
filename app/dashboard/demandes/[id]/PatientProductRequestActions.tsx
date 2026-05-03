"use client";

import { useEffect, useMemo, useState } from "react";
import { availabilityStatusFr } from "@/lib/request-display";
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

function computeResubmitLinesFromItems(
  items: ActionItemRow[]
): Array<{ product_id: string; name: string; qty: number; price_pph?: number | null }> {
  return items.map((row) => ({
    product_id: row.product_id,
    name: one(row.products)?.name ?? "Produit",
    qty: Math.max(1, row.requested_qty),
    price_pph: one(row.products)?.price_pph ?? null,
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

  /** Confirmation responded -> confirmed — reset via parent `key` when server rows change */
  const [sel, setSel] = useState(() => computeSelFromItems(items));

  /** Créneau de passage officine (`''` = défaut automatique borne min) */
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");

  /** Resubmit draft — idem */
  const [noteDraft, setNoteDraft] = useState(() => initialPatientNote ?? "");
  const [lines, setLines] = useState(() => computeResubmitLinesFromItems(items));
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
      return [...prev, { product_id: p.id, name: p.name, qty: 1, price_pph: p.price_pph ?? null }];
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
      setActionError("Garde au moins une ligne (produit ou alternative), ou utilise « Modifier et renvoyer » / abandon.");
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
    const p_items = lines.map((l) => ({ product_id: l.product_id, requested_qty: l.qty }));
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
    if (!globalThis.confirm("Abandonner cette demande ? Le pharmacien verra cette décision dans l historique.")) {
      return;
    }
    setActionError("");
    setBusyAction("abandon");
    const { error } = await supabase.rpc("patient_abandon_request", {
      p_request_id: requestId,
      p_reason: "patient_abandon_from_detail",
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  if (status !== "responded" && status !== "confirmed") return null;

  const showConfirm = status === "responded";

  return (
    <section className="mt-6 rounded-xl border-2 border-blue-200 bg-blue-50/40 p-4">
      <h2 className="text-sm font-semibold text-blue-950">Tes actions</h2>
      <p className="mt-1 text-xs text-blue-900/90">
        {status === "responded"
          ? "Réponds au pharmacien : pour chaque produit, choisis le principal, une alternative ou rien ; puis valide ou modifie toute ta liste."
          : "Tu peux encore modifier ta liste complète ou abandonner jusqu’à la clôture en pharmacie."}
      </p>

      {actionError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{actionError}</p>
      ) : null}

      {showConfirm ? (
        <div className="mt-4 rounded-lg border bg-white p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">Confirmer ta réservation</h3>
          <p className="mt-1 text-xs text-gray-600">
            Une option par groupe (produit demandé ou alternative). Les ruptures marché sont exclues par défaut.
          </p>
          <ul className="mt-3 space-y-4">
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
                <li key={row.id} className="rounded-md border border-gray-100 px-2 py-2">
                  <p className="text-sm font-medium text-gray-900">{prod?.name ?? "Produit"}</p>
                  {prodPph ? <p className="text-xs font-medium text-teal-800">{prodPph}</p> : null}

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

          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
            <h4 className="text-xs font-bold uppercase tracking-wide text-blue-900/90">Passage en pharmacie</h4>
            <p className="mt-1 text-xs text-blue-950/90">
              {visitWin.hasToOrder
                ? `Avec des produits « à commander », choisis une date entre aujourd’hui et le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (3 jours après la dernière date de réception indiquée).`
                : `Sans produit « à commander » dans ta sélection, choisis une date dans les 4 prochains jours (au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")}).`}
            </p>
            {visitWin.missingEtaOnToOrder ? (
              <p className="mt-2 text-xs font-semibold text-amber-900">
                Attention : au moins un produit « à commander » n’a pas de date de livraison côté pharmacie — corrige avant de valider.
              </p>
            ) : null}
            <label className="mt-3 block text-xs font-medium text-gray-700">
              Date souhaitée <span className="text-red-600">*</span>
              <input
                type="date"
                min={visitWin.minYmd}
                max={visitWin.maxYmd}
                value={resolvedVisitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
                required
              />
            </label>
            <label className="mt-2 block text-xs font-medium text-gray-700">
              Heure approximative (optionnel)
              <input
                type="time"
                value={visitTime}
                onChange={(e) => setVisitTime(e.target.value)}
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button
            type="button"
            disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
            onClick={() => void runConfirm()}
            className="mt-4 w-full rounded-lg bg-blue-700 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busyAction === "confirm" ? "Confirmation…" : "Valider ma sélection"}
          </button>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border bg-white p-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">Modifier ta demande et renvoyer</h3>
        <p className="mt-1 text-xs text-gray-600">
          Ta nouvelle liste remplace la préparation précédente. Le pharmacien retraitera depuis le début.
        </p>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={3}
          placeholder="Message pour la pharmacie (optionnel)"
          className="mt-3 w-full rounded-lg border px-3 py-2 text-sm"
        />

        <p className="mt-3 text-xs font-semibold text-gray-700">Produits dans ta demande</p>
        <ul className="mt-2 space-y-2">
          {lines.map((l, idx) => (
            <li key={`${l.product_id}-${idx}`} className="flex flex-wrap items-center gap-2 rounded border border-gray-100 px-2 py-2 text-sm">
              <span className="flex-1 min-w-[120px]">
                <span className="block font-medium">{l.name}</span>
                {pphLabel(l.price_pph) ? (
                  <span className="mt-0.5 block text-xs font-medium text-teal-800">{pphLabel(l.price_pph)}</span>
                ) : null}
              </span>
              <label className="flex items-center gap-1 text-xs">
                Qté
                <input
                  type="number"
                  min={1}
                  value={l.qty}
                  onChange={(e) =>
                    setLines((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, qty: Math.max(1, Number(e.target.value) || 1) } : row))
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
          {busyAction === "resubmit" ? "Envoi…" : "Modifier et renvoyer à la pharmacie"}
        </button>
      </div>

      <button
        type="button"
        disabled={busyAction !== ""}
        onClick={() => void runAbandon()}
        className="mt-3 w-full rounded-lg border border-red-300 bg-red-50 py-2 text-sm font-medium text-red-900 disabled:opacity-50"
      >
        {busyAction === "abandon" ? "Abandon…" : "Abandonner cette demande"}
      </button>
    </section>
  );
}
