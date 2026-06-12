"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { CheckCircle2, Globe, Loader2, Package, RefreshCw } from "lucide-react";
import {
  adminCommunityEventLabelFr,
  adminCommunityRowToFormValues,
  enrichAdminCommunityCatalogProduct,
  listAdminCommunityCatalogEvents,
  listAdminCommunityCatalogProducts,
  publishAdminCommunityCatalogProduct,
  type AdminCommunityCatalogEvent,
  type AdminCommunityCatalogFormValues,
  type AdminCommunityCatalogRow,
} from "@/lib/admin-community-catalog-api";
import { pharmacyCatalogStatusLabelFr, type PharmacyCatalogProductStatus } from "@/lib/pharmacy-catalog-types";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { formatPriceDh } from "@/lib/product-price";
import { supabase } from "@/lib/supabase";

type StatusFilter = "pending" | PharmacyCatalogProductStatus | "all";

function unitPriceLabel(row: AdminCommunityCatalogRow): string {
  if (row.product_type === "medicament") {
    return row.price_ppv != null ? formatPriceDh(Number(row.price_ppv)) : "—";
  }
  return row.price_pph != null ? formatPriceDh(Number(row.price_pph)) : "—";
}

function validateForm(values: AdminCommunityCatalogFormValues): string | null {
  if (!values.name.trim()) return "Le nom est obligatoire.";
  if (values.product_type === "parapharmacie" && !values.price_pph.trim()) {
    return "Le PPH est obligatoire pour la parapharmacie.";
  }
  if (values.product_type === "medicament" && !values.price_ppv.trim()) {
    return "Le PPV est obligatoire pour les médicaments.";
  }
  return null;
}

