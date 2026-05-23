"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Gift, Package, Plus } from "lucide-react";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { ScheduleToast, type ScheduleToastTone } from "@/components/pharmacy/schedule/schedule-toast";
import { PromoProductPicker, PromoCompactLinesList } from "@/components/promo/promo-product-picker";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import { supabase } from "@/lib/supabase";
import { deletePromoOffer, savePromoOffer, type PromoLineDraft, type PromoOfferDraft } from "@/lib/promo/save-offer";
import { computePromoPackTotals, formatDh } from "@/lib/promo/pricing";
import { defaultPromoOfferValidity, formatPromoValidityFr, todayIsoCasablanca } from "@/lib/promo/dates";
import { MAX_PROMO_GIFT_LINES, MAX_PROMO_PRODUCT_LINES, type PromoOfferRow } from "@/lib/promo/types";
import type { PromoCatalogProduct } from "@/lib/promo/catalog";
import { usePharmacyPricing } from "@/lib/pharmacy-pricing";
import { catalogHitToPricingInput } from "@/lib/pharmacy-pricing/product-embed";

type LineState = PromoLineDraft & { _key: string; _name?: string };

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_OFFER: PromoOfferDraft = {
  title: "",
  description: "",
  discount_percent: 10,
  valid_from: "",
  valid_until: "",
};

