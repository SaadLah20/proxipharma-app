"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/embed";

export type ActionItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  selected_qty: number | null;
  is_selected_by_patient: boolean;
  availability_status: string | null;
  available_qty: number | null;
  products: { name: string } | { name: string }[] | null;
};

function maxSelectableQty(row: ActionItemRow): number {
  if (row.available_qty != null) {
    return Math.max(0, Math.min(row.requested_qty, row.available_qty));
  }
  return row.requested_qty;
}

type ProductHit = { id: string; name: string; product_type: string; laboratory: string | null };

type Props = {
  requestId: string;
  status: string;
  items: ActionItemRow[];
  initialPatientNote: string | null;
  onReload: () => Promise<void>;
};

export function PatientProductRequestActions({ requestId, status, items, initialPatientNote, onReload }: Props) {
  const [actionError, setActionError] = useState("");
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon">("");

  /** Confirmation responded -> confirmed */
  const [sel, setSel] = useState<Record<string, { on: boolean; qty: number }>>({});

  useEffect(() => {
    const next: Record<string, { on: boolean; qty: number }> = {};
    for (const row of items) {
      const cap = maxSelectableQty(row);
      const defaultOn = cap > 0 && row.is_selected_by_patient !== false;
      const qty = cap > 0 ? Math.min(cap, row.selected_qty ?? cap) : 0;
      next[row.id] = { on: defaultOn, qty: Math.max(cap > 0 ? 1 : 0, qty) };
      if (qty > cap) next[row.id] = { ...next[row.id], qty: Math.max(1, cap) };
    }
    setSel(next);
  }, [items]);

  /** Resubmit draft */
  const [noteDraft, setNoteDraft] = useState(initialPatientNote ?? "");
  const [lines, setLines] = useState<Array<{ product_id: string; name: string; qty: number }>>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);

  useEffect(() => {
    setNoteDraft(initialPatientNote ?? "");
  }, [initialPatientNote]);

  useEffect(() => {
    setLines(
      items.map((row) => ({
        product_id: row.product_id,
        name: one(row.products)?.name ?? "Produit",
        qty: Math.max(1, row.requested_qty),
      }))
    );
  }, [items]);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory")
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

  const addProduct = useCallback((p: ProductHit) => {
    setLines((prev) => {
      if (prev.some((l) => l.product_id === p.id)) return prev;
      return [...prev, { product_id: p.id, name: p.name, qty: 1 }];
    });
    setQuery("");
    setHits([]);
    setActionError("");
  }, []);

  const toggleLine = (itemId: string, on: boolean) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      const cap = row ? maxSelectableQty(row) : 0;
      const prev = s[itemId] ?? { on: false, qty: 1 };
      return {
        ...s,
        [itemId]: {
          on,
          qty: on ? Math.min(Math.max(1, prev.qty), Math.max(1, cap)) : prev.qty,
        },
      };
    });
  };

  const setLineQty = (itemId: string, qty: number) => {
    const row = items.find((i) => i.id === itemId);
    const cap = row ? maxSelectableQty(row) : 1;
    setSel((s) => ({
      ...s,
      [itemId]: {
        ...(s[itemId] ?? { on: true, qty: 1 }),
        qty: Math.min(Math.max(1, qty), Math.max(1, cap)),
      },
    }));
  };

  const runConfirm = async () => {
    setActionError("");
    const payload = items.map((row) => {
      const st = sel[row.id] ?? { on: true, qty: row.requested_qty };
      const cap = maxSelectableQty(row);
      return {
        request_item_id: row.id,
        is_selected: st.on && cap > 0,
        selected_qty: st.on && cap > 0 ? Math.min(st.qty, cap) : null,
      };
    });
    const anyOn = payload.some((p) => p.is_selected);
    if (!anyOn) {
      setActionError("Garde au moins un produit sélectionné, ou utilise « Modifier et renvoyer » / abandon.");
      return;
    }

    setBusyAction("confirm");
    const { error } = await supabase.rpc("patient_confirm_after_response", {
      p_request_id: requestId,
      p_selections: payload.map((p) => ({
        request_item_id: p.request_item_id,
        is_selected: p.is_selected,
        selected_qty: p.selected_qty,
      })),
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
          ? "Réponds au pharmacien : confirme ce que tu gardes ou modifie toute ta liste et renvoie-la."
          : "Tu peux encore modifier ta liste complète ou abandonner jusqu’à la clôture en pharmacie."}
      </p>

      {actionError ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">{actionError}</p>
      ) : null}

      {showConfirm ? (
        <div className="mt-4 rounded-lg border bg-white p-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600">Confirmer ta réservation</h3>
          <p className="mt-1 text-xs text-gray-600">Décoche un produit si tu ne le veux pas. Ajuste la quantité là où les stocks sont plus bas que prévu.</p>
          <ul className="mt-3 space-y-3">
            {items.map((row) => {
              const prod = one(row.products);
              const cap = maxSelectableQty(row);
              const st = sel[row.id] ?? { on: cap > 0, qty: cap > 0 ? cap : 0 };
              return (
                <li key={row.id} className="rounded-md border border-gray-100 px-2 py-2">
                  <label className="flex gap-2 text-sm font-medium text-gray-900">
                    <input
                      type="checkbox"
                      checked={st.on && cap > 0}
                      disabled={cap === 0}
                      onChange={(e) => toggleLine(row.id, e.target.checked)}
                    />
                    <span>{prod?.name ?? "Produit"}</span>
                  </label>
                  {cap === 0 ? (
                    <p className="ml-6 mt-1 text-xs text-amber-800">Indisponible selon la pharmacie : tu ne peux pas le prendre tel quel.</p>
                  ) : (
                    <div className="ml-6 mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-gray-500">Quantité max. {cap}</span>
                      <label className="flex items-center gap-1">
                        <span>J’en prends :</span>
                        <input
                          type="number"
                          min={1}
                          max={cap}
                          disabled={!st.on}
                          value={st.on ? st.qty : 0}
                          onChange={(e) => setLineQty(row.id, Number(e.target.value))}
                          className="w-16 rounded border px-1 py-0.5"
                        />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={busyAction !== ""}
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
              <span className="flex-1 min-w-[120px]">{l.name}</span>
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
        {hits.length > 0 ? (
          <ul className="mt-2 max-h-36 overflow-auto rounded border bg-gray-50 p-2 text-sm">
            {hits.map((h) => (
              <li key={h.id}>
                <button type="button" className="block w-full text-left hover:bg-white px-1 py-1" onClick={() => addProduct(h)}>
                  {h.name}
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
