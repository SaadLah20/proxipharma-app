"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import {
  PARAPHARMACY_MARGIN_MAX,
  PARAPHARMACY_MARGIN_MIN,
  type PharmacyPricingConfig,
  type PharmacyPricingBrandRule,
  type PharmacyPricingProductOverride,
  type ParapharmacyPricingMode,
} from "@/lib/pharmacy-pricing/types";
import {
  fetchDistinctParapharmacyBrands,
  fetchPharmacistPricingConfig,
  savePharmacistPricingConfig,
} from "@/lib/pharmacy-pricing/api";
import { productEmbedToPricingInput } from "@/lib/pharmacy-pricing/product-embed";
import { resolvePharmacyUnitPrice } from "@/lib/pharmacy-pricing/resolve";
import { normalizeBrandKey } from "@/lib/pharmacy-pricing/normalize";
import { formatPriceDh } from "@/lib/product-price";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { searchProductsCatalog } from "@/lib/products-catalog-search";

type TabId = "general" | "brands" | "products";

type CatalogHit = {
  id: string;
  name: string;
  product_type: string;
  brand: string | null;
  price_pph: number | null;
  price_ppv: number | null;
};

function marginLabel(pct: number): string {
  if (pct === 0) return "PPH (référentiel)";
  if (pct > 0) return `PPH + ${pct.toFixed(0)} %`;
  return `PPH ${pct.toFixed(0)} %`;
}

