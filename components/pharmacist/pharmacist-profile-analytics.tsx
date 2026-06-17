"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Eye,
  FileText,
  Gift,
  LayoutDashboard,
  MousePointerClick,
  Phone,
  RefreshCw,
  User,
  Users,
} from "lucide-react";
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
  formatChartDayFr,
  journalRowLabel,
  journalRowMeta,
  parseProfileAnalyticsPayload,
  profileAnalyticsPeriodLabel,
  profileAnalyticsPeriodRange,
  type ProfileAnalyticsPayload,
  type ProfileAnalyticsPeriodPreset,
} from "@/lib/pharmacist-profile-analytics";
import { patientRequestDetailPath } from "@/lib/pharmacist-patient-crm";
import { isPharmacyEngagementTableUnavailable } from "@/lib/pharmacy-engagement";
import { supabase } from "@/lib/supabase";

const PERIOD_OPTIONS: ProfileAnalyticsPeriodPreset[] = ["7d", "30d", "90d"];

const EVENT_FILTER_OPTIONS = [
  { value: "", label: "Tous les événements fiche" },
  { value: "profile_view", label: "Vues fiche" },
  { value: "phone_click", label: "Clics téléphone" },
  { value: "whatsapp_click", label: "Clics WhatsApp" },
];

const SOURCE_FILTER_OPTIONS = [
  { value: "", label: "Toutes les sources" },
  { value: "profile", label: "Fiche publique" },
  { value: "annuaire", label: "Annuaire" },
];

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: typeof Eye;
  tone: "sky" | "amber" | "emerald" | "violet" | "slate";
}) {
  const ring =
    tone === "sky"
      ? "from-sky-500/12 to-sky-600/5"
      : tone === "amber"
        ? "from-amber-500/12 to-amber-600/5"
        : tone === "emerald"
          ? "from-emerald-500/12 to-emerald-600/5"
          : tone === "violet"
            ? "from-violet-500/12 to-violet-600/5"
            : "from-slate-500/10 to-slate-600/5";
  return (
    <div className={clsx("rounded-2xl border border-border/80 bg-gradient-to-br p-3 shadow-sm", ring)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
    </div>
  );
}

export function PharmacistProfileAnalytics() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [migrationNote, setMigrationNote] = useState("");
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [period, setPeriod] = useState<ProfileAnalyticsPeriodPreset>("30d");
  const [patientId, setPatientId] = useState("");
  const [eventType, setEventType] = useState("");
  const [source, setSource] = useState("");
  const [data, setData] = useState<ProfileAnalyticsPayload | null>(null);

  const range = useMemo(() => profileAnalyticsPeriodRange(period), [period]);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/visites-interactions");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Accès réservé aux pharmaciens.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (staff?.pharmacy_id) {
      const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", staff.pharmacy_id).maybeSingle();
      setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim() || "Votre officine");
    }

    const { data: raw, error: rpcErr } = await supabase.rpc("pharmacist_profile_analytics", {
      p_since: range.since.toISOString(),
      p_until: range.until.toISOString(),
      p_patient_id: patientId || null,
      p_event_type: eventType || null,
      p_source: source || null,
      p_limit: 150,
      p_offset: 0,
    });

    if (rpcErr) {
      if (
        isPharmacyEngagementTableUnavailable(rpcErr.message) ||
        rpcErr.message.includes("pharmacist_profile_analytics") ||
        rpcErr.message.includes("patient_id")
      ) {
        setMigrationNote(
          "Analytics indisponibles : appliquez `20260505_003_rich_notifications_pharmacy_engagement.sql` puis `20260617_001_pharmacist_profile_analytics.sql`."
        );
        setData(null);
      } else {
        setMigrationNote("");
        setError(rpcErr.message);
      }
    } else {
      setMigrationNote("");
      setData(parseProfileAnalyticsPayload(raw));
    }

    setLoading(false);
    setRefreshing(false);
  }, [router, range.since, range.until, patientId, eventType, source]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const chartEvolution = useMemo(() => {
    if (!data) return [];
    return data.summary.daily.map((d) => ({
      day: formatChartDayFr(d.day),
      vues: d.profile_views,
      clics: d.contact_clicks,
      identifie: d.identified,
      anonyme: d.anonymous,
    }));
  }, [data]);

  const chartSource = useMemo(() => {
    if (!data) return [];
    const bs = data.summary.by_source;
    return [
      { name: "Fiche publique", value: bs.profile ?? 0, fill: "#0ea5e9" },
      { name: "Annuaire", value: bs.annuaire ?? 0, fill: "#8b5cf6" },
    ].filter((x) => x.value > 0);
  }, [data]);

  const contactClicks = data ? data.summary.phone_clicks + data.summary.whatsapp_clicks : 0;

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-6xl">
        <p className="text-sm text-muted-foreground">Chargement des analytics…</p>
      </PageShell>
    );
  }

  const periodControls = (
    <>
      <div className="flex rounded-lg border border-border bg-muted/30 p-0.5" role="group" aria-label="Période">
        {PERIOD_OPTIONS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setPeriod(preset)}
            className={clsx(
              "rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
              period === preset ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
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
    <PageShell maxWidthClass="max-w-6xl" className="space-y-5">
      <PharmacistAccountPageHeader
        eyebrow="Visibilité"
        title="Visites et interactions"
        subtitle="Analytics de votre fiche publique : audiences, clics contact, dossiers et réservations promo."
        pharmacyName={pharmacyNom}
        trailing={periodControls}
      />

      <div className="flex flex-wrap gap-2 rounded-xl border border-border/80 bg-muted/20 p-3">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Client
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
          >
            <option value="">Tous les clients</option>
            {(data?.patients ?? []).map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.patient_ref?.trim() || p.full_name?.trim() || "Patient"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[9rem] flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Type (fiche)
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
          >
            {EVENT_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-[9rem] flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Source
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
          >
            {SOURCE_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <p className="w-full text-[10px] text-muted-foreground">
          {profileAnalyticsPeriodLabel(period)} — les filtres « type » et « source » s’appliquent aux vues/clics ; le
          journal inclut aussi les dossiers et promos sauf si un filtre fiche est actif.
        </p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {migrationNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{migrationNote}</p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <Kpi icon={Eye} label="Vues fiche" value={data.summary.profile_views} tone="sky" />
            <Kpi icon={Phone} label="Clics tél." value={data.summary.phone_clicks} tone="amber" />
            <Kpi
              icon={MousePointerClick}
              label="Clics WhatsApp"
              value={data.summary.whatsapp_clicks}
              tone="emerald"
            />
            <Kpi
              icon={Users}
              label="Événements identifiés"
              value={data.summary.identified_events}
              hint={`${data.summary.anonymous_events} anonyme(s)`}
              tone="violet"
            />
            <Kpi
              icon={FileText}
              label="Dossiers ouverts"
              value={data.summary.requests_created}
              hint="Demandes créées"
              tone="slate"
            />
            <Kpi icon={Gift} label="Réserv. promo" value={data.summary.promo_reservations_created} tone="violet" />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-3">
              <h2 className="text-sm font-semibold">Évolution</h2>
              <p className="text-[11px] text-muted-foreground">Vues, clics contact, volume identifié vs anonyme.</p>
              <div className="mt-3 h-64 min-w-0">
                {chartEvolution.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Aucune donnée.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartEvolution}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} width={28} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="vues" name="Vues" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="clics" name="Clics" stroke="#10b981" strokeWidth={2} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="identifie"
                        name="Identifié"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold">Par source</h2>
              <p className="text-[11px] text-muted-foreground">{contactClicks} clic(s) contact sur la période.</p>
              <div className="mt-3 h-48 min-w-0">
                {chartSource.length === 0 ? (
                  <p className="flex h-full items-center justify-center text-xs text-muted-foreground">—</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartSource} layout="vertical" margin={{ left: 4, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Par client</h2>
                <p className="text-[11px] text-muted-foreground">
                  Patients identifiés ayant consulté la fiche, cliqué ou ouvert un dossier.
                </p>
              </div>
              {data.patients.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Aucun client identifié sur cette période. Les vues anonymes restent dans le journal ci-dessous.
                </p>
              ) : (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                  {data.patients.map((p) => (
                    <li key={p.patient_id}>
                      <button
                        type="button"
                        onClick={() => setPatientId(p.patient_id === patientId ? "" : p.patient_id)}
                        className={clsx(
                          "flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted/40",
                          patientId === p.patient_id && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">
                            {p.full_name?.trim() || "Patient"}
                            {p.patient_ref?.trim() ? (
                              <span className="ml-2 font-mono text-[10px] text-emerald-900">{p.patient_ref}</span>
                            ) : null}
                          </span>
                          <Link
                            href={`/dashboard/pharmacien/clients/${p.patient_id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 text-[10px] font-semibold text-emerald-800 underline"
                          >
                            Fiche
                          </Link>
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {p.profile_views} vue{p.profile_views !== 1 ? "s" : ""} · {p.phone_clicks + p.whatsapp_clicks}{" "}
                          clic{p.phone_clicks + p.whatsapp_clicks !== 1 ? "s" : ""} · {p.requests_in_period} dossier
                          {p.requests_in_period !== 1 ? "s" : ""}
                          {p.promo_in_period > 0 ? ` · ${p.promo_in_period} promo` : ""}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border/80 bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Journal détaillé</h2>
                <p className="text-[11px] text-muted-foreground">
                  {data.events_total} événement{data.events_total !== 1 ? "s" : ""}
                  {data.events_total > data.events.length ? ` (affichage ${data.events.length})` : ""}
                </p>
              </div>
              {data.events.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Aucun événement pour ces filtres.</p>
              ) : (
                <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                  {data.events.map((row) => {
                    const meta = journalRowMeta(row);
                    const href =
                      row.row_kind === "request" && row.patient_id
                        ? patientRequestDetailPath(row.detail_type, row.row_id)
                        : row.row_kind === "promo"
                          ? `/dashboard/pharmacien/reservations-packs/${row.row_id}`
                          : row.patient_id
                            ? `/dashboard/pharmacien/clients/${row.patient_id}`
                            : null;
                    const inner = (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={clsx(
                              "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                              row.row_kind === "engagement" && "bg-sky-100 text-sky-900",
                              row.row_kind === "request" && "bg-emerald-100 text-emerald-950",
                              row.row_kind === "promo" && "bg-violet-100 text-violet-950"
                            )}
                          >
                            {row.row_kind === "engagement"
                              ? "Fiche"
                              : row.row_kind === "request"
                                ? "Dossier"
                                : "Promo"}
                          </span>
                          <span className="font-medium text-foreground">{journalRowLabel(row)}</span>
                        </div>
                        {meta ? <p className="text-[11px] text-muted-foreground">{meta}</p> : null}
                        <p className="text-[10px] text-muted-foreground">
                          {row.patient_id ? (
                            <>
                              <User className="mr-0.5 inline h-3 w-3" />
                              {row.full_name?.trim() || row.patient_ref?.trim() || "Client identifié"}
                            </>
                          ) : (
                            "Visiteur non identifié"
                          )}
                          {" · "}
                          {new Date(row.created_at).toLocaleString("fr-FR", {
                            timeZone: "Africa/Casablanca",
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </>
                    );
                    return (
                      <li key={`${row.row_kind}-${row.row_id}-${row.created_at}`}>
                        {href ? (
                          <Link href={href} className="block px-4 py-2.5 transition hover:bg-muted/30">
                            {inner}
                          </Link>
                        ) : (
                          <div className="px-4 py-2.5">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <p className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
            <LayoutDashboard className="mr-1 inline h-3.5 w-3.5" />
            Les vues depuis l’annuaire ou une fiche non connectée restent anonymes. Un patient connecté est rattaché aux
            prochains clics et vues ; les dossiers et promos sont toujours attribués au client.
          </p>
        </>
      ) : !error ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Appliquez les migrations Supabase puis actualisez.
        </p>
      ) : null}
    </PageShell>
  );
}
