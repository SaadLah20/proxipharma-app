"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Minus, Plus, Trash2, Package, Search } from "lucide-react";
import { unitPriceLabel } from "@/lib/product-price";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PATIENT_GENERAL_NOTE_MAX, PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";

type ProductLite = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url: string | null;
  price_pph?: number | null;
};

type CartLine = {
  product_id: string;
  name: string;
  photo_url: string | null;
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
          .select("id,name,product_type,laboratory,photo_url,price_pph")
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
      return [
        ...prev,
        { product_id: p.id, name: p.name, photo_url: p.photo_url, qty: 1, price_pph: p.price_pph ?? null },
      ];
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

    const noteTrim = note.trim().slice(0, PATIENT_GENERAL_NOTE_MAX);
    const { error: prErr } = await supabase.from("product_requests").insert({
      request_id: reqRow.id,
      patient_note: noteTrim.length > 0 ? noteTrim : null,
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
          client_comment: cc && cc.length > 0 ? cc.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX) : null,
        };
      })
    );

    setSubmitLoading(false);
    if (itemsErr) {
      setFeedback({ type: "err", text: itemsErr.message });
      return;
    }

    router.push(`/dashboard/demandes/${reqRow.id}`);
  };

  const fieldFocus =
    "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + (l.price_pph ?? 0) * l.qty, 0),
    [lines]
  );

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen touch-pan-y bg-slate-50 p-4 pb-32 text-slate-900 antialiased sm:p-5 sm:pb-36">
      <div className="mx-auto max-w-lg">
        <Link
          href={`/pharmacie/${pharmacyId}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "mb-3 -ml-2 h-auto px-2 text-base font-semibold text-sky-900 underline-offset-2 hover:underline"
          )}
        >
          Retour à la pharmacie
        </Link>

        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-md sm:p-5">
          <div className="flex items-start gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-900"
              aria-hidden
            >
              <Package className="size-6" strokeWidth={2.25} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-[1.35rem] font-bold leading-snug tracking-tight text-slate-950 sm:text-2xl">
                Demande de produits pour{" "}
                <span className="text-sky-900">{pharmacyName.trim() ? pharmacyName : "cette pharmacie"}</span>
              </h1>
            </div>
          </div>
        </div>

        <section className="mt-5 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <label className="block text-base font-semibold text-slate-900">Recherche de produits</label>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">2 lettres minimum pour lancer la recherche.</p>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Doliprane, Smecta..."
              className={cn(
                "touch-pan-y w-full rounded-xl border-2 border-slate-300 bg-white py-3 pl-11 pr-3 text-base leading-normal shadow-sm placeholder:text-slate-400",
                fieldFocus
              )}
            />
          </div>
          {searchLoading ? <p className="mt-2 text-xs text-muted-foreground">Recherche…</p> : null}
          {visibleHits.length > 0 ? (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {visibleHits.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => addProduct(p)}
                    className="flex h-20 w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-2 text-left transition hover:bg-muted/35"
                  >
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card">
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="size-5 text-muted-foreground" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex flex-1 flex-col justify-center">
                      <p
                        className="overflow-hidden pr-1 text-[14px] font-semibold leading-tight text-foreground sm:text-[15px]"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {p.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-primary sm:text-sm">
                        {unitPriceLabel(p.price_pph) ?? "Prix indisponible"}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : debouncedQuery.length >= 2 && !searchLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
          ) : null}
        </section>

        <section className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Produits ajoutés</h2>
          {lines.length === 0 ? (
            <p className="mt-3 text-base leading-relaxed text-slate-600">Aucun produit pour l’instant.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {lines.map((l) => (
                <li
                  key={l.product_id}
                  className="rounded-xl border-2 border-slate-200 bg-slate-50/80 p-3"
                >
                  <div className="flex min-h-[96px] items-stretch gap-2.5">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-card">
                      <button
                        type="button"
                        aria-label="Retirer"
                        className="absolute right-1 top-1 z-10 rounded-md bg-background/90 p-1 text-destructive shadow-sm hover:bg-destructive/10"
                        onClick={() => removeLine(l.product_id)}
                      >
                        <Trash2 size={15} />
                      </button>
                      {l.photo_url ? (
                        <img src={l.photo_url} alt={l.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="size-7 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p
                        className="overflow-hidden pr-1 text-[13px] font-semibold leading-tight text-foreground sm:text-[15px]"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {l.name}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-primary">
                        {unitPriceLabel(l.price_pph) ?? "Prix unitaire indisponible"}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          Total{" "}
                          <span className="inline-block rounded bg-background px-1.5 py-0.5 font-semibold text-foreground">
                            {l.price_pph != null ? `${(l.price_pph * l.qty).toFixed(2)} MAD` : "-"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-sm font-medium text-slate-800">Commentaire sur ce produit (facultatif)</span>
                    <input
                      type="text"
                      value={l.client_comment ?? ""}
                      maxLength={PATIENT_PRODUCT_LINE_COMMENT_MAX}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.product_id === l.product_id
                              ? { ...row, client_comment: e.target.value.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX) }
                              : row
                          )
                        )
                      }
                      placeholder="Ex. dosage, marque souhaitée…"
                      className={cn(
                        "touch-pan-y w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2.5 text-base leading-normal placeholder:text-slate-400",
                        fieldFocus
                      )}
                    />
                    <span className="mt-1 block text-right text-xs text-slate-500 tabular-nums">
                      {(l.client_comment ?? "").length}/{PATIENT_PRODUCT_LINE_COMMENT_MAX}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-2xl border-l-4 border-sky-700 bg-sky-50/90 p-4 shadow-md ring-1 ring-sky-200/60 sm:p-5">
          <label className="block text-base font-semibold text-slate-900">Message général pour la pharmacie (facultatif)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, PATIENT_GENERAL_NOTE_MAX))}
            rows={4}
            maxLength={PATIENT_GENERAL_NOTE_MAX}
            className={cn(
              "touch-pan-y mt-3 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-3 text-base leading-relaxed shadow-inner placeholder:text-slate-400",
              fieldFocus
            )}
            placeholder="Votre texte apparaîtra tel quel pour l’officine."
          />
          <p className="mt-1.5 text-right text-sm text-slate-600 tabular-nums">
            {note.length}/{PATIENT_GENERAL_NOTE_MAX}
          </p>
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

        <p className="mt-5 text-center text-base leading-relaxed text-slate-700">
          Après envoi, suivez la réponse dans <span className="font-semibold text-slate-900">Mes demandes de produits</span>.
        </p>

        <Button
          type="button"
          size="lg"
          disabled={submitLoading || lines.length === 0}
          className="mt-4 h-12 w-full text-base font-semibold shadow-md"
          onClick={() => void submit()}
        >
          {submitLoading ? "Envoi…" : "Envoyer la demande"}
        </Button>

        <Link
          href="/dashboard/demandes"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-3 flex h-12 w-full items-center justify-center text-base font-semibold"
          )}
        >
          Mes demandes de produits
        </Link>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-300 bg-white/98 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-5">
          <p className="text-base text-slate-700">
            <span className="font-bold tabular-nums text-slate-950">{lines.length}</span>{" "}
            <span className="font-medium">{lines.length > 1 ? "produits" : "produit"}</span>
          </p>
          <p className="text-lg font-bold tracking-tight text-slate-950">
            TOTAL: <span className="tabular-nums text-sky-900">{totalAmount.toFixed(2)} MAD</span>
          </p>
        </div>
      </div>
    </main>
  );
}
