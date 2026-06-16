"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Flag, Loader2, RefreshCw } from "lucide-react";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { catalogProductReportFieldLabelFr } from "@/lib/catalog-product-report-field-labels";
import {
  getAdminCatalogProductReportDetail,
  listAdminCatalogProductReports,
  resolveAdminCatalogProductReport,
} from "@/lib/catalog-product-report-api";
import {
  catalogProductReportEventLabelFr,
  catalogProductReportStatusLabelFr,
  type AdminCatalogProductReportDetail,
  type AdminCatalogProductReportListRow,
  type AdminCatalogReportFilter,
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
  onResolved,
}: {
  row: AdminCatalogProductReportListRow;
  onResolved: () => void;
}) {
  const [detail, setDetail] = useState<AdminCatalogProductReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getAdminCatalogProductReportDetail(supabase, row.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [row.id]);

  const canResolve = detail?.status === "open" || detail?.status === "reopened";

  const handleResolve = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await resolveAdminCatalogProductReport(supabase, detail.id, message.trim() || undefined);
      setSuccess("Signalement marqué traité — en attente de validation pharmacien.");
      onResolved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-foreground">{row.product_name}</h2>
          <p className="text-xs text-muted-foreground">
            {row.pharmacy_name} · {row.pharmacy_ville} · {row.reported_by_name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{formatDateTimeShort24hFr(row.updated_at)}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-slate-800">
          {catalogProductReportStatusLabelFr(row.status)}
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement du détail…</p>
      ) : !detail ? (
        <p className="mt-4 text-sm text-destructive">Détail indisponible.</p>
      ) : (
        <>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Corrections proposées</p>
            {detail.fields.map((f) => (
              <div key={f.field_key} className="rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                <p className="font-semibold">{catalogProductReportFieldLabelFr(f.field_key)}</p>
                {f.current_value ? <p className="text-muted-foreground line-through">{f.current_value}</p> : null}
                <p className="mt-1 font-medium text-foreground">{f.suggested_value}</p>
              </div>
            ))}
          </div>

          {detail.events.length > 0 ? (
            <details className="mt-4 rounded-lg border bg-slate-50/80 p-3">
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

          {canResolve ? (
            <div className="mt-4 space-y-2 rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-3">
              <label className="block text-xs font-semibold text-emerald-950">Message optionnel au pharmacien</label>
              <textarea
                value={message}
                rows={3}
                className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-xs"
                placeholder="Ex. PPV corrigé dans le catalogue national…"
                onChange={(e) => setMessage(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                onClick={() => void handleResolve()}
              >
                {busy ? "Envoi…" : "Marquer traité"}
              </button>
            </div>
          ) : null}
        </>
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
        subtitle="Traiter les signalements catalogue remontés par les officines pilote."
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border bg-card p-2">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={clsx(
                    "w-full rounded-lg px-3 py-2.5 text-left text-xs transition",
                    selectedId === row.id ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted/60"
                  )}
                  onClick={() => setSelectedId(row.id)}
                >
                  <p className="font-semibold text-foreground">{row.product_name}</p>
                  <p className="mt-0.5 text-muted-foreground">
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
          <div>{selected ? <AdminCatalogReportDetail key={selected.id} row={selected} onResolved={() => void load()} /> : null}</div>
        </div>
      )}
    </div>
  );
}
