"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { CatalogProductReportModal } from "@/components/pharmacist/catalog-product-report-modal";
import { PharmacistReportedFieldReviewCard } from "@/components/admin/catalog-national-product-form-fields";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  catalogReportModalCancelBtnClassName,
  catalogReportModalFooterClassName,
  catalogReportModalPrimaryBtnClassName,
} from "@/lib/catalog-national-product-form";
import {
  cancelCatalogProductReport,
  getPharmacistCatalogProductReportDetail,
  listPharmacistCatalogProductReports,
  respondCatalogProductReport,
} from "@/lib/catalog-product-report-api";
import {
  catalogProductReportEventLabelFr,
  catalogProductReportStatusLabelFr,
  type CatalogProductReportDetail,
  type CatalogProductReportListRow,
  type PharmacistCatalogReportFilter,
} from "@/lib/catalog-product-report-types";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { PRODUCT_CATALOG_SEARCH_MIN_CHARS } from "@/lib/product-catalog-search";
import { searchPharmacyCatalog } from "@/lib/pharmacy-catalog-search";
import { useCatalogProductReportRefresh } from "@/lib/catalog-product-report-status-provider";
import { supabase } from "@/lib/supabase";

const FILTERS: { id: PharmacistCatalogReportFilter; label: string }[] = [
  { id: "active", label: "En cours" },
  { id: "awaiting_pharmacist", label: "À valider" },
  { id: "closed", label: "Clôturés" },
  { id: "cancelled", label: "Annulés" },
];

