"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronDown, Package, PackageCheck, Search } from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import {
  CatalogProductPhotoThumb,
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import { supabase } from "@/lib/supabase";
import {
  type MarketShortageProductGroup,
  formatShortageLinePatient,
  formatShortageLineRequest,
  formatShortageSince,
  groupMarketShortageLines,
  normalizeMarketShortageHubLine,
} from "@/lib/pharmacist-market-shortage-hub";

function DeclareAvailableConfirmModal({
  group,
  busy,
  onClose,
  onConfirm,
}: {
  group: MarketShortageProductGroup;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const n = group.notifyablePatientCount;
  const dossiers = group.requestCount;

  return (
    <div
      className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="declare-available-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="border-b border-border px-4 py-3">
          <h2 id="declare-available-modal-title" className="text-sm font-bold text-foreground">
            Produit de nouveau disponible
          </h2>
          <p className="mt-0.5 text-xs font-medium text-foreground">{group.productName}</p>
        </div>

        <div className="space-y-3 px-4 py-3 text-sm leading-snug">
          {n > 0 ? (
            <>
              <p className="rounded-lg border border-sky-200/80 bg-sky-50/70 px-3 py-2.5 text-sky-950">
                <strong>{n}</strong> patient{n > 1 ? "s" : ""} ayant demandé ce produit (réponse « rupture de
                marché », {dossiers} dossier{dossiers > 1 ? "s" : ""} sur les 2 derniers mois) recevront une
                notification in-app du type&nbsp;:
              </p>
              <p className="rounded-lg bg-muted/30 px-3 py-2 text-xs italic text-muted-foreground">
                « Le produit {group.productName} qui était en rupture de marché est actuellement disponible chez
                votre officine. »
              </p>
            </>
          ) : (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-amber-950">
              Aucun patient à notifier sur les 2 derniers mois pour ce produit. Le produit sera uniquement retiré de
              votre liste des ruptures actives.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Cette action est définitive pour la rupture en cours : le produit disparaît de cette liste jusqu&apos;à une
            nouvelle déclaration « rupture de marché » sur une demande.
          </p>
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
            className="flex-1 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
            onClick={onConfirm}
          >
            {busy ? "Envoi…" : n > 0 ? `Confirmer et notifier (${n})` : "Confirmer le retrait"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductGroupCard({
  group,
  expanded,
  onToggle,
  busy,
  onDeclareAvailable,
}: {
  group: MarketShortageProductGroup;
  expanded: boolean;
  onToggle: () => void;
  busy: boolean;
  onDeclareAvailable: () => void;
}) {
  const [preview, setPreview] = useState<CatalogProductPhotoPreview | null>(null);

  return (
    <>
      <CompactCard>
        <CompactCardBody className="p-0">
          <button
            type="button"
            className="flex w-full items-start gap-3 p-3 text-left"
            onClick={onToggle}
            aria-expanded={expanded}
          >
            {group.photoUrl ? (
              <CatalogProductPhotoThumb
                imageUrl={group.photoUrl}
                title={group.productName}
                size={56}
                onPreview={setPreview}
              />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-md border bg-muted">
                <Package className="size-6 text-muted-foreground" aria-hidden />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{group.productName}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                En rupture depuis le {formatShortageSince(group.shortageSince)}
              </p>
              <p className="mt-1 text-[11px] font-medium text-amber-950">
                {group.notifyablePatientCount > 0 ? (
                  <>
                    <span className="tabular-nums font-bold">{group.notifyablePatientCount}</span> patient
                    {group.notifyablePatientCount > 1 ? "s" : ""} ayant demandé ce produit
                    {group.requestCount > 1 ? (
                      <>
                        {" "}
                        · <span className="tabular-nums">{group.requestCount}</span> dossiers
                      </>
                    ) : null}
                    <span className="font-normal text-amber-900/85"> (réponse rupture, 2 mois)</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Aucun patient notifiable sur les 2 derniers mois</span>
                )}
              </p>
            </div>
            <ChevronDown
              className={clsx("size-5 shrink-0 text-muted-foreground transition", expanded && "rotate-180")}
              aria-hidden
            />
          </button>

          {expanded ? (
            <div className="border-t border-border px-3 pb-3">
              {group.lines.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Aucun dossier patient notifiable sur les 2 derniers mois. Vous pouvez tout de même retirer la rupture.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {group.lines.map((line) => (
                    <li
                      key={line.request_item_id!}
                      className="rounded-lg border border-border/80 bg-muted/20 px-2.5 py-2 text-xs"
                    >
                      <p className="font-semibold">{formatShortageLinePatient(line)}</p>
                      <p className="text-[11px] text-muted-foreground">{formatShortageLineRequest(line)}</p>
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
              )}
              <button
                type="button"
                disabled={busy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-900 disabled:opacity-50 sm:w-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeclareAvailable();
                }}
              >
                <PackageCheck className="size-4" aria-hidden />
                {busy ? "…" : "Déclarer disponible et notifier"}
              </button>
            </div>
          ) : null}
        </CompactCardBody>
      </CompactCard>
      <PatientProductPhotoPreviewModal
        open={Boolean(preview)}
        imageUrl={preview?.url ?? null}
        title={preview?.title ?? ""}
        onClose={() => setPreview(null)}
      />
    </>
  );
}

export function PharmacistMarketShortageHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<MarketShortageProductGroup | null>(null);
  const [rawLines, setRawLines] = useState<ReturnType<typeof normalizeMarketShortageHubLine>[]>([]);

  const load = useCallback(async () => {
    setError("");
    setSuccess("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/ruptures-marche");
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.session.user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      router.replace("/dashboard/pharmacien");
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("pharmacist_market_shortage_hub_lines");
    if (rpcErr) {
      setError(rpcErr.message);
      setRawLines([]);
    } else {
      setRawLines((data ?? []).map((r: Record<string, unknown>) => normalizeMarketShortageHubLine(r)));
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const groups = useMemo(() => groupMarketShortageLines(rawLines), [rawLines]);

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

  const declareAvailable = async (group: MarketShortageProductGroup) => {
    setBusyProductId(group.productId);
    setError("");
    setSuccess("");
    try {
      const { data, error: rpcErr } = await supabase.rpc("pharmacist_declare_market_shortage_available", {
        p_product_id: group.productId,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const payload = data as { patients_notified?: number; product_name?: string } | null;
      const count = payload?.patients_notified ?? 0;
      setSuccess(
        count > 0
          ? `« ${payload?.product_name ?? group.productName} » : ${count} patient(s) notifié(s).`
          : `« ${payload?.product_name ?? group.productName} » retiré de la liste des ruptures.`
      );
      setExpandedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusyProductId(null);
    }
  };

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
        title="Produits en rupture"
        subtitle="Ruptures de marché déclarées — notifiez les patients quand le produit redevient disponible."
      />

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
      {success ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{success}</p> : null}

      <div className={clsx("relative", chrome.filterShell)}>
        <Search className={clsx("pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2", chrome.searchIcon)} />
        <input
          type="search"
          placeholder="Rechercher produit, dossier, patient…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={clsx("w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm", chrome.searchInput)}
        />
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 p-6 text-center text-sm text-amber-950">
          Aucun produit en rupture de marché active. La liste se remplit lorsque vous répondez « rupture de marché »
          sur une ligne de demande.
        </div>
      ) : (
        <ul className="space-y-2">
          {filteredGroups.map((g) => (
            <li key={g.productId}>
              <ProductGroupCard
                group={g}
                expanded={expandedId === g.productId}
                onToggle={() => setExpandedId((id) => (id === g.productId ? null : g.productId))}
                busy={busyProductId === g.productId}
                onDeclareAvailable={() => setConfirmGroup(g)}
              />
            </li>
          ))}
        </ul>
      )}

      {confirmGroup ? (
        <DeclareAvailableConfirmModal
          group={confirmGroup}
          busy={busyProductId === confirmGroup.productId}
          onClose={() => {
            if (busyProductId !== confirmGroup.productId) setConfirmGroup(null);
          }}
          onConfirm={() => void declareAvailable(confirmGroup)}
        />
      ) : null}
    </PageShell>
  );
}