export function PharmacistPricingManager() {
  const [tab, setTab] = useState<TabId>("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PharmacyPricingConfig | null>(null);
  const [brandsCatalog, setBrandsCatalog] = useState<
    { brand_key: string; brand_display: string; product_count: number }[]
  >([]);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productHits, setProductHits] = useState<CatalogHit[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const row = await fetchPharmacistPricingConfig(supabase);
      if (!row) {
        setConfig(null);
        return;
      }
      setConfig(row);
      const brands = await fetchDistinctParapharmacyBrands(supabase);
      setBrandsCatalog(brands);
    } catch (e) {
      setFeedback({ type: "err", text: e instanceof Error ? e.message : "Chargement impossible." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const previewPara = useMemo(() => {
    if (!config) return null;
    const sample = { product_type: "parapharmacie", price_pph: 100, brand: null as string | null };
    return resolvePharmacyUnitPrice(config, sample);
  }, [config]);

  const updateSettings = (patch: Partial<PharmacyPricingConfig["settings"]>) => {
    if (!config) return;
    setConfig({ ...config, settings: { ...config.settings, ...patch } });
  };

  const brandRulesByKey = useMemo(() => {
    const m = new Map<string, PharmacyPricingBrandRule>();
    for (const r of config?.brand_rules ?? []) m.set(r.brand_key, r);
    return m;
  }, [config?.brand_rules]);

  const setBrandMargin = (brandKey: string, brandDisplay: string, marginPct: number) => {
    if (!config) return;
    const clamped = Math.min(PARAPHARMACY_MARGIN_MAX, Math.max(PARAPHARMACY_MARGIN_MIN, marginPct));
    const others = config.brand_rules.filter((r) => r.brand_key !== brandKey);
    if (Number.isNaN(clamped)) return;
    setConfig({
      ...config,
      brand_rules: [
        ...others,
        { brand_key: brandKey, brand_display: brandDisplay, margin_pct: clamped },
      ],
    });
  };

  const removeBrandRule = (brandKey: string) => {
    if (!config) return;
    setConfig({
      ...config,
      brand_rules: config.brand_rules.filter((r) => r.brand_key !== brandKey),
    });
  };

  const addProductOverride = (hit: CatalogHit, marginPct: number) => {
    if (!config || hit.product_type !== "parapharmacie") return;
    const clamped = Math.min(PARAPHARMACY_MARGIN_MAX, Math.max(PARAPHARMACY_MARGIN_MIN, marginPct));
    const others = config.product_overrides.filter((o) => o.product_id !== hit.id);
    setConfig({
      ...config,
      product_overrides: [
        ...others,
        {
          product_id: hit.id,
          product_name: hit.name,
          brand: hit.brand,
          product_type: hit.product_type,
          price_pph: hit.price_pph,
          price_ppv: hit.price_ppv,
          margin_pct: clamped,
        },
      ],
    });
    setProductQuery("");
    setProductHits([]);
  };

  const removeProductOverride = (productId: string) => {
    if (!config) return;
    setConfig({
      ...config,
      product_overrides: config.product_overrides.filter((o) => o.product_id !== productId),
    });
  };

  const brandSearchQ = useMemo(() => sanitizeProductSearchQuery(brandQuery), [brandQuery]);
  const visibleBrands = useMemo(() => {
    if (!brandSearchQ) return brandsCatalog;
    const needle = brandSearchQ.toLowerCase();
    return brandsCatalog.filter((b) => b.brand_display.toLowerCase().includes(needle));
  }, [brandsCatalog, brandSearchQ]);

  const productSearchQ = useMemo(() => sanitizeProductSearchQuery(productQuery), [productQuery]);
  const productSearchActive = productSearchQ.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS;
  const visibleProductHits = productSearchActive ? productHits : [];

  useEffect(() => {
    if (!productSearchActive) return;
    let cancelled = false;
    const loadingTid = window.setTimeout(() => setProductSearchLoading(true), 0);
    void (async () => {
      try {
        const data = await searchProductsCatalog(supabase, {
          query: productSearchQ,
          productType: "parapharmacie",
          limit: PRODUCT_CATALOG_SEARCH_LIMIT,
        });
        if (cancelled) return;
        setProductHits(
          data.map((p) => ({
            id: p.id,
            name: p.name,
            product_type: p.product_type,
            brand: p.brand,
            price_pph: p.price_pph,
            price_ppv: p.price_ppv,
          }))
        );
      } catch {
        if (!cancelled) setProductHits([]);
      }
      if (!cancelled) setProductSearchLoading(false);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(loadingTid);
    };
  }, [productSearchQ, productSearchActive]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setFeedback(null);
    try {
      const saved = await savePharmacistPricingConfig(supabase, config);
      if (saved) setConfig(saved);
      setFeedback({ type: "ok", text: "Paramètres enregistrés." });
    } catch (e) {
      setFeedback({ type: "err", text: e instanceof Error ? e.message : "Enregistrement impossible." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Chargement des grilles…
      </p>
    );
  }

  if (!config) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Pharmacie non rattachée ou accès refusé.
      </p>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "general", label: "Général" },
    { id: "brands", label: "Marques" },
    { id: "products", label: "Produits" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              tab === t.id
                ? "bg-violet-600 text-white shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
            Enregistrer
          </Button>
        </div>
      </div>

      {feedback ? (
        <p
          className={clsx(
            "rounded-md px-3 py-2 text-xs font-medium",
            feedback.type === "ok" ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900"
          )}
        >
          {feedback.text}
        </p>
      ) : null}

      <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 text-[11px] leading-snug text-violet-950">
        <strong>Médicaments</strong> : toujours au <strong>PPV</strong> catalogue (non modifiable ici).{" "}
        <strong>Parapharmacie</strong> : marge sur le PPH entre {PARAPHARMACY_MARGIN_MIN} % et +{PARAPHARMACY_MARGIN_MAX} %.
        Priorité : produit &gt; marque &gt; règle globale.
      </div>

      {tab === "general" ? (
        <>
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold text-foreground">Affichage des prix au patient</h2>
            <p className="text-[11px] leading-snug text-muted-foreground">
              Choisissez si le patient voit les prix indicatifs du catalogue avant votre réponse officielle.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50/50">
                <input
                  type="radio"
                  name="catalog_price_visibility"
                  className="mt-0.5"
                  checked={config.settings.show_catalog_prices_before_response !== false}
                  onChange={() => updateSettings({ show_catalog_prices_before_response: true })}
                />
                <span>
                  <span className="font-semibold">Dès la sélection</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Le patient voit le PU indicatif dans le catalogue et son panier.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50/50">
                <input
                  type="radio"
                  name="catalog_price_visibility"
                  className="mt-0.5"
                  checked={config.settings.show_catalog_prices_before_response === false}
                  onChange={() => updateSettings({ show_catalog_prices_before_response: false })}
                />
                <span>
                  <span className="font-semibold">Après ma réponse</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Les prix restent masqués jusqu&apos;à la publication de votre réponse officielle.
                  </span>
                </span>
              </label>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold text-foreground">Parapharmacie — règle globale</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50/50">
              <input
                type="radio"
                name="para_mode"
                className="mt-0.5"
                checked={config.settings.parapharmacy_mode === "at_pph"}
                onChange={() => updateSettings({ parapharmacy_mode: "at_pph" as ParapharmacyPricingMode, parapharmacy_margin_pct: 0 })}
              />
              <span>
                <span className="font-semibold">Vendre au PPH</span>
                <span className="mt-0.5 block text-muted-foreground">Prix référentiel catalogue, sans marge.</span>
              </span>
            </label>
            <label className="flex flex-1 cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-xs has-[:checked]:border-violet-400 has-[:checked]:bg-violet-50/50">
              <input
                type="radio"
                name="para_mode"
                className="mt-0.5"
                checked={config.settings.parapharmacy_mode === "margin_on_pph"}
                onChange={() => updateSettings({ parapharmacy_mode: "margin_on_pph" })}
              />
              <span className="flex-1">
                <span className="font-semibold">Marge sur le PPH</span>
                <span className="mt-0.5 block text-muted-foreground">Ajustement global parapharmacie.</span>
              </span>
            </label>
          </div>
          {config.settings.parapharmacy_mode === "margin_on_pph" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Marge globale</span>
                <span className="font-bold text-violet-800">{marginLabel(config.settings.parapharmacy_margin_pct)}</span>
              </div>
              <input
                type="range"
                min={PARAPHARMACY_MARGIN_MIN}
                max={PARAPHARMACY_MARGIN_MAX}
                step={1}
                value={config.settings.parapharmacy_margin_pct}
                onChange={(e) => updateSettings({ parapharmacy_margin_pct: Number(e.target.value) })}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{PARAPHARMACY_MARGIN_MIN} %</span>
                <span>0</span>
                <span>+{PARAPHARMACY_MARGIN_MAX} %</span>
              </div>
            </div>
          ) : null}
          {previewPara != null ? (
            <p className="text-xs text-muted-foreground">
              Exemple (PPH 100 DH) → <strong className="text-foreground">{formatPriceDh(previewPara)}</strong> affiché patient
            </p>
          ) : null}
        </section>
        </>
      ) : null}

      {tab === "brands" ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Marges par marque</h2>
          <p className="text-[11px] text-muted-foreground">
            Remplace la règle globale pour les produits parapharmacie de la marque concernée (colonne catalogue).
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="Rechercher une marque…"
              className="w-full rounded-lg border border-input py-2 pl-8 pr-3 text-xs"
            />
          </div>
          {brandSearchQ ? (
            <p className="text-[11px] text-muted-foreground">
              {visibleBrands.length === 0
                ? "Aucun résultat"
                : visibleBrands.length === 1
                  ? "1 marque trouvée"
                  : `${visibleBrands.length} marques trouvées`}
            </p>
          ) : null}
          <ul className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {brandsCatalog.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucune marque renseignée dans le catalogue parapharmacie.</li>
            ) : visibleBrands.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucune marque ne correspond à votre recherche.</li>
            ) : (
              visibleBrands.map((brandRow) => {
                const key = brandRow.brand_key || normalizeBrandKey(brandRow.brand_display);
                const rule = brandRulesByKey.get(key);
                const margin = rule?.margin_pct ?? config.settings.parapharmacy_margin_pct;
                const active = Boolean(rule);
                return (
                  <li
                    key={key}
                    className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{brandRow.brand_display}</p>
                      <p className="text-[10px] text-muted-foreground">{brandRow.product_count} produit(s)</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="range"
                        min={PARAPHARMACY_MARGIN_MIN}
                        max={PARAPHARMACY_MARGIN_MAX}
                        step={1}
                        value={margin}
                        onChange={(e) =>
                          setBrandMargin(key, brandRow.brand_display, Number(e.target.value))
                        }
                        className="w-32 accent-violet-600 sm:w-40"
                        aria-label={`Marge ${brandRow.brand_display}`}
                      />
                      <span className="w-20 text-right text-[11px] font-semibold tabular-nums">
                        {marginLabel(margin)}
                      </span>
                      {active ? (
                        <button
                          type="button"
                          className="rounded p-1 text-rose-700 hover:bg-rose-50"
                          title="Revenir à la règle globale"
                          onClick={() => removeBrandRule(key)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rounded p-1 text-violet-700 hover:bg-violet-50"
                          title="Personnaliser cette marque"
                          onClick={() => setBrandMargin(key, brandRow.brand_display, config.settings.parapharmacy_margin_pct)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>
      ) : null}

      {tab === "products" ? (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Marges par produit</h2>
          <p className="text-[11px] text-muted-foreground">Priorité maximale — parapharmacie uniquement.</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={`Rechercher un produit (${PRODUCT_CATALOG_SEARCH_MIN_CHARS}+ caractères)…`}
              className="w-full rounded-lg border border-input py-2 pl-8 pr-3 text-xs"
            />
          </div>
          {productSearchActive && productSearchLoading ? (
            <p className="text-xs text-muted-foreground">Recherche…</p>
          ) : null}
          {visibleProductHits.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-dashed border-border p-2">
              {visibleProductHits.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium">{h.name}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-[10px]"
                    onClick={() => addProductOverride(h, config.settings.parapharmacy_margin_pct || 15)}
                  >
                    Ajouter règle
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="space-y-2">
            {config.product_overrides.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucune règle produit.</li>
            ) : (
              config.product_overrides.map((o) => (
                <ProductOverrideRow
                  key={o.product_id}
                  override={o}
                  config={config}
                  onMargin={(pct) => {
                    const hit: CatalogHit = {
                      id: o.product_id,
                      name: o.product_name ?? "Produit",
                      product_type: "parapharmacie",
                      brand: o.brand ?? null,
                      price_pph: o.price_pph ?? null,
                      price_ppv: o.price_ppv ?? null,
                    };
                    addProductOverride(hit, pct);
                  }}
                  onRemove={() => removeProductOverride(o.product_id)}
                />
              ))
            )}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ProductOverrideRow({
  override: o,
  config,
  onMargin,
  onRemove,
}: {
  override: PharmacyPricingProductOverride;
  config: PharmacyPricingConfig;
  onMargin: (pct: number) => void;
  onRemove: () => void;
}) {
  const resolved = resolvePharmacyUnitPrice(
    config,
    productEmbedToPricingInput(
      {
        product_type: o.product_type ?? "parapharmacie",
        price_pph: o.price_pph,
        price_ppv: o.price_ppv,
        brand: o.brand,
      },
      o.product_id
    )
  );
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{o.product_name ?? o.product_id}</p>
        <p className="text-[10px] text-muted-foreground">
          Prix patient : <strong>{formatPriceDh(resolved)}</strong>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={PARAPHARMACY_MARGIN_MIN}
          max={PARAPHARMACY_MARGIN_MAX}
          step={1}
          value={o.margin_pct}
          onChange={(e) => onMargin(Number(e.target.value))}
          className="w-32 accent-violet-600"
        />
        <span className="w-20 text-right text-[11px] font-semibold">{marginLabel(o.margin_pct)}</span>
        <button type="button" className="rounded p-1 text-rose-700 hover:bg-rose-50" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