function statusBadgeClass(status: CatalogProductReportListRow["status"]): string {
  switch (status) {
    case "open":
      return "bg-slate-100 text-slate-800";
    case "awaiting_pharmacist":
      return "bg-amber-100 text-amber-900";
    case "reopened":
      return "bg-orange-100 text-orange-900";
    case "closed":
      return "bg-emerald-100 text-emerald-900";
    case "cancelled":
      return "bg-rose-100 text-rose-900";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function NationalCatalogProductSearchHits({
  pharmacyId,
  query,
  activeReportProductIds,
  rows,
  onPickNew,
  onPickExisting,
}: {
  pharmacyId: string;
  query: string;
  activeReportProductIds: string[];
  rows: CatalogProductReportListRow[];
  onPickNew: (product: { id: string; name: string }) => void;
  onPickExisting: (reportId: string) => void;
}) {
  const [hits, setHits] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void searchPharmacyCatalog(supabase, pharmacyId, query)
      .then((results) => {
        if (cancelled) return;
        setHits(results.filter((h) => h.source === "global").map((h) => ({ id: h.id, name: h.name })));
      })
      .catch(() => {
        if (!cancelled) setHits([]);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pharmacyId, query]);

  if (busy) return <p className="mt-2 text-xs text-muted-foreground">Recherche…</p>;
  if (hits.length === 0) return null;

  return (
    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border/70 p-1">
      {hits.map((h) => {
        const already = activeReportProductIds.includes(h.id);
        return (
          <li key={h.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60"
              onClick={() => {
                if (already) {
                  const row = rows.find((r) => r.product_id === h.id);
                  if (row) onPickExisting(row.id);
                  return;
                }
                onPickNew(h);
              }}
            >
              <span className="min-w-0 truncate font-medium">{h.name}</span>
              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                {already ? "Voir le signalement" : "Signaler"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ReportDetailPanel({
  detail,
  busy,
  onClose,
  onEdit,
  onCancel,
  onAccept,
  onReject,
}: {
  detail: CatalogProductReportDetail;
  busy: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onAccept: () => void;
  onReject: (message: string) => void;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMessage, setRejectMessage] = useState("");

  const canEdit = detail.status === "open" || detail.status === "reopened";
  const canCancel = detail.status === "open" || detail.status === "reopened" || detail.status === "awaiting_pharmacist";
  const canRespond = detail.status === "awaiting_pharmacist";

  return (
    <AppModalOverlay open aria-labelledby="report-detail-title" className="p-0 sm:p-4" onBackdropClick={busy ? undefined : onClose}>
      <div className="relative z-10 flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="border-b border-border px-4 py-3">
          <h2 id="report-detail-title" className="text-sm font-bold text-foreground">
            {detail.product_name}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {catalogProductReportStatusLabelFr(detail.status)} · {formatDateTimeShort24hFr(detail.updated_at)}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3 sm:px-4">
          {detail.latest_admin_message ? (
            <div className="rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 text-xs text-sky-950">
              <p className="font-semibold">Message Pharmeto</p>
              <p className="mt-1 whitespace-pre-wrap">{detail.latest_admin_message}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Champs signalés</p>
            {detail.fields.map((f) => (
              <PharmacistReportedFieldReviewCard key={f.field_key} field={f} />
            ))}
          </div>

          {detail.events.length > 0 ? (
            <details className="rounded-lg border bg-slate-50/80 p-3">
              <summary className="cursor-pointer text-xs font-semibold">Historique</summary>
              <div className="mt-2 space-y-2">
                {detail.events.map((ev) => (
                  <div key={ev.id} className="rounded border bg-white px-2.5 py-2 text-[11px]">
                    <p className="font-semibold">{catalogProductReportEventLabelFr(ev.event_type)}</p>
                    <p className="text-muted-foreground">{formatDateTimeShort24hFr(ev.created_at)}</p>
                    {ev.body ? <p className="mt-1 text-slate-700">{ev.body}</p> : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {rejectOpen ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-foreground">Pourquoi le traitement ne convient pas ?</label>
              <textarea
                value={rejectMessage}
                rows={3}
                className="w-full rounded-md border border-border px-2.5 py-2 text-xs"
                onChange={(e) => setRejectMessage(e.target.value)}
              />
            </div>
          ) : null}
        </div>

        <div className={catalogReportModalFooterClassName()}>
          <button type="button" className={catalogReportModalCancelBtnClassName()} disabled={busy} onClick={onClose}>
            Fermer
          </button>
          {canEdit ? (
            <button type="button" className={catalogReportModalCancelBtnClassName()} disabled={busy} onClick={onEdit}>
              Modifier
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-destructive/40 px-3 text-xs font-semibold text-destructive sm:h-8"
              disabled={busy}
              onClick={onCancel}
            >
              Annuler
            </button>
          ) : null}
          {canRespond ? (
            <>
              {!rejectOpen ? (
                <>
                  <button type="button" className={catalogReportModalPrimaryBtnClassName()} disabled={busy} onClick={onAccept}>
                    Valider
                  </button>
                  <button
                    type="button"
                    className={catalogReportModalCancelBtnClassName()}
                    disabled={busy}
                    onClick={() => setRejectOpen(true)}
                  >
                    Non
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={catalogReportModalPrimaryBtnClassName()}
                  disabled={busy || !rejectMessage.trim()}
                  onClick={() => onReject(rejectMessage.trim())}
                >
                  Envoyer
                </button>
              )}
            </>
          ) : null}
        </div>
      </div>
    </AppModalOverlay>
  );
}

export function PharmacistCatalogReportsHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bumpRefresh } = useCatalogProductReportRefresh();
  const [filter, setFilter] = useState<PharmacistCatalogReportFilter>("active");
  const [rows, setRows] = useState<CatalogProductReportListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CatalogProductReportDetail | null>(null);
  const [editReportId, setEditReportId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createProduct, setCreateProduct] = useState<{ id: string; name: string } | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);

  const trimmedSearch = searchQuery.trim();
  const searchReady = trimmedSearch.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS && Boolean(pharmacyId);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listPharmacistCatalogProductReports(supabase, filter);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user || cancelled) return;
      const { data: staff } = await supabase
        .from("pharmacy_staff")
        .select("pharmacy_id")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (!cancelled) setPharmacyId(staff?.pharmacy_id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const openReportId = searchParams.get("report");

  useEffect(() => {
    if (!openReportId) return;
    let cancelled = false;
    void getPharmacistCatalogProductReportDetail(supabase, openReportId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [openReportId]);

  const activeReportProductIds = useMemo(
    () => rows.filter((r) => r.status !== "closed" && r.status !== "cancelled").map((r) => r.product_id),
    [rows]
  );

  const openDetail = async (reportId: string) => {
    try {
      const d = await getPharmacistCatalogProductReportDetail(supabase, reportId);
      setDetail(d);
      router.replace(`/dashboard/pharmacien/produits-signales?report=${reportId}`, { scroll: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Détail impossible.");
    }
  };

  const closeDetail = () => {
    setDetail(null);
    router.replace("/dashboard/pharmacien/produits-signales", { scroll: false });
  };

  const handleSaved = () => {
    bumpRefresh();
    void load();
    setEditReportId(null);
    setCreateProduct(null);
  };

  const handleCancel = async () => {
    if (!detail) return;
    if (!window.confirm("Annuler ce signalement ?")) return;
    setBusyId(detail.id);
    try {
      await cancelCatalogProductReport(supabase, detail.id);
      bumpRefresh();
      closeDetail();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Annulation impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const handleAccept = async () => {
    if (!detail) return;
    setBusyId(detail.id);
    try {
      await respondCatalogProductReport(supabase, detail.id, true);
      bumpRefresh();
      closeDetail();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Validation impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (message: string) => {
    if (!detail) return;
    setBusyId(detail.id);
    try {
      await respondCatalogProductReport(supabase, detail.id, false, message);
      bumpRefresh();
      closeDetail();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageShell>
      <PharmacistAccountPageHeader
        title="Produits signalés"
        subtitle="Signalez des erreurs sur le catalogue national Pharmeto et suivez leur traitement."
      />

      <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
          <p className="text-[11px] font-semibold text-foreground">Signaler un produit du catalogue national</p>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit (2 caractères min.)"
              className="h-10 w-full rounded-xl border border-border bg-background py-2 pl-10 pr-3 text-sm"
            />
          </div>
          {searchReady ? (
            <NationalCatalogProductSearchHits
              key={`${pharmacyId}-${trimmedSearch}`}
              pharmacyId={pharmacyId!}
              query={trimmedSearch}
              activeReportProductIds={activeReportProductIds}
              rows={rows}
              onPickNew={setCreateProduct}
              onPickExisting={(reportId) => void openDetail(reportId)}
            />
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold"
            onClick={() => void load()}
          >
            <RefreshCw className="size-3" aria-hidden />
            Actualiser
          </button>
        </div>

        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Chargement…
          </div>
        ) : rows.length === 0 ? (
          <CompactCard>
            <CompactCardBody className="py-8 text-center text-sm text-muted-foreground">
              Aucun signalement dans cette vue.
            </CompactCardBody>
          </CompactCard>
        ) : (
          rows.map((row) => (
            <CompactCard key={row.id}>
              <CompactCardBody className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{row.product_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.field_summary || "—"} · {formatDateTimeShort24hFr(row.updated_at)}
                  </p>
                  <span className={clsx("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold", statusBadgeClass(row.status))}>
                    {catalogProductReportStatusLabelFr(row.status)}
                  </span>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold"
                  onClick={() => void openDetail(row.id)}
                >
                  Voir
                </button>
              </CompactCardBody>
            </CompactCard>
          ))
        )}
      </div>

      {detail ? (
        <ReportDetailPanel
          detail={detail}
          busy={busyId === detail.id}
          onClose={closeDetail}
          onEdit={() => {
            setEditReportId(detail.id);
          }}
          onCancel={() => void handleCancel()}
          onAccept={() => void handleAccept()}
          onReject={(msg) => void handleReject(msg)}
        />
      ) : null}

      {editReportId && detail ? (
        <CatalogProductReportModal
          open
          productId={detail.product_id}
          productName={detail.product_name}
          reportId={editReportId}
          onClose={() => setEditReportId(null)}
          onSaved={() => {
            handleSaved();
            void openDetail(detail.id);
          }}
        />
      ) : null}

      {createProduct ? (
        <CatalogProductReportModal
          open
          productId={createProduct.id}
          productName={createProduct.name}
          onClose={() => setCreateProduct(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </PageShell>
  );
}