export function PharmacyPromoOffersManager() {
  const router = useRouter();
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [offers, setOffers] = useState<PromoOfferRow[]>([]);
  const [pendingByOffer, setPendingByOffer] = useState<Map<string, number>>(new Map());
  const [catalog, setCatalog] = useState<PromoCatalogProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [offer, setOffer] = useState<PromoOfferDraft>(EMPTY_OFFER);
  const [lines, setLines] = useState<LineState[]>([]);
  const [giftText, setGiftText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; tone: ScheduleToastTone }>({ message: "", tone: "info" });
  const { resolve: resolveCatalogPrice } = usePharmacyPricing(pharmacyId ?? undefined);

  const showToast = (message: string, tone: ScheduleToastTone = "info") => setToast({ message, tone });

  const loadOffers = useCallback(async (pid: string) => {
    const { data } = await supabase
      .from("pharmacy_promo_offers")
      .select("id,pharmacy_id,title,description,discount_percent,valid_from,valid_until,status,published_at,created_at,updated_at")
      .eq("pharmacy_id", pid)
      .order("updated_at", { ascending: false });
    setOffers((data ?? []) as PromoOfferRow[]);

    const { data: pending } = await supabase
      .from("pharmacy_promo_reservations")
      .select("offer_id")
      .eq("pharmacy_id", pid)
      .eq("status", "submitted");
    const m = new Map<string, number>();
    for (const r of pending ?? []) {
      const oid = (r as { offer_id: string }).offer_id;
      m.set(oid, (m.get(oid) ?? 0) + 1);
    }
    setPendingByOffer(m);
  }, []);

  const load = useCallback(async () => {
    const ctx = await loadPharmacistPharmacyId();
    if (!ctx.pharmacyId) {
      showToast(ctx.error ?? "Erreur", "error");
      setLoading(false);
      return;
    }
    setPharmacyId(ctx.pharmacyId);
    const { data: prods } = await supabase
      .from("products")
      .select("id,name,product_type,laboratory,price_pph,price_ppv,photo_url")
      .eq("is_active", true)
      .order("name")
      .limit(500);
    setCatalog((prods ?? []) as PromoCatalogProduct[]);
    await loadOffers(ctx.pharmacyId);
    setLoading(false);
  }, [loadOffers]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) router.replace("/auth?redirect=/dashboard/pharmacien/offres-promos");
    };
    void run();
  }, [router]);

  const startNew = () => {
    const { valid_from, valid_until } = defaultPromoOfferValidity();
    setEditingId("new");
    setOffer({ ...EMPTY_OFFER, valid_from, valid_until });
    setLines([]);
    setGiftText("");
  };

  const startEdit = async (id: string) => {
    const o = offers.find((x) => x.id === id);
    if (!o) return;
    setEditingId(id);
    setOffer({
      title: o.title,
      description: o.description ?? "",
      discount_percent: o.discount_percent,
      valid_from: o.valid_from,
      valid_until: o.valid_until,
    });
    const { data: ln } = await supabase
      .from("pharmacy_promo_offer_lines")
      .select("line_kind,product_id,label,quantity,sort_order")
      .eq("offer_id", id)
      .order("sort_order");
    setLines(
      (ln ?? []).map((row: Record<string, unknown>) => {
        const pid = row.product_id as string | null;
        const catName = pid ? catalog.find((c) => c.id === pid)?.name : null;
        return {
          _key: newKey(),
          _name: catName ?? (row.label as string) ?? "",
          line_kind: row.line_kind as "product" | "gift",
          product_id: pid,
          label: row.label as string | null,
          quantity: row.quantity as number,
        };
      })
    );
  };

  const lineListUi = useMemo(
    () =>
      lines.map((l) => ({
        key: l._key,
        kind: l.line_kind,
        label: l._name || l.label || "—",
        sub: l.line_kind === "gift" ? "Cadeau" : undefined,
        qty: l.quantity,
      })),
    [lines]
  );

  const productCount = lines.filter((l) => l.line_kind === "product").length;
  const giftCount = lines.filter((l) => l.line_kind === "gift").length;

  const draftPreview = useMemo(() => {
    const priced = lines.map((l) => ({
      id: "",
      offer_id: "",
      line_kind: l.line_kind,
      sort_order: 0,
      product_id: l.product_id,
      label: l.label,
      quantity: l.quantity,
      product_name: l._name,
      price_pph: l.product_id ? catalog.find((c) => c.id === l.product_id)?.price_pph ?? null : null,
    }));
    return computePromoPackTotals(priced, offer.discount_percent || 0, (line) => {
      if (!line.product_id) return null;
      const cat = catalog.find((c) => c.id === line.product_id);
      if (!cat) return line.price_pph ?? null;
      return resolveCatalogPrice(
        catalogHitToPricingInput({
          id: cat.id,
          product_type: (cat as { product_type?: string }).product_type ?? "parapharmacie",
          price_pph: cat.price_pph,
          price_ppv: (cat as { price_ppv?: number | null }).price_ppv ?? null,
          laboratory: cat.laboratory,
        })
      );
    });
  }, [lines, offer.discount_percent, catalog, resolveCatalogPrice]);

  const unpublish = async (id: string) => {
    if (!confirm("Retirer cette offre de la fiche publique ?")) return;
    setBusy(true);
    const { error } = await supabase.from("pharmacy_promo_offers").update({ status: "draft" }).eq("id", id);
    setBusy(false);
    if (error) showToast(error.message, "error");
    else {
      showToast("Offre retirée de la publication.", "success");
      if (pharmacyId) await loadOffers(pharmacyId);
    }
  };

  const persist = async (publish: boolean) => {
    if (!pharmacyId) return;
    setBusy(true);
    const id = editingId === "new" ? null : editingId;
    const existing = id ? offers.find((o) => o.id === id) : null;
    const { error } = await savePromoOffer(pharmacyId, id, offer, lines, publish, existing?.status ?? null);
    setBusy(false);
    if (error) {
      showToast(error, "error");
      return;
    }
    showToast(publish ? "Offre publiée sur la fiche." : "Brouillon enregistré.", "success");
    setEditingId(null);
    await loadOffers(pharmacyId);
  };

  const addProduct = (p: PromoCatalogProduct) => {
    if (productCount >= MAX_PROMO_PRODUCT_LINES) {
      showToast(`Maximum ${MAX_PROMO_PRODUCT_LINES} produits.`, "warning");
      return;
    }
    if (lines.some((l) => l.line_kind === "product" && l.product_id === p.id)) {
      showToast("Produit déjà dans le pack.", "warning");
      return;
    }
    setLines((prev) => [
      ...prev,
      { _key: newKey(), _name: p.name, line_kind: "product", product_id: p.id, label: null, quantity: 1 },
    ]);
  };

  const addGiftText = () => {
    const t = giftText.trim();
    if (!t) return;
    if (giftCount >= MAX_PROMO_GIFT_LINES) {
      showToast(`Maximum ${MAX_PROMO_GIFT_LINES} cadeaux.`, "warning");
      return;
    }
    setLines((prev) => [...prev, { _key: newKey(), _name: t, line_kind: "gift", product_id: null, label: t, quantity: 1 }]);
    setGiftText("");
  };

  const addGiftProduct = (p: PromoCatalogProduct) => {
    if (giftCount >= MAX_PROMO_GIFT_LINES) {
      showToast(`Maximum ${MAX_PROMO_GIFT_LINES} cadeaux.`, "warning");
      return;
    }
    setLines((prev) => [
      ...prev,
      { _key: newKey(), _name: p.name, line_kind: "gift", product_id: p.id, label: p.name, quantity: 1 },
    ]);
  };

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-4">
      <div>
        <Link href="/dashboard/pharmacien" className="text-xs font-medium text-primary underline">
          ← Tableau de bord
        </Link>
        <h1 className="mt-2 text-lg font-bold">Offres et promos</h1>
        <p className="text-xs text-muted-foreground">
          Créez des packs promo (max. 5 produits + 5 cadeaux). Publiez pour les afficher sur votre fiche publique.
        </p>
        <Link
          href="/dashboard/pharmacien/reservations-packs"
          className="mt-2 inline-flex text-sm font-semibold text-amber-800 underline"
        >
          Réservations de packs →
        </Link>
      </div>

      <ScheduleToast message={toast.message} tone={toast.tone} onDismiss={() => setToast({ message: "", tone: "info" })} />

      {!editingId ? (
        <>
          <button
            type="button"
            onClick={startNew}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
          >
            <Plus className="size-4" />
            Nouvelle offre
          </button>
          <ul className="space-y-2">
            {offers.map((o) => {
              const today = todayIsoCasablanca();
              const expired = o.valid_until < today;
              const pending = pendingByOffer.get(o.id) ?? 0;
              return (
              <li key={o.id} className="rounded-xl border bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-sm">{o.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      −{o.discount_percent} % · {formatPromoValidityFr(o.valid_from, o.valid_until)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span
                        className={clsx(
                          "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          o.status === "published" ? "bg-emerald-50 text-emerald-900" : "bg-muted text-muted-foreground"
                        )}
                      >
                        {o.status === "published" ? "Publiée" : "Brouillon"}
                      </span>
                      {expired ? (
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          Expirée
                        </span>
                      ) : null}
                      {pending > 0 ? (
                        <Link
                          href="/dashboard/pharmacien/reservations-packs"
                          className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900"
                        >
                          {pending} à traiter
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button type="button" className="text-xs font-semibold text-primary underline" onClick={() => void startEdit(o.id)}>
                      Modifier
                    </button>
                    {o.status === "published" ? (
                      <button
                        type="button"
                        className="text-xs font-semibold text-amber-800 underline"
                        disabled={busy}
                        onClick={() => void unpublish(o.id)}
                      >
                        Dépublier
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-semibold text-destructive underline"
                      disabled={busy}
                      onClick={() => {
                        if (!confirm("Supprimer cette offre ?")) return;
                        setBusy(true);
                        void deletePromoOffer(o.id).then(async (err) => {
                          setBusy(false);
                          if (err) showToast(err, "error");
                          else {
                            showToast("Offre supprimée.", "success");
                            if (pharmacyId) await loadOffers(pharmacyId);
                          }
                        });
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            );
            })}
            {offers.length === 0 ? <p className="text-sm text-muted-foreground">Aucune offre pour le moment.</p> : null}
          </ul>
        </>
      ) : (
        <CompactCard>
          <CompactCardBody className="space-y-3">
            <p className="text-xs font-bold">{editingId === "new" ? "Nouvelle offre" : "Modifier l'offre"}</p>
            <label className="block text-xs font-bold">
              Titre du pack
              <input
                className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                value={offer.title}
                maxLength={120}
                onChange={(e) => setOffer((o) => ({ ...o, title: e.target.value }))}
              />
            </label>
            <label className="block text-xs font-bold">
              Description (optionnel)
              <textarea
                className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
                rows={2}
                maxLength={800}
                value={offer.description}
                onChange={(e) => setOffer((o) => ({ ...o, description: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs font-bold">
                Remise %
                <input
                  type="number"
                  min={1}
                  max={99}
                  className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                  value={offer.discount_percent}
                  onChange={(e) => setOffer((o) => ({ ...o, discount_percent: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className="text-xs font-bold">
                Du
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                  value={offer.valid_from}
                  onChange={(e) => setOffer((o) => ({ ...o, valid_from: e.target.value }))}
                />
              </label>
              <label className="text-xs font-bold">
                Au
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
                  value={offer.valid_until}
                  onChange={(e) => setOffer((o) => ({ ...o, valid_until: e.target.value }))}
                />
              </label>
            </div>

            <div className="rounded-xl border border-border/70 bg-muted/10 p-2.5 space-y-2">
              <p className="flex items-center gap-1 text-xs font-bold">
                <Package className="size-3.5" /> Produits ({productCount}/{MAX_PROMO_PRODUCT_LINES})
              </p>
              <PromoProductPicker products={catalog} disabled={busy} onPick={addProduct} />
              <PromoCompactLinesList
                lines={lineListUi.filter((l) => l.kind === "product")}
                onRemove={(k) => setLines((p) => p.filter((l) => l._key !== k))}
                onQtyChange={(k, q) => setLines((p) => p.map((l) => (l._key === k ? { ...l, quantity: q } : l)))}
              />
            </div>

            <div className="rounded-xl border border-amber-200/60 bg-amber-50/30 p-2.5 space-y-2">
              <p className="flex items-center gap-1 text-xs font-bold text-amber-950">
                <Gift className="size-3.5" /> Cadeaux ({giftCount}/{MAX_PROMO_GIFT_LINES})
              </p>
              <div className="flex gap-1">
                <input
                  className="h-9 min-w-0 flex-1 rounded-lg border px-2 text-xs"
                  placeholder="Ex. Trousse de plage"
                  value={giftText}
                  onChange={(e) => setGiftText(e.target.value)}
                />
                <button type="button" className="shrink-0 rounded-lg border px-2 text-xs font-bold" onClick={addGiftText}>
                  + Texte
                </button>
              </div>
              <PromoProductPicker products={catalog} disabled={busy} onPick={addGiftProduct} />
              <PromoCompactLinesList
                lines={lineListUi.filter((l) => l.kind === "gift")}
                onRemove={(k) => setLines((p) => p.filter((l) => l._key !== k))}
                onQtyChange={(k, q) => setLines((p) => p.map((l) => (l._key === k ? { ...l, quantity: q } : l)))}
              />
            </div>

            {draftPreview.subtotal > 0 ? (
              <p className="rounded-lg bg-emerald-50/60 px-2.5 py-2 text-[11px] tabular-nums text-emerald-950">
                Aperçu pack : {formatDh(draftPreview.subtotal)} → <strong>{formatDh(draftPreview.total)}</strong> après remise
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} className="rounded-xl border px-3 py-2 text-sm font-bold" onClick={() => void persist(false)}>
                Enregistrer brouillon
              </button>
              <button
                type="button"
                disabled={busy}
                className="rounded-xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                onClick={() => void persist(true)}
              >
                Publier
              </button>
              <button type="button" className="text-sm underline text-muted-foreground" onClick={() => setEditingId(null)}>
                Annuler
              </button>
            </div>
          </CompactCardBody>
        </CompactCard>
      )}

      {pharmacyId ? (
        <Link href={`/pharmacie/${pharmacyId}`} className="inline-block text-sm font-medium text-emerald-800 underline">
          Voir la fiche publique
        </Link>
      ) : null}
    </PageShell>
  );
}
