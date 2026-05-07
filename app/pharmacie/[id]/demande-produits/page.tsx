"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Package } from "lucide-react";
import { unitPriceLabel } from "@/lib/product-price";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  /** Commentaire optionnel par ligne (Q11, max 500 côté BDD) */
  client_comment?: string;
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
    const q = Math.min(10, Math.max(1, qty));
    setLines((prev) => prev.map((l) => (l.product_id === productId ? { ...l, qty: q } : l)));
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

    for (const l of lines) {
      if (l.qty < 1 || l.qty > 10) {
        setFeedback({ type: "err", text: "Chaque quantité doit être entre 1 et 10." });
        return;
      }
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
      lines.map((l) => {
        const cc = l.client_comment?.trim();
        return {
          request_id: reqRow.id,
          product_id: l.product_id,
          requested_qty: l.qty,
          line_source: "patient_request" as const,
          client_comment: cc && cc.length > 0 ? cc.slice(0, 500) : null,
        };
      })
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
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
      </main>
    );
  }

  const fieldFocus =
    "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

  return (
    <main className="min-h-screen bg-background p-4 pb-14 sm:p-5">
      <div className="mx-auto max-w-lg">
        <Link
          href={`/pharmacie/${pharmacyId}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 -ml-2 h-auto px-2 text-sm font-semibold text-primary")}
        >
          Retour à la pharmacie
        </Link>

        <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"
              aria-hidden
            >
              <Package className="size-5" strokeWidth={2.25} />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Demande de produits</h1>
              {pharmacyName ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Pour <span className="font-semibold text-foreground">{pharmacyName}</span>
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Ajoutez les produits souhaités, puis envoyez : l&apos;officine pourra vous répondre depuis la plateforme.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-5 rounded-2xl border border-border/90 bg-card p-4 text-card-foreground shadow-sm">
          <label className="block text-sm font-medium text-foreground">Rechercher un produit</label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom (min. 2 caractères)"
            className={cn(
              "mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground",
              fieldFocus
            )}
          />
          {searchLoading ? <p className="mt-2 text-xs text-muted-foreground">Recherche…</p> : null}
          {visibleHits.length > 0 ? (
            <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/25 p-2">
              {visibleHits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex w-full flex-col rounded-lg px-2 py-2 text-left text-sm transition hover:bg-card"
                  >
                    <span className="font-medium text-foreground">{p.name}</span>
                    {unitPriceLabel(p.price_pph) ? (
                      <span className="text-xs font-medium text-primary">{unitPriceLabel(p.price_pph)}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {p.product_type}
                      {p.laboratory ? ` · ${p.laboratory}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedQuery.length >= 2 && !searchLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
          ) : null}
        </section>

        <section className="mt-4 rounded-2xl border border-border/90 bg-card p-4 text-card-foreground shadow-sm">
          <h2 className="text-sm font-semibold text-foreground">Ta liste</h2>
          {lines.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aucun produit pour l’instant.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {lines.map((l) => (
                <li
                  key={l.product_id}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{l.name}</p>
                    {unitPriceLabel(l.price_pph) ? (
                      <p className="truncate text-xs font-medium text-primary">{unitPriceLabel(l.price_pph)}</p>
                    ) : null}
                    <label className="mt-1 block text-[11px] text-muted-foreground">
                      <span className="sr-only">Note sur ce produit</span>
                      <input
                        type="text"
                        value={l.client_comment ?? ""}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((row) =>
                              row.product_id === l.product_id
                                ? { ...row, client_comment: e.target.value.slice(0, 500) }
                                : row
                            )
                          )
                        }
                        placeholder="Note sur ce produit (optionnel)"
                        className={cn(
                          "mt-0.5 w-full rounded-lg border border-input bg-background px-2 py-1 text-[11px]",
                          fieldFocus
                        )}
                      />
                    </label>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Diminuer"
                      className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60"
                      onClick={() => setQty(l.product_id, l.qty - 1)}
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      aria-label="Augmenter"
                      disabled={l.qty >= 10}
                      className="rounded-lg border border-border bg-card p-1.5 text-foreground hover:bg-muted/60 disabled:opacity-40"
                      onClick={() => setQty(l.product_id, l.qty + 1)}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Retirer"
                      className="ml-1 rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
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

        <section className="mt-4 rounded-2xl border border-border/90 bg-card p-4 text-card-foreground shadow-sm">
          <label className="block text-sm font-medium text-foreground">Message pour la pharmacie (optionnel)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className={cn(
              "mt-2 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground",
              fieldFocus
            )}
            placeholder="Précisions, créneau de retrait..."
          />
        </section>

        {feedback ? (
          <div
            className={cn(
              "mt-4 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              feedback.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {feedback.text}
          </div>
        ) : null}

        <p className="mt-6 text-center text-sm leading-relaxed text-muted-foreground">
          En validant, votre liste est transmise à la pharmacie. Vous pourrez suivre la réponse depuis{" "}
          <span className="font-medium text-foreground">Mes demandes</span>.
        </p>

        <Button
          type="button"
          size="lg"
          disabled={submitLoading || lines.length === 0}
          className="mt-3 h-11 w-full text-sm"
          onClick={() => void submit()}
        >
          {submitLoading ? "Envoi…" : "Envoyer la demande"}
        </Button>

        <Link
          href="/dashboard/demandes"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-3 flex h-11 w-full items-center justify-center text-sm")}
        >
          Mes demandes de produits
        </Link>
      </div>
    </main>
  );
}