function AdminCommunityProductDetail({
  row,
  onSaved,
  onPublished,
}: {
  row: AdminCommunityCatalogRow;
  onSaved: () => void;
  onPublished: () => void;
}) {
  const [values, setValues] = useState<AdminCommunityCatalogFormValues>(() => adminCommunityRowToFormValues(row));
  const [events, setEvents] = useState<AdminCommunityCatalogEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [forceDuplicate, setForceDuplicate] = useState(false);

  const readOnly = row.status === "archived_published";

  useEffect(() => {
    let cancelled = false;
    setEventsLoading(true);
    void listAdminCommunityCatalogEvents(supabase, row.id)
      .then((data) => {
        if (!cancelled) setEvents(data);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id, row.updated_at]);

  const handleSave = async () => {
    setError("");
    setSuccess("");
    const validation = validateForm(values);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy("save");
    try {
      await enrichAdminCommunityCatalogProduct(supabase, row.id, values);
      setSuccess("Enrichissement enregistré.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    if (!window.confirm(`Publier « ${values.name.trim()} » au catalogue national Pharmeto ?\n\nLa copie officine passera en archive lecture seule.`)) {
      return;
    }
    setError("");
    setSuccess("");
    setBusy("publish");
    try {
      const result = await publishAdminCommunityCatalogProduct(supabase, row.id, {
        forceDuplicate,
        notes: values.notes.trim() || undefined,
      });
      setSuccess(`Publié : ${result.global_product.name} (ID global enregistré).`);
      onPublished();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Publication impossible.";
      setError(msg);
      if (/doublon probable/i.test(msg)) {
        setForceDuplicate(true);
      }
    } finally {
      setBusy(null);
    }
  };

  const fieldClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{row.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.pharmacy_name} · {row.pharmacy_ville}
            {row.pharmacist_name ? ` · ${row.pharmacist_name}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Créé {formatDateTimeShort24hFr(row.created_at)} · MAJ {formatDateTimeShort24hFr(row.updated_at)}
          </p>
        </div>
        <span
          className={clsx(
            "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold",
            row.status === "active" && "bg-emerald-100 text-emerald-900",
            row.status === "unpublished" && "bg-amber-100 text-amber-900",
            row.status === "archived_published" && "bg-slate-200 text-slate-800"
          )}
        >
          {pharmacyCatalogStatusLabelFr(row.status)}
        </span>
      </div>

      {error ? (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="mb-3 rounded-lg border border-emerald-300/60 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {success}
        </p>
      ) : null}

      {readOnly && row.promoted_product_id ? (
        <p className="mb-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Publié au catalogue national — ID global : <code className="text-xs">{row.promoted_product_id}</code>
          {row.promoted_at ? ` · ${formatDateTimeShort24hFr(row.promoted_at)}` : ""}
        </p>
      ) : null}

      <form
        className="grid gap-3 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!readOnly) void handleSave();
        }}
      >
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Nom *</span>
          <input
            className={fieldClass}
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            disabled={readOnly}
            required
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Type *</span>
          <select
            className={fieldClass}
            value={values.product_type}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                product_type: e.target.value as AdminCommunityCatalogFormValues["product_type"],
              }))
            }
            disabled={readOnly}
          >
            <option value="parapharmacie">Parapharmacie</option>
            <option value="medicament">Médicament</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">
            {values.product_type === "medicament" ? "PPV *" : "PPH *"}
          </span>
          {values.product_type === "medicament" ? (
            <input
              className={fieldClass}
              value={values.price_ppv}
              onChange={(e) => setValues((v) => ({ ...v, price_ppv: e.target.value }))}
              disabled={readOnly}
            />
          ) : (
            <input
              className={fieldClass}
              value={values.price_pph}
              onChange={(e) => setValues((v) => ({ ...v, price_pph: e.target.value }))}
              disabled={readOnly}
            />
          )}
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Marque</span>
          <input
            className={fieldClass}
            value={values.brand}
            onChange={(e) => setValues((v) => ({ ...v, brand: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Laboratoire</span>
          <input
            className={fieldClass}
            value={values.laboratory}
            onChange={(e) => setValues((v) => ({ ...v, laboratory: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">URL photo</span>
          <input
            className={fieldClass}
            value={values.photo_url}
            onChange={(e) => setValues((v) => ({ ...v, photo_url: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Forme</span>
          <input
            className={fieldClass}
            value={values.form}
            onChange={(e) => setValues((v) => ({ ...v, form: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Catégorie</span>
          <input
            className={fieldClass}
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Sous-catégorie</span>
          <input
            className={fieldClass}
            value={values.subcategory}
            onChange={(e) => setValues((v) => ({ ...v, subcategory: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Description courte</span>
          <textarea
            className={clsx(fieldClass, "min-h-[72px]")}
            value={values.short_description}
            onChange={(e) => setValues((v) => ({ ...v, short_description: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        <label className="md:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Description complète</span>
          <textarea
            className={clsx(fieldClass, "min-h-[120px]")}
            value={values.full_description}
            onChange={(e) => setValues((v) => ({ ...v, full_description: e.target.value }))}
            disabled={readOnly}
          />
        </label>
        {!readOnly ? (
          <label className="md:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Note admin (journal)</span>
            <input
              className={fieldClass}
              value={values.notes}
              onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
              placeholder="Facultatif — visible dans l'historique"
            />
          </label>
        ) : null}

        {!readOnly ? (
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy !== null}
            >
              {busy === "save" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
              Enregistrer l&apos;enrichissement
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => void handlePublish()}
            >
              {busy === "publish" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Globe className="size-4" aria-hidden />}
              Publier au catalogue national
            </button>
            {forceDuplicate ? (
              <p className="w-full text-xs text-amber-800">
                Un doublon a été détecté. Cliquez à nouveau sur Publier pour forcer si vous confirmez.
              </p>
            ) : null}
          </div>
        ) : null}
      </form>

      <details className="mt-6 rounded-lg border bg-slate-50/80 p-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Historique ({row.event_count} événement{row.event_count > 1 ? "s" : ""})
        </summary>
        <div className="mt-3 space-y-2">
          {eventsLoading ? (
            <p className="text-xs text-muted-foreground">Chargement…</p>
          ) : events.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun événement.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="rounded border bg-white px-2.5 py-2 text-xs">
                <p className="font-semibold">{adminCommunityEventLabelFr(ev.event_type)}</p>
                <p className="text-muted-foreground">{formatDateTimeShort24hFr(ev.created_at)}</p>
                {ev.notes ? <p className="mt-1 text-slate-700">{ev.notes}</p> : null}
              </div>
            ))
          )}
        </div>
      </details>
    </div>
  );
}

export function AdminCommunityProductsPanel() {
  const [rows, setRows] = useState<AdminCommunityCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminCommunityCatalogProducts(supabase, null);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "pending") return rows.filter((r) => r.status === "active" || r.status === "unpublished");
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const selected = useMemo(() => {
    if (filtered.length === 0) return null;
    if (selectedId && filtered.some((r) => r.id === selectedId)) {
      return filtered.find((r) => r.id === selectedId) ?? null;
    }
    return filtered[0];
  }, [filtered, selectedId]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "pending", label: "À publier" },
    { id: "active", label: "Actifs" },
    { id: "unpublished", label: "Dépubliés" },
    { id: "archived_published", label: "Archivés (national)" },
    { id: "all", label: "Tous" },
  ];

  const pendingCount = rows.filter((r) => r.status === "active" || r.status === "unpublished").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold"
          disabled={loading}
        >
          <RefreshCw className={clsx("size-3.5", loading && "animate-spin")} aria-hidden />
          Actualiser
        </button>
        <span className="text-xs text-muted-foreground">
          {pendingCount} produit{pendingCount > 1 ? "s" : ""} en attente de publication
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              filter === f.id ? "bg-slate-900 text-white" : "bg-muted text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-center text-sm text-muted-foreground">
              <Package className="mx-auto mb-2 size-8 opacity-40" aria-hidden />
              Aucun produit dans cette vue.
            </div>
          ) : (
            filtered.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={clsx(
                  "w-full rounded-xl border bg-white p-3 text-left transition-colors",
                  selected?.id === row.id ? "border-slate-900 ring-1 ring-slate-900" : "hover:border-slate-400"
                )}
              >
                <p className="truncate text-sm font-semibold">{row.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {row.pharmacy_name} · {row.product_type === "medicament" ? "PPV" : "PPH"} {unitPriceLabel(row)}
                </p>
                <span
                  className={clsx(
                    "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    row.status === "active" && "bg-emerald-100 text-emerald-900",
                    row.status === "unpublished" && "bg-amber-100 text-amber-900",
                    row.status === "archived_published" && "bg-slate-200 text-slate-800"
                  )}
                >
                  {pharmacyCatalogStatusLabelFr(row.status)}
                </span>
              </button>
            ))
          )}
        </div>

        <div>
          {selected ? (
            <AdminCommunityProductDetail
              key={`${selected.id}-${selected.updated_at}`}
              row={selected}
              onSaved={() => void load()}
              onPublished={() => void load()}
            />
          ) : (
            <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-muted-foreground">
              Sélectionnez un produit pour l&apos;enrichir ou le publier.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
