"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  AlertCircle,
  ClipboardList,
  Eye,
  FileText,
  Gift,
  MessageSquare,
  MousePointerClick,
  Package,
  Phone,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
} from "lucide-react";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell } from "@/components/ui/compact-shell";
import {
  dashboardPeriodLabel,
  dashboardPeriodRange,
  formatChartDayFr,
  parsePharmacistDashboardSnapshot,
  requestTypeHubPath,
  requestTypeLabelFr,
  type DashboardPeriodPreset,
  type PharmacistDashboardSnapshot,
} from "@/lib/pharmacist-dashboard";
import { isPharmacyEngagementTableUnavailable } from "@/lib/pharmacy-engagement";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";

function snapshotRowsForStatDashboard(byStatus: Record<string, number>) {
  const rows: { status: string; status_for_dashboard: string }[] = [];
  for (const [status, count] of Object.entries(byStatus)) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    for (let i = 0; i < n; i++) rows.push({ status, status_for_dashboard: status });
  }
  return rows;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone = "slate",
}: {
  icon: typeof Eye;
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: "slate" | "emerald" | "sky" | "amber" | "violet" | "rose";
}) {
  const ring =
    tone === "emerald"
      ? "from-emerald-500/15 to-emerald-600/5"
      : tone === "sky"
        ? "from-sky-500/15 to-sky-600/5"
        : tone === "amber"
          ? "from-amber-500/15 to-amber-600/5"
          : tone === "violet"
            ? "from-violet-500/15 to-violet-600/5"
            : tone === "rose"
              ? "from-rose-500/15 to-rose-600/5"
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

const PERIOD_OPTIONS: DashboardPeriodPreset[] = ["7d", "30d", "90d"];

export function PharmacistDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [engagementNote, setEngagementNote] = useState("");
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [period, setPeriod] = useState<DashboardPeriodPreset>("30d");
  const [snapshot, setSnapshot] = useState<PharmacistDashboardSnapshot | null>(null);

  const range = useMemo(() => dashboardPeriodRange(period), [period]);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Accès réservé aux pharmaciens.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: staff, error: se } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (se || !staff?.pharmacy_id) {
      setError(se?.message ?? "Aucune pharmacie liée (pharmacy_staff).");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", staff.pharmacy_id).maybeSingle();
    setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim() || "Votre officine");

    const { data: raw, error: rpcErr } = await supabase.rpc("pharmacist_dashboard_snapshot", {
      p_since: range.since.toISOString(),
      p_until: range.until.toISOString(),
    });

    if (rpcErr) {
      if (isPharmacyEngagementTableUnavailable(rpcErr.message)) {
        setEngagementNote(
          "Statistiques d’audience indisponibles : appliquez la migration `20260505_003_rich_notifications_pharmacy_engagement.sql` et `20260616_001_pharmacist_dashboard_patient_crm.sql`."
        );
      } else if (rpcErr.message.includes("pharmacist_dashboard_snapshot")) {
        setEngagementNote(
          "Tableau de bord agrégé indisponible : appliquez la migration `20260616_001_pharmacist_dashboard_patient_crm.sql` sur Supabase."
        );
      } else {
        setEngagementNote("");
        setError(rpcErr.message);
      }
      setSnapshot(null);
    } else {
      setEngagementNote("");
      setSnapshot(parsePharmacistDashboardSnapshot(raw));
    }

    setLoading(false);
    setRefreshing(false);
  }, [router, range.since, range.until]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const chartEvolution = useMemo(() => {
    if (!snapshot) return [];
    const reqByDay = new Map(snapshot.requests.daily.map((d) => [d.day, d.total]));
    return snapshot.engagement.daily.map((e) => ({
      day: formatChartDayFr(e.day),
      vues: e.profile_views,
      clics: e.contact_clicks,
      demandes: reqByDay.get(e.day) ?? 0,
    }));
  }, [snapshot]);

  const chartRequestsByType = useMemo(() => {
    if (!snapshot) return [];
    const t = snapshot.requests.by_type;
    return [
      { name: "Produits", value: t.product_request ?? 0, fill: "#0ea5e9" },
      { name: "Ordonnances", value: t.prescription ?? 0, fill: "#8b5cf6" },
      { name: "Consultations", value: t.free_consultation ?? 0, fill: "#10b981" },
    ].filter((x) => x.value > 0);
  }, [snapshot]);

  const statDashboardRows = useMemo(
    () => (snapshot ? snapshotRowsForStatDashboard(snapshot.requests.by_status) : []),
    [snapshot]
  );
  const statDashboardBuckets = useMemo(() => dashboardBucketsForKind("product_request", "pharmacien"), []);

  const contactClicks = snapshot
    ? snapshot.engagement.phone_clicks + snapshot.engagement.whatsapp_clicks
    : 0;

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-6xl">
        <p className="text-sm text-muted-foreground">Chargement du tableau de bord…</p>
      </PageShell>
    );
  }

  const periodControls = (
    <>
      <div
        className="flex rounded-lg border border-border bg-muted/30 p-0.5"
        role="group"
        aria-label="Période d’analyse"
      >
        {PERIOD_OPTIONS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setPeriod(preset)}
            className={clsx(
              "rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
              period === preset
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {preset === "7d" ? "7 j" : preset === "30d" ? "30 j" : "90 j"}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={refreshing}
        onClick={() => {
          setRefreshing(true);
          void load();
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold shadow-sm hover:bg-muted/50 disabled:opacity-60"
      >
        <RefreshCw className={clsx("h-3.5 w-3.5", refreshing && "animate-spin")} />
        Actualiser
      </button>
    </>
  );

  return (
    <PageShell maxWidthClass="max-w-6xl" className="space-y-6">
      <PharmacistAccountPageHeader
        eyebrow="Espace pharmacien"
        title="Tableau de bord"
        subtitle="Vue d’ensemble de l’activité, des dossiers et de la visibilité de votre officine."
        pharmacyName={pharmacyNom}
        backHref="/"
        backLabel="← Annuaire"
        trailing={periodControls}
      />

      <p className="text-[11px] text-muted-foreground">
        Période : <span className="font-medium text-foreground">{dashboardPeriodLabel(period)}</span>
        {snapshot?.period.since
          ? ` · du ${new Date(snapshot.period.since).toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })} au ${new Date(snapshot.period.until).toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })}`
          : null}
      </p>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {engagementNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{engagementNote}</p>
      ) : null}

      {snapshot ? (
        <>
          <section aria-labelledby="kpi-prioritaires">
            <h2 id="kpi-prioritaires" className="sr-only">
              Indicateurs prioritaires
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={AlertCircle}
                label="À traiter"
                value={snapshot.requests.needs_action}
                hint="Envoyées ou validées par le client"
                href="/dashboard/pharmacien/demandes"
                tone="amber"
              />
              <KpiCard
                icon={ClipboardList}
                label="Passage comptoir"
                value={snapshot.requests.awaiting_pickup}
                hint="Préparation déclarée traitée — retrait patient"
                href="/dashboard/pharmacien/demandes?vue=liste&statut=traitee_retrait"
                tone="emerald"
              />
              <KpiCard
                icon={TrendingUp}
                label="Nouvelles demandes"
                value={snapshot.requests.new_in_period}
                hint={`Tous types · ${dashboardPeriodLabel(period).toLowerCase()}`}
                tone="sky"
              />
              <KpiCard
                icon={Gift}
                label="Réservations promo"
                value={snapshot.promo_reservations.pending}
                hint={
                  snapshot.promo_reservations.new_in_period > 0
                    ? `${snapshot.promo_reservations.new_in_period} nouvelle(s) sur la période`
                    : "En attente de confirmation"
                }
                href="/dashboard/pharmacien/reservations-packs"
                tone="violet"
              />
            </div>
          </section>

          {statDashboardRows.length > 0 ? (
            <section aria-labelledby="home-8-statuts">
              <h2 id="home-8-statuts" className="sr-only">
                8 statuts — tous dossiers
              </h2>
              <DemandeStatDashboard
                rows={statDashboardRows}
                buckets={statDashboardBuckets}
                basePath="/dashboard/pharmacien/demandes"
                density="compact"
                dashboardTitle="8 statuts"
                dashboardSubtitle="Tous parcours confondus — ouvre le hub produits filtré (ordonnances et consultations : menu Dossiers)."
              />
            </section>
          ) : null}

          <section aria-labelledby="kpi-audience">
            <h2 id="kpi-audience" className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Visibilité & patients
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={Eye}
                label="Vues fiche"
                value={snapshot.engagement.profile_views}
                hint="Page publique & annuaire"
                href="/dashboard/pharmacien/visites-interactions"
                tone="sky"
              />
              <KpiCard
                icon={MousePointerClick}
                label="Clics contact"
                value={contactClicks}
                hint={`Tél. ${snapshot.engagement.phone_clicks} · WhatsApp ${snapshot.engagement.whatsapp_clicks}`}
                href="/dashboard/pharmacien/visites-interactions"
                tone="emerald"
              />
              <KpiCard
                icon={Users}
                label="Clients"
                value={snapshot.clients.distinct_total}
                hint={
                  snapshot.clients.new_in_period > 0
                    ? `+${snapshot.clients.new_in_period} actif(s) sur la période`
                    : "Ayant interagi avec l’officine"
                }
                href="/dashboard/pharmacien/clients"
                tone="violet"
              />
              <KpiCard
                icon={Package}
                label="Dossiers actifs"
                value={snapshot.requests.active_total}
                hint="Tous types confondus"
                tone="slate"
              />
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-5">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm xl:col-span-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Évolution</h2>
                  <p className="text-[11px] text-muted-foreground">
                    Vues, clics contact et nouvelles demandes par jour ({dashboardPeriodLabel(period).toLowerCase()}).
                  </p>
                </div>
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
              </div>
              <div className="mt-4 h-72 w-full min-w-0">
                {chartEvolution.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucune donnée sur la période.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartEvolution} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="vues" name="Vues fiche" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="clics" name="Clics contact" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="demandes"
                        name="Nouv. demandes"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="space-y-4 xl:col-span-2">
              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Demandes par type</h2>
                <p className="text-[11px] text-muted-foreground">Créées sur la période sélectionnée.</p>
                <div className="mt-3 h-44 w-full min-w-0">
                  {chartRequestsByType.length === 0 ? (
                    <p className="flex h-full items-center justify-center text-xs text-muted-foreground">Aucune demande créée.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartRequestsByType} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                  {(["product_request", "prescription", "free_consultation"] as const).map((kind) => (
                    <li key={kind} className="flex items-center justify-between text-xs">
                      <Link href={requestTypeHubPath(kind)} className={chrome.linkInline}>
                        {requestTypeLabelFr(kind)}
                      </Link>
                      <span className="tabular-nums text-muted-foreground">{snapshot.requests.by_type[kind] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-foreground">Entonnoir audience</h2>
                <p className="text-[11px] text-muted-foreground">Intérêt public → contact → dossiers à traiter.</p>
                <ul className="mt-3 space-y-2">
                  {[
                    { label: "Vues fiche", value: snapshot.engagement.profile_views, pct: 100 },
                    {
                      label: "Clics contact",
                      value: contactClicks,
                      pct: snapshot.engagement.profile_views
                        ? Math.min(100, Math.round((contactClicks / snapshot.engagement.profile_views) * 100))
                        : 0,
                    },
                    {
                      label: "À traiter",
                      value: snapshot.requests.needs_action,
                      pct: contactClicks
                        ? Math.min(100, Math.round((snapshot.requests.needs_action / contactClicks) * 100))
                        : 0,
                    },
                  ].map((row) => (
                    <li key={row.label}>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-semibold tabular-nums">{row.value}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{ width: `${Math.max(row.value > 0 ? 8 : 0, row.pct)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <section className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">Accès rapides</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { href: "/dashboard/pharmacien/demandes", label: "Demandes produits", icon: Package },
                { href: "/dashboard/pharmacien/ordonnances", label: "Ordonnances", icon: FileText },
                { href: "/dashboard/pharmacien/consultations-libres", label: "Consultations libres", icon: MessageSquare },
                { href: "/dashboard/pharmacien/produits-commandes", label: "Produits commandés", icon: ClipboardList },
                { href: "/dashboard/pharmacien/ruptures-marche", label: "Ruptures marché", icon: AlertCircle },
                { href: "/dashboard/pharmacien/clients", label: "Clients", icon: Users },
                { href: "/dashboard/pharmacien/visites-interactions", label: "Journal visites", icon: Eye },
                { href: "/dashboard/pharmacien/parametres", label: "Mes paramètres", icon: Settings },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs font-semibold hover:bg-muted/50"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {label}
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : !error ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Données indisponibles. Vérifiez les migrations Supabase puis actualisez.
        </p>
      ) : null}
    </PageShell>
  );
}
