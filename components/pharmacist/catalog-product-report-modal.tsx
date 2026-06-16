"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Loader2, X } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import {
  CATALOG_PRODUCT_REPORT_FIELD_KEYS,
  catalogProductReportFieldLabelFr,
  catalogProductReportFieldPlaceholderFr,
} from "@/lib/catalog-product-report-field-labels";
import {
  getPharmacistCatalogProductReportDetail,
  getProductReportableSnapshot,
  submitCatalogProductReport,
  updateCatalogProductReport,
} from "@/lib/catalog-product-report-api";
import {
  buildReportFieldsFromSnapshot,
  type CatalogProductReportFieldInput,
  type CatalogProductReportFieldKey,
  type CatalogProductReportSnapshot,
} from "@/lib/catalog-product-report-types";
import { uiActionBtnModalOutline, uiActionBtnModalPrimary } from "@/lib/ui-action-buttons";
import { supabase } from "@/lib/supabase";

type FieldDraft = {
  selected: boolean;
  suggestedValue: string;
};

function buildInitialDrafts(
  snapshot: CatalogProductReportSnapshot,
  existingFields?: CatalogProductReportFieldInput[]
): Record<string, FieldDraft> {
  const reportable = buildReportFieldsFromSnapshot(snapshot, CATALOG_PRODUCT_REPORT_FIELD_KEYS);
  const existingMap = new Map((existingFields ?? []).map((f) => [f.field_key, f]));
  const drafts: Record<string, FieldDraft> = {};

  for (const row of reportable) {
    const existing = existingMap.get(row.key);
    drafts[row.key] = {
      selected: Boolean(existing),
      suggestedValue: existing?.suggested_value ?? "",
    };
  }

  return drafts;
}

export function CatalogProductReportModal({
  open,
  productId,
  productName,
  reportId,
  onClose,
  onSaved,
}: {
  open: boolean;
  productId: string;
  productName: string;
  reportId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<CatalogProductReportSnapshot | null>(null);
  const [drafts, setDrafts] = useState<Record<string, FieldDraft>>({});

  const reportableRows = useMemo(() => {
    if (!snapshot) return [];
    return buildReportFieldsFromSnapshot(snapshot, CATALOG_PRODUCT_REPORT_FIELD_KEYS);
  }, [snapshot]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    const load = async () => {
      try {
        if (reportId) {
          const detail = await getPharmacistCatalogProductReportDetail(supabase, reportId);
          if (cancelled) return;
          setSnapshot(detail.product_snapshot);
          setDrafts(buildInitialDrafts(detail.product_snapshot, detail.fields));
        } else {
          const snap = await getProductReportableSnapshot(supabase, productId);
          if (cancelled) return;
          setSnapshot(snap);
          setDrafts(buildInitialDrafts(snap));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Chargement impossible.");
          setSnapshot(null);
          setDrafts({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, productId, reportId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const handleSubmit = async () => {
    setError("");
    const fields: CatalogProductReportFieldInput[] = reportableRows
      .filter((row) => drafts[row.key]?.selected)
      .map((row) => ({
        field_key: row.key as CatalogProductReportFieldKey,
        current_value: row.currentValue,
        suggested_value: drafts[row.key]?.suggestedValue.trim() ?? "",
      }))
      .filter((f) => f.suggested_value.length > 0);

    if (fields.length === 0) {
      setError("Sélectionnez au moins un champ et indiquez la correction.");
      return;
    }

    setBusy(true);
    try {
      if (reportId) {
        await updateCatalogProductReport(supabase, reportId, fields);
      } else {
        await submitCatalogProductReport(supabase, productId, fields);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <AppModalOverlay open aria-labelledby="catalog-report-modal-title" className="p-0 sm:p-4" onBackdropClick={busy ? undefined : onClose}>
      <div className="relative z-10 flex max-h-[92svh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 id="catalog-report-modal-title" className="text-sm font-bold text-foreground">
              {reportId ? "Modifier le signalement" : "Signaler une erreur catalogue"}
            </h2>
            <p className="mt-0.5 truncate text-xs font-medium text-foreground">{productName}</p>
            <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-800">
              Catalogue national
            </span>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            disabled={busy}
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Chargement…
            </div>
          ) : reportableRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun champ renseigné à signaler pour ce produit.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Cochez les champs erronés et indiquez la valeur corrigée ou votre commentaire.
              </p>
              {reportableRows.map((row) => {
                const draft = drafts[row.key] ?? { selected: false, suggestedValue: "" };
                return (
                  <div
                    key={row.key}
                    className={clsx(
                      "rounded-lg border px-3 py-2 transition",
                      draft.selected ? "border-primary/30 bg-primary/5" : "border-border/80 bg-muted/20"
                    )}
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-3.5 shrink-0 rounded border-border"
                        checked={draft.selected}
                        disabled={busy}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.key]: { ...draft, selected: e.target.checked },
                          }))
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold text-foreground">
                          {catalogProductReportFieldLabelFr(row.key)}
                        </span>
                        <span className="mt-0.5 block break-words text-xs text-muted-foreground">{row.currentValue}</span>
                      </span>
                    </label>
                    {draft.selected ? (
                      <textarea
                        value={draft.suggestedValue}
                        disabled={busy}
                        rows={2}
                        placeholder={catalogProductReportFieldPlaceholderFr(row.key)}
                        className="mt-2 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs"
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [row.key]: { ...draft, suggestedValue: e.target.value },
                          }))
                        }
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
          {error ? <p className="mt-3 text-xs font-medium text-destructive">{error}</p> : null}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
          <button type="button" className={uiActionBtnModalOutline()} disabled={busy} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            className={uiActionBtnModalPrimary()}
            disabled={busy || loading || reportableRows.length === 0}
            onClick={() => void handleSubmit()}
          >
            {busy ? "Envoi…" : reportId ? "Enregistrer" : "Envoyer le signalement"}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
