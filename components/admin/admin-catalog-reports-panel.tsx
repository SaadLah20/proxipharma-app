"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { CatalogNationalProductFormFields } from "@/components/admin/catalog-national-product-form-fields";
import {
  catalogNationalProductFormFromSnapshot,
  catalogNationalProductFormToRpcPayload,
  validateCatalogNationalProductForm,
  type CatalogNationalProductFormValues,
} from "@/lib/catalog-national-product-form";
import {
  getAdminCatalogProductReportDetail,
  listAdminCatalogProductReports,
  resolveAdminCatalogProductReport,
  saveAdminCatalogProductFromReport,
} from "@/lib/catalog-product-report-api";
import {
  catalogProductReportEventLabelFr,
  catalogProductReportStatusLabelFr,
  type AdminCatalogProductReportDetail,
  type AdminCatalogProductReportListRow,
  type AdminCatalogReportFilter,
  type CatalogProductReportFieldKey,
} from "@/lib/catalog-product-report-types";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { supabase } from "@/lib/supabase";

const FILTERS: { id: AdminCatalogReportFilter; label: string }[] = [
  { id: "open", label: "En attente" },
  { id: "awaiting_pharmacist", label: "Chez pharmacien" },
  { id: "closed", label: "Clôturés" },
  { id: "cancelled", label: "Annulés" },
];

function AdminCatalogReportDetail({
  row,
  onUpdated,
}: {
  row: AdminCatalogProductReportListRow;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<AdminCatalogProductReportDetail | null>(null);
  const [values, setValues] = useState<CatalogNationalProductFormValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"save" | "resolve" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [message, setMessage] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await getAdminCatalogProductReportDetail(supabase, row.id);
      setDetail(d);
      setValues(catalogNationalProductFormFromSnapshot(d.live_product ?? d.product_snapshot));
    } catch (e) {
      setDetail(null);
      setValues(null);
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [row.id]);

  useEffect(() => {
    const tid = window.setTimeout(() => void loadDetail(), 0);
    return () => window.clearTimeout(tid);
  }, [loadDetail]);

  const canEdit = detail?.status === "open" || detail?.status === "reopened";

  const runAction = async (mode: "save" | "resolve") => {
    if (!detail || !values) return;
    const validation = validateCatalogNationalProductForm(values);
    if (validation) {
      setError(validation);
      return;
    }

    setBusy(mode);
    setError("");
    setSuccess("");
    const payload = catalogNationalProductFormToRpcPayload(values);

    try {
      if (mode === "save") {
        await saveAdminCatalogProductFromReport(supabase, detail.id, payload);
        setSuccess("Produit enregistré dans le catalogue national.");
      } else {
        await resolveAdminCatalogProductReport(supabase, detail.id, {
          product: payload,
          message: message.trim() || undefined,
        });
        setSuccess("Signalement marqué traité — en attente de validation pharmacien.");
      }
      await loadDetail();
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  };

  const reportedFieldKeys = (detail?.reported_field_keys ?? detail?.fields.map((f) => f.field_key) ?? []) as CatalogProductReportFieldKey[];

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/70 pb-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-foreground">{row.product_name}</h2>
          <p className="text-xs text-muted-foreground">
            {row.pharmacy_name} · {row.pharmacy_ville} · {row.reported_by_name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDateTimeShort24hFr(row.updated_at)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-800">
          {catalogProductReportStatusLabelFr(row.status)}
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement du formulaire…</p>
      ) : !detail || !values ? (
        <p className="mt-4 text-sm text-destructive">Détail indisponible.</p>
      ) : (
        <div className="mt-4 space-y-4">
          <CatalogNationalProductFormFields
            values={values}
            onChange={setValues}
            reportedFields={detail.fields}
            reportedFieldKeys={reportedFieldKeys}
            disabled={!canEdit || busy !== null}
          />

          {detail.events.length > 0 ? (
            <details className="rounded-lg border bg-slate-50/80 p-3">
              <summary className="cursor-pointer text-xs font-semibold">Historique</summary>
              <div className="mt-2 space-y-2">
                {detail.events.map((ev) => (
                  <div key={ev.id} className="rounded border bg-white px-2.5 py-2 text-[11px]">
                    <p className="font-semibold">{catalogProductReportEventLabelFr(ev.event_type)}</p>
                    <p className="text-muted-foreground">{formatDateTimeShort24hFr(ev.created_at)}</p>
                    {ev.body ? <p className="mt-1">{ev.body}</p> : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          {canEdit ? (
            <div className="space-y-3 rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-3">
              <label className="block text-xs font-semibold text-emerald-950">Message optionnel au pharmacien</label>
              <textarea
                value={message}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs"
                placeholder="Ex. PPV corrigé dans le catalogue national…"
                disabled={busy !== null}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  disabled={busy !== null}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-semibold hover:bg-muted/50 sm:h-8"
                  onClick={() => void runAction("save")}
                >
                  {busy === "save" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
                  Enregistrer
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-800 px-3 text-xs font-bold text-white disabled:opacity-50 sm:h-8 sm:min-w-[9rem]"
                  onClick={() => void runAction("resolve")}
                >
                  {busy === "resolve" ? "Envoi…" : "Marquer traité"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="mt-3 text-xs font-medium text-destructive">{error}</p> : null}
      {success ? <p className="mt-3 text-xs font-medium text-emerald-800">{success}</p> : null}
    </div>
  );
}

export function AdminCatalogReportsPanel() {
  const [filter, setFilter] = useState<AdminCatalogReportFilter>("open");
  const [rows, setRows] = useState<AdminCatalogProductReportListRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listAdminCatalogProductReports(supabase, filter);
      setRows(data);
      setSelectedId((prev) => {
        if (prev && data.some((r) => r.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
      setRows([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <AdminAccountPageHeader
        title="Produits signalés"
        subtitle="Corrigez le produit national : champs signalés en haut, puis enregistrez ou marquez traité."
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={clsx(
              "rounded-full px-3 py-1 text-[11px] font-semibold",
              filter === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          onClick={() => void load()}
        >
          <RefreshCw className="size-3" aria-hidden />
          Actualiser
        </button>
      </div>

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Chargement…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Aucun signalement.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <ul className="max-h-[42vh] space-y-1 overflow-y-auto rounded-xl border bg-card p-1.5 lg:max-h-[75vh]">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={clsx(
                    "w-full rounded-lg px-2.5 py-2 text-left text-xs transition",
                    selectedId === row.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60"
                  )}
                  onClick={() => setSelectedId(row.id)}
                >
                  <p className="line-clamp-2 font-semibold leading-snug text-foreground">{row.product_name}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {row.pharmacy_name} · {catalogProductReportStatusLabelFr(row.status)}
                  </p>
                  {row.status === "reopened" ? (
                    <span className="mt-1 inline-flex rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-900">
                      Retour pharmacien
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="min-w-0">
            {selected ? <AdminCatalogReportDetail key={selected.id} row={selected} onUpdated={() => void load()} /> : null}
          </div>
        </div>
      )}
    </div>
  );
}
