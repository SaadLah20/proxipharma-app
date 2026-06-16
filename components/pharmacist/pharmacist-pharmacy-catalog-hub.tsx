"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Loader2, Package, PackagePlus, RefreshCw } from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import {
  PharmacyCatalogProductFormModal,
} from "@/components/catalog/pharmacy-catalog-product-form-modal";
import {
  archivePharmacyCatalogProduct,
  listPharmacyCatalogProducts,
  republishPharmacyCatalogProduct,
  restorePharmacyCatalogProduct,
  unpublishPharmacyCatalogProduct,
} from "@/lib/pharmacy-catalog-api";
import {
  emptyPharmacyCatalogProductForm,
  pharmacyCatalogStatusLabelFr,
  type PharmacyCatalogProductRow,
  type PharmacyCatalogProductStatus,
} from "@/lib/pharmacy-catalog-types";
import { supabase } from "@/lib/supabase";
import { formatPriceDh } from "@/lib/product-price";

type StatusFilter = "all" | PharmacyCatalogProductStatus;

function unitPriceLabel(row: PharmacyCatalogProductRow): string {
  if (row.product_type === "medicament") {
    return row.price_ppv != null ? formatPriceDh(Number(row.price_ppv)) : "—";
  }
  return row.price_pph != null ? formatPriceDh(Number(row.price_pph)) : "—";
}

function pharmacistHubStatusLabel(status: PharmacyCatalogProductStatus): string {
  if (status === "archived_hidden") return "Supprimé";
  return pharmacyCatalogStatusLabelFr(status);
}

function rowToFormValues(row: PharmacyCatalogProductRow) {
  return {
    ...emptyPharmacyCatalogProductForm(),
    name: row.name,
    product_type: row.product_type,
    price_pph: row.price_pph != null ? String(row.price_pph) : "",
    price_ppv: row.price_ppv != null ? String(row.price_ppv) : "",
    brand: row.brand ?? "",
    laboratory: row.laboratory ?? "",
    photo_url: row.photo_url ?? "",
    short_description: row.short_description ?? "",
    full_description: row.full_description ?? "",
  };
}

export function PharmacistPharmacyCatalogHub() {
  const [rows, setRows] = useState<PharmacyCatalogProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<PharmacyCatalogProductRow | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPharmacyCatalogProducts(supabase, null);
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
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const handleUnpublish = async (row: PharmacyCatalogProductRow) => {
    setActionBusyId(row.id);
    setError("");
    try {
      await unpublishPharmacyCatalogProduct(supabase, row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRepublish = async (row: PharmacyCatalogProductRow) => {
    setActionBusyId(row.id);
    setError("");
    try {
      await republishPharmacyCatalogProduct(supabase, row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRestore = async (row: PharmacyCatalogProductRow) => {
    setActionBusyId(row.id);
    setError("");
    try {
      await restorePharmacyCatalogProduct(supabase, row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restauration impossible.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleArchive = async (row: PharmacyCatalogProductRow) => {
    if (
      !window.confirm(
        `Supprimer « ${row.name} » de votre catalogue ?\n\nLe produit apparaîtra dans « Supprimés » et pourra être restauré. Il restera visible dans vos dossiers déjà envoyés.`
      )
    ) {
      return;
    }
    setActionBusyId(row.id);
    setError("");
    try {
      await archivePharmacyCatalogProduct(supabase, row.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setActionBusyId(null);
    }
  };

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Tous" },
    { id: "active", label: "Actifs" },
    { id: "unpublished", label: "Dépubliés" },
    { id: "archived_hidden", label: "Supprimés" },
    { id: "archived_published", label: "Archivés (national)" },
  ];

  return (
    <PageShell className={chrome.page}>
      <PharmacistAccountPageHeader
        title="Mes produits"
        subtitle="Catalogue privé de votre officine — débloquez vos réponses et enrichissez la base Pharmeto."
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
        >
          <PackagePlus className="size-3.5" aria-hidden />
          Ajouter un produit
        </button>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold"
          disabled={loading}
        >
          <RefreshCw className={clsx("size-3.5", loading && "animate-spin")} aria-hidden />
          Actualiser
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <CompactCard>
            <CompactCardBody className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
              <Package className="size-8 opacity-40" aria-hidden />
              <p>Aucun produit dans cette vue.</p>
              {filter === "all" || filter === "active" ? (
                <button
                  type="button"
                  className="text-xs font-semibold text-primary"
                  onClick={() => setAddOpen(true)}
                >
                  Ajouter votre premier produit
                </button>
              ) : null}
            </CompactCardBody>
          </CompactCard>
        ) : (
          filtered.map((row) => (
            <CompactCard key={row.id}>
              <CompactCardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{row.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.product_type === "medicament" ? "Médicament" : "Parapharmacie"}
                    {" · "}
                    {row.product_type === "medicament" ? "PPV" : "PPH"} {unitPriceLabel(row)}
                  </p>
                  <span
                    className={clsx(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      row.status === "active" && "bg-emerald-100 text-emerald-900",
                      row.status === "unpublished" && "bg-amber-100 text-amber-900",
                      row.status === "archived_hidden" && "bg-rose-100 text-rose-900",
                      row.status === "archived_published" && "bg-slate-200 text-slate-800"
                    )}
                  >
                    {pharmacistHubStatusLabel(row.status)}
                  </span>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {row.status === "active" || row.status === "unpublished" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold"
                      onClick={() => setEditRow(row)}
                    >
                      Modifier
                    </button>
                  ) : null}
                  {row.status === "active" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-amber-300/80 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-950"
                      disabled={actionBusyId === row.id}
                      onClick={() => void handleUnpublish(row)}
                    >
                      Dépublier
                    </button>
                  ) : null}
                  {row.status === "unpublished" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-300/80 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-950"
                      disabled={actionBusyId === row.id}
                      onClick={() => void handleRepublish(row)}
                    >
                      Republier
                    </button>
                  ) : null}
                  {row.status === "archived_hidden" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-emerald-300/80 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-950"
                      disabled={actionBusyId === row.id}
                      onClick={() => void handleRestore(row)}
                    >
                      Restaurer
                    </button>
                  ) : null}
                  {row.status === "active" || row.status === "unpublished" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-[11px] font-semibold text-destructive"
                      disabled={actionBusyId === row.id}
                      onClick={() => void handleArchive(row)}
                    >
                      Supprimer
                    </button>
                  ) : null}
                  {row.status === "archived_published" && row.promoted_product_id ? (
                    <span className="self-center text-[10px] text-muted-foreground">
                      Géré par le catalogue national
                    </span>
                  ) : null}
                </div>
              </CompactCardBody>
            </CompactCard>
          ))
        )}
      </div>

      <PharmacyCatalogProductFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => {
          void load();
        }}
      />

      {editRow ? (
        <PharmacyCatalogProductFormModal
          key={editRow.id}
          open
          editProductId={editRow.id}
          initialValues={rowToFormValues(editRow)}
          onClose={() => setEditRow(null)}
          onCreated={() => {}}
          onUpdated={() => {
            setEditRow(null);
            void load();
          }}
        />
      ) : null}
    </PageShell>
  );
}
