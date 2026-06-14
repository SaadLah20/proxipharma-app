"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  Mail,
  Package,
  RefreshCw,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { loadAdminDashboardSnapshot, type AdminDashboardSnapshot } from "@/lib/admin-dashboard";
import { one } from "@/lib/embed";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { requestStatusFr, requestTypeFr } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";

function AdminKpiCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "slate",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "slate" | "indigo" | "emerald" | "rose" | "amber";
}) {
  const ring =
    tone === "indigo"
      ? "from-indigo-500/15 to-indigo-600/5"
      : tone === "emerald"
        ? "from-emerald-500/15 to-emerald-600/5"
        : tone === "rose"
          ? "from-rose-500/15 to-rose-600/5"
          : tone === "amber"
            ? "from-amber-500/15 to-amber-600/5"
            : "from-slate-500/10 to-slate-600/5";

  const inner = (
    <div
      className={clsx(
        "relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br p-4 shadow-sm transition",
        ring,
        href && "hover:border-primary/30 hover:shadow-md"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-background/80 p-2 shadow-inner">
          <Icon className="h-5 w-5 text-foreground/80" strokeWidth={2} />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {inner}
      </Link>
    );
  }
  return inner;
}

function AdminAlerts({ snapshot }: { snapshot: AdminDashboardSnapshot }) {
  const alerts: { tone: "rose" | "amber" | "emerald"; text: string; href?: string }[] = [];

  if (snapshot.emailFailed > 0) {
    alerts.push({
      tone: "rose",
      text: `${snapshot.emailFailed} e-mail(s) en échec dans la file externe.`,
      href: "/admin/demandes",
    });
  }
  if (snapshot.pendingCommunityProducts > 0) {
    alerts.push({
      tone: "amber",
      text: `${snapshot.pendingCommunityProducts} produit(s) communautaire(s) en attente de publication.`,
      href: "/admin/produits-communautaires",
    });
  }
  if (snapshot.overdueRespondedCount > 0) {
    alerts.push({
      tone: "amber",
      text: `${snapshot.overdueRespondedCount} demande(s) répondue(s) depuis plus de 24 h sans validation patient.`,
      href: "/admin/demandes?statut=responded",
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.text}
          className={clsx(
            "flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm",
            alert.tone === "rose"
              ? "border-rose-200/80 bg-rose-50/80 text-rose-900"
              : "border-amber-200/80 bg-amber-50/80 text-amber-950"
          )}
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">
            {alert.href ? (
              <Link href={alert.href} className="font-medium underline underline-offset-2">
                {alert.text}
              </Link>
            ) : (
              alert.text
            )}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace("/auth?redirect=/admin");
      return;
    }

    try {
      const data = await loadAdminDashboardSnapshot(supabase);
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const emailSummary = useMemo(() => {
    if (!snapshot) return "";
    return `${snapshot.emailPending} en file · ${snapshot.emailSent24h} envoyés (24 h)`;
  }, [snapshot]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Chargement du tableau de bord…</p>;
  }

  return (
    <div className="space-y-4">
      <AdminAccountPageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble du pilote Pharmeto : réseau d'officines, demandes et files de notification."
        backHref="/"
        backLabel="← Annuaire"
        trailing={
          <button
            type="button"
            className={p.headerAction}
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
          >
            <RefreshCw className={clsx("mr-1 inline size-3.5", refreshing && "animate-spin")} aria-hidden />
            Actualiser
          </button>
        }
      />

      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      {snapshot ? (
        <>
          <AdminAlerts snapshot={snapshot} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AdminKpiCard
              icon={Store}
              label="Officines pilote"
              value={snapshot.pharmacyCount}
              hint={`${snapshot.publicListedCount} visible(s) dans l'annuaire public`}
              href="/admin/officines"
              tone="indigo"
            />
            <AdminKpiCard
              icon={Building2}
              label="Annuaire public"
              value={snapshot.publicListedCount}
              hint="Officines listées pour tous les visiteurs"
              href="/admin/officines?filtre=public"
            />
            <AdminKpiCard
              icon={ClipboardList}
              label="Demandes actives"
              value={snapshot.activeRequestCount}
              hint="Envoyées, en cours, répondues ou validées"
              href="/admin/demandes?statut=actives"
              tone="indigo"
            />
            <AdminKpiCard
              icon={Package}
              label="Catalogue à modérer"
              value={snapshot.pendingCommunityProducts}
              hint="Produits officine en attente de publication"
              href="/admin/produits-communautaires"
              tone="emerald"
            />
            <AdminKpiCard
              icon={Mail}
              label="E-mails en file"
              value={snapshot.emailPending}
              hint={emailSummary}
              href="/admin/demandes"
            />
            <AdminKpiCard
              icon={AlertTriangle}
              label="E-mails en échec"
              value={snapshot.emailFailed}
              hint={snapshot.emailFailed > 0 ? "À investiguer dans la file externe" : "Aucun échec récent"}
              href="/admin/demandes"
              tone={snapshot.emailFailed > 0 ? "rose" : "slate"}
            />
          </div>

          <section className={clsx(p.filterShell, "space-y-3")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Activité récente</h2>
              <Link href="/admin/demandes" className={p.linkInline}>
                Voir toutes les demandes
              </Link>
            </div>
            {snapshot.recentRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
            ) : (
              <ul className="divide-y divide-border/70 rounded-lg border border-border/80 bg-card">
                {snapshot.recentRequests.map((row) => {
                  const ph = one(row.pharmacies);
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/admin/demandes/${row.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm transition hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">
                            {requestTypeFr[row.request_type] ?? row.request_type}
                            <span className="mx-1.5 text-muted-foreground">·</span>
                            {requestStatusFr[row.status] ?? row.status}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ph ? `${ph.nom} (${ph.ville})` : row.pharmacy_id.slice(0, 8)} ·{" "}
                            {formatDateTimeShort24hFr(row.created_at)}
                          </p>
                        </div>
                        <span className={p.linkInline}>Détail</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="flex flex-wrap gap-2">
            <Link href="/admin/officines" className={p.cta}>
              Nouvelle officine
            </Link>
            <Link href="/admin/produits-communautaires" className={p.ctaOutline}>
              Modérer le catalogue
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
