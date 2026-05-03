"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { pphLabel } from "@/lib/product-price";
import { supabase } from "@/lib/supabase";

type ProductLite = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  price_pph?: number | null;
};

type CartLine = {
  product_id: string;
  name: string;
  qty: number;
  price_pph?: number | null;
};

export default function DemandeProduitsPage() {
  const params = useParams();
  const router = useRouter();
  const pharmacyId = typeof params.id === "string" ? params.id : "";

  const [pharmacyName, setPharmacyName] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductLite[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const gate = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.replace(`/auth?redirect=/pharmacie/${pharmacyId}/demande-produits`);
        return;
      }
      setSessionReady(true);
    };
    void gate();
  }, [router, pharmacyId]);

  useEffect(() => {
    if (!pharmacyId || !sessionReady) return;
    const loadPh = async () => {
      const { data } = await supabase.from("pharmacies").select("nom").eq("id", pharmacyId).maybeSingle();
      if (data?.nom) setPharmacyName(data.nom);
    };
    void loadPh();
  }, [pharmacyId, sessionReady]);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const visibleHits = debouncedQuery.length < 2 ? [] : hits;

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      return;
    }
    const t = setTimeout(() => {
      const run = async () => {
        setSearchLoading(true);
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,price_pph")
          .eq("is_active", true)
          .ilike("name", `%${debouncedQuery}%`)
          .order("name")
          .limit(12);

        setSearchLoading(false);
        if (error) {
          setFeedback({ type: "err", text: error.message });
          setHits([]);
          return;
        }
        setHits((data as ProductLite[]) ?? []);
      };
      void run();
    }, 280);
    return () => clearTimeout(t);
  }, [debouncedQuery]);

  const addProduct = useCallback((p: ProductLite) => {
    setLines((prev) => {
      if (prev.some((l) => l.product_id === p.id)) return prev;
      return [...prev, { product_id: p.id, name: p.name, qty: 1, price_pph: p.price_pph ?? null }];
    });
    setQuery("");
    setHits([]);
    setFeedback(null);
  }, []);

  const setQty = (productId: string, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.product_id === productId ? { ...l, qty: Math.max(1, qty) } : l))
    );
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.product_id !== productId));
  };

  const submit = async () => {
    setFeedback(null);
    if (!pharmacyId) return;
    if (lines.length === 0) {
      setFeedback({ type: "err", text: "Ajoute au moins un produit." });
      return;
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setFeedback({ type: "err", text: "Session expirée. Reconnecte-toi." });
      return;
    }

    setSubmitLoading(true);
    const { data: reqRow, error: reqErr } = await supabase
      .from("requests")
      .insert({
        patient_id: userData.user.id,
        pharmacy_id: pharmacyId,
        request_type: "product_request",
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (reqErr || !reqRow) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: reqErr?.message ?? "Création de la demande impossible." });
      return;
    }

    const { error: prErr } = await supabase.from("product_requests").insert({
      request_id: reqRow.id,
      patient_note: note.trim() || null,
    });

    if (prErr) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: prErr.message });
      return;
    }

    const { error: itemsErr } = await supabase.from("request_items").insert(
      lines.map((l) => ({
        request_id: reqRow.id,
        product_id: l.product_id,
        requested_qty: l.qty,
      }))
    );

    setSubmitLoading(false);
    if (itemsErr) {
      setFeedback({ type: "err", text: itemsErr.message });
      return;
    }

    setFeedback({ type: "ok", text: "Demande envoyée. Tu pourras suivre l’avancement depuis ton espace." });
    setLines([]);
    setNote("");
  };

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <p className="text-gray-600">Vérification de la session...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-12">
      <div className="mx-auto max-w-lg">
        <Link href={`/pharmacie/${pharmacyId}`} className="mb-3 inline-block text-sm font-medium text-blue-700">
          Retour à la pharmacie
        </Link>

        <h1 className="text-2xl font-bold text-blue-950">Demande de produits</h1>
        {pharmacyName ? (
          <p className="mt-1 text-sm text-gray-600">
            Pour <span className="font-medium text-gray-800">{pharmacyName}</span>
          </p>
        ) : null}

        <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">Rechercher un produit</label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom (min. 2 caractères)"
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
          {searchLoading ? <p className="mt-2 text-xs text-gray-500">Recherche...</p> : null}
          {visibleHits.length > 0 ? (
            <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/80 p-2">
              {visibleHits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full flex-col rounded-md px-2 py-2 text-left text-sm hover:bg-white"
                  >
                    <span className="font-medium text-gray-900">{p.name}</span>
                    {pphLabel(p.price_pph) ? (
                      <span className="text-xs font-medium text-teal-800">{pphLabel(p.price_pph)}</span>
                    ) : null}
                    <span className="text-xs text-gray-500">
                      {p.product_type}
                      {p.laboratory ? ` · ${p.laboratory}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedQuery.length >= 2 && !searchLoading ? (
            <p className="mt-2 text-xs text-gray-500">Aucun résultat.</p>
          ) : null}
        </section>

        <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-800">Ta liste</h2>
          {lines.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Aucun produit pour l’instant.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {lines.map((l) => (
                <li
                  key={l.product_id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{l.name}</p>
                    {pphLabel(l.price_pph) ? (
                      <p className="truncate text-xs font-medium text-teal-800">{pphLabel(l.price_pph)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Diminuer"
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-700 hover:bg-white"
                      onClick={() => setQty(l.product_id, l.qty - 1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">{l.qty}</span>
                    <button
                      type="button"
                      aria-label="Augmenter"
                      className="rounded-lg border border-gray-200 p-1.5 text-gray-700 hover:bg-white"
                      onClick={() => setQty(l.product_id, l.qty + 1)}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Retirer"
                      className="ml-1 rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                      onClick={() => removeLine(l.product_id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">Message pour la pharmacie (optionnel)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            placeholder="Précisions, créneau de retrait..."
          />
        </section>

        {feedback ? (
          <div
            className={`mt-4 rounded-xl border p-3 text-sm ${
              feedback.type === "ok"
                ? "border-green-200 bg-green-50 text-green-900"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}

        <button
          type="button"
          disabled={submitLoading || lines.length === 0}
          onClick={() => void submit()}
          className="mt-6 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50"
        >
          {submitLoading ? "Envoi..." : "Envoyer la demande"}
        </button>

        <Link href="/dashboard" className="mt-4 block text-center text-sm text-blue-700">
          Mon espace
        </Link>
      </div>
    </main>
  );
}
