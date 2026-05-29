"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronDown, Package, Search } from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";
import { formatDateShortFr } from "@/lib/datetime-fr";
import { dispatchRequestDetailRefresh } from "@/lib/request-detail-refresh-bus";
import {
  type OrderedSupplyHubLine,
  type OrderedSupplyHubTab,
  type OrderedSupplyProductGroup,
  canRevertReceivedLine,
  formatLinePatientLabel,
  formatLineRequestMeta,
  groupOrderedSupplyLinesByProduct,
  lineFulfillmentLabelFr,
  normalizeOrderedSupplyHubLine,
  pendingLinesForProduct,
  receivedLinesForProduct,
  validatePartialArrivalSelection,
} from "@/lib/pharmacist-ordered-supply-hub";

function ArrivalModal({
  group,
  mode,
  onClose,
  onSuccess,
}: {
  group: OrderedSupplyProductGroup;
  mode: "arrive" | "revert";
  onClose: () => void;
  onSuccess: () => void;
}) {
  const pending = pendingLinesForProduct(group);
  const received = receivedLinesForProduct(group).filter(canRevertReceivedLine);
  const sourceLines = mode === "arrive" ? pending : received;
  const totalUnits = sourceLines.reduce((s, l) => s + l.selected_qty, 0);

  const [receivedQty, setReceivedQty] = useState(totalUnits);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(sourceLines.map((l) => l.request_item_id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const needsPick = mode === "arrive" && receivedQty < totalUnits;
  const selectedSum = useMemo(() => {
    let s = 0;
    for (const l of sourceLines) {
      if (selectedIds.has(l.request_item_id)) s += l.selected_qty;
    }
    return s;
  }, [sourceLines, selectedIds]);

  const toggleLine = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setError("");
    const ids = [...selectedIds];
    if (mode === "arrive") {
      const v = validatePartialArrivalSelection(sourceLines, selectedIds, receivedQty);
      if (v) {
        setError(v);
        return;
      }
      if (needsPick && selectedSum < receivedQty) {
        setError(
          `Il reste ${receivedQty - selectedSum} unité(s) à attribuer : cochez d'autres demandes ou réduisez la quantité reçue.`
        );
        return;
      }
    } else if (ids.length === 0) {
      setError("Sélectionnez au moins une ligne.");
      return;
    }

    setBusy(true);
    try {
      const rpc =
        mode === "arrive"
          ? "pharmacist_apply_ordered_supply_arrival"
          : "pharmacist_revert_ordered_supply_arrival";
      const { data, error: rpcErr } = await supabase.rpc(rpc, { p_item_ids: ids });
      if (rpcErr) throw new Error(rpcErr.message);
      if (mode === "arrive" && (data as number) === 0) {
        throw new Error("Aucune ligne mise à jour (déjà reçues ?).");
      }
      const requestIds = new Set(
        sourceLines.filter((l) => selectedIds.has(l.request_item_id)).map((l) => l.request_id)
      );
      for (const rid of requestIds) dispatchRequestDetailRefresh(rid);
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrival-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="border-b border-border px-4 py-3">
          <h2 id="arrival-modal-title" className="text-sm font-bold text-foreground">
            {mode === "arrive" ? "Marquer reçu en officine" : "Annuler la réception"}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{group.productName}</p>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-3 text-sm">
          {mode === "arrive" ? (
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                Quantité reçue (unités)
              </label>
              <input
                type="number"
                min={1}
                max={totalUnits}
                value={receivedQty}
                onChange={(e) => {
                  const n = Math.max(1, Math.min(totalUnits, Number(e.target.value) || 1));
                  setReceivedQty(n);
                }}
                className="mt-1 w-full rounded-lg border border-input px-3 py-2 text-sm"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                {totalUnits} unité(s) demandée(s) sur {group.requestCount} dossier(s) · {group.patientCount}{" "}
                patient(s)
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Repasse les lignes choisies en « Commandé ». Les patients sont notifiés (annulation réception).
            </p>
          )}

          {(needsPick || mode === "revert") && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">
                {mode === "arrive"
                  ? "Choisissez les dossiers à marquer reçus"
                  : "Lignes à repasser en commandé"}
              </p>
              <ul className="space-y-1.5">
                {sourceLines.map((line) => {
                  const checked = selectedIds.has(line.request_item_id);
                  return (
                    <li key={line.request_item_id}>
                      <label
                        className={clsx(
                          "flex cursor-pointer gap-2 rounded-lg border px-2.5 py-2",
                          checked ? "border-emerald-400 bg-emerald-50/50" : "border-border"
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={checked}
                          onChange={() => toggleLine(line.request_item_id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-semibold">{formatLinePatientLabel(line)}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {formatLineRequestMeta(line)} · qté {line.selected_qty} ·{" "}
                            {lineFulfillmentLabelFr(line)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              {mode === "arrive" && needsPick ? (
                <p className="text-[11px] text-muted-foreground">
                  Sélection : {selectedSum} / {receivedQty} unité(s) attribuée(s)
                </p>
              ) : null}
            </div>
          )}

          {error ? <p className="rounded-lg bg-red-50 px-2 py-1.5 text-xs text-red-800">{error}</p> : null}
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            className="flex-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold"
            disabled={busy}
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            className="flex-1 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            onClick={() => void submit()}
          >
            {busy ? "…" : mode === "arrive" ? "Confirmer réception" : "Confirmer annulation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductGroupCard({
  group,
  tab,
  expanded,
  onToggle,
  onArrive,
  onRevert,
}: {
  group: OrderedSupplyProductGroup;
  tab: OrderedSupplyHubTab;
  expanded: boolean;
  onToggle: () => void;
  onArrive: () => void;
  onRevert: () => void;
}) {
  const lines = tab === "pending" ? pendingLinesForProduct(group) : receivedLinesForProduct(group);
  const qty = tab === "pending" ? group.pendingQty : group.receivedQty;
  const revertable = receivedLinesForProduct(group).some(canRevertReceivedLine);

  return (
    <CompactCard>
      <CompactCardBody className="p-0">
        <button
          type="button"
          className="flex w-full items-start gap-3 p-3 text-left"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-muted">
            {group.photoUrl ? (
              <img src={group.photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Package className="size-6 text-muted-foreground" aria-hidden />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-semibold text-foreground">{group.productName}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {qty} unité(s) · {group.requestCount} dossier(s) · {group.patientCount} patient(s)
              {group.earliestEta && tab === "pending"
                ? ` · prévu dès le ${formatDateShortFr(group.earliestEta)}`
                : ""}
            </p>
            {tab === "pending" ? (
              <p className="mt-1 text-[10px] font-medium text-amber-900">
                {group.hasUnset && group.hasOrdered
                  ? "À commander et commandé"
                  : group.hasOrdered
                    ? "Commandé"
                    : "À commander"}
              </p>
            ) : null}
          </div>
          <ChevronDown
            className={clsx("size-5 shrink-0 text-muted-foreground transition", expanded && "rotate-180")}
            aria-hidden
          />
        </button>

        {expanded ? (
          <div className="border-t border-border px-3 pb-3">
            <ul className="mt-2 space-y-2">
              {lines.map((line) => (
                <li
                  key={line.request_item_id}
                  className="rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2 text-xs"
                >
                  <p className="font-semibold text-foreground">{formatLinePatientLabel(line)}</p>
                  <p className="text-[11px] text-muted-foreground">{formatLineRequestMeta(line)}</p>
                  <p className="mt-0.5 text-[11px]">
                    Qté {line.selected_qty} · {lineFulfillmentLabelFr(line)}
                    {line.counter_outcome !== "unset" ? " · comptoir traité" : ""}
                  </p>
                  <Link
                    href={`/dashboard/pharmacien/demandes/${line.request_id}`}
                    className="mt-1 inline-block text-[11px] font-medium text-emerald-800 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Ouvrir le dossier
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              {tab === "pending" && lines.length > 0 ? (
                <button
                  type="button"
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-900"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArrive();
                  }}
                >
                  Marquer reçu en officine
                </button>
              ) : null}
              {tab === "received" && revertable ? (
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-950"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRevert();
                  }}
                >
                  Annuler réception
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CompactCardBody>
    </CompactCard>
  );
}

export function PharmacistOrderedProductsHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<OrderedSupplyHubLine[]>([]);
  const [tab, setTab] = useState<OrderedSupplyHubTab>("pending");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ group: OrderedSupplyProductGroup; mode: "arrive" | "revert" } | null>(
    null
  );

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/produits-commandes");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.session.user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      router.replace("/dashboard/pharmacien");
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("pharmacist_ordered_supply_hub_lines");
    if (rpcErr) {
      setError(rpcErr.message);
      setLines([]);
    } else {
      setLines((data ?? []).map((r: Record<string, unknown>) => normalizeOrderedSupplyHubLine(r)));
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const groups = useMemo(() => groupOrderedSupplyLinesByProduct(lines, tab), [lines, tab]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return groups;
    return groups.filter(
      (g) =>
        g.productName.toLowerCase().includes(q) ||
        g.lines.some(
          (l) =>
            l.request_public_ref.toLowerCase().includes(q) ||
            l.patient_display_name.toLowerCase().includes(q) ||
            l.patient_ref.toLowerCase().includes(q)
        )
    );
  }, [groups, search]);

  const pendingCount = useMemo(
    () => lines.filter((l) => l.fulfillment_bucket === "pending").length,
    [lines]
  );
  const receivedCount = useMemo(
    () => lines.filter((l) => l.fulfillment_bucket === "received").length,
    [lines]
  );

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <PharmacistAccountPageHeader
        eyebrow="Suivi approvisionnement"
        title="Produits commandés"
        subtitle="Lignes validées « à commander » ou « commandées » — marquez la réception fournisseur pour toutes les demandes concernées."
      />

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
        <button
          type="button"
          className={clsx(
            "flex-1 rounded-md px-2 py-2 text-xs font-semibold",
            tab === "pending" ? "bg-card text-emerald-900 shadow-sm" : "text-muted-foreground"
          )}
          onClick={() => {
            setTab("pending");
            setExpandedId(null);
          }}
        >
          À recevoir ({pendingCount})
        </button>
        <button
          type="button"
          className={clsx(
            "flex-1 rounded-md px-2 py-2 text-xs font-semibold",
            tab === "received" ? "bg-card text-emerald-900 shadow-sm" : "text-muted-foreground"
          )}
          onClick={() => {
            setTab("received");
            setExpandedId(null);
          }}
        >
          Reçus en officine ({receivedCount})
        </button>
      </div>

      <div className={clsx("relative", chrome.filterShell)}>
        <Search className={clsx("pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2", chrome.searchIcon)} />
        <input
          type="search"
          placeholder="Rechercher produit, réf. dossier, patient…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={clsx("w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm", chrome.searchInput)}
        />
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-6 text-center text-sm text-emerald-950">
          {tab === "pending"
            ? "Aucun produit en attente de réception fournisseur."
            : "Aucun produit marqué reçu en officine (ou déjà retirés au comptoir)."}
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredGroups.map((g) => (
            <li key={g.catalogProductId}>
              <ProductGroupCard
                group={g}
                tab={tab}
                expanded={expandedId === g.catalogProductId}
                onToggle={() =>
                  setExpandedId((id) => (id === g.catalogProductId ? null : g.catalogProductId))
                }
                onArrive={() => setModal({ group: g, mode: "arrive" })}
                onRevert={() => setModal({ group: g, mode: "revert" })}
              />
            </li>
          ))}
        </ul>
      )}

      {modal ? (
        <ArrivalModal
          key={`${modal.mode}-${modal.group.catalogProductId}`}
          group={modal.group}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onSuccess={() => void load()}
        />
      ) : null}
    </PageShell>
  );
}
