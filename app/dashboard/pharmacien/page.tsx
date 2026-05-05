"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, ClipboardList, Eye, MousePointerClick, Phone, Users } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { isPharmacyEngagementTableUnavailable } from "@/lib/pharmacy-engagement";
import { supabase } from "@/lib/supabase";

type EngagementRow = {
  created_at: string;
  event_type: string;
  source: string;
};

const ACTIVE = new Set(["submitted", "in_review", "responded", "confirmed"]);

function dayKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-CA", { timeZone: "Africa/Casablanca" });
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Eye;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "slate" | "emerald" | "sky" | "amber" | "violet";
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
            : "from-slate-500/10 to-slate-600/5";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br ${ring} p-4 shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
          {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="rounded-xl bg-background/80 p-2 shadow-inner">
          <Icon className="h-5 w-5 text-foreground/80" strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

export default function PharmacienTableauDeBordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [engagementNote, setEngagementNote] = useState("");
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [events, setEvents] = useState<EngagementRow[]>([]);
  const [demandesTotal, setDemandesTotal] = useState(0);
  const [demandesActives, setDemandesActives] = useState(0);
  const [clientsCount, setClientsCount] = useState(0);

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
      return;
    }

    const pid = staff.pharmacy_id;

    const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", pid).maybeSingle();
    setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim() || "Votre officine");

    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceIso = since.toISOString();

    const { data: ev, error: ee } = await supabase
      .from("pharmacy_engagement_events")
      .select("created_at,event_type,source")
      .eq("pharmacy_id", pid)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (ee) {
      if (isPharmacyEngagementTableUnavailable(ee.message)) {
        setEvents([]);
        setEngagementNote(
          "Les statistiques de vues et de clics ne sont pas encore disponibles : exécutez la migration SQL " +
            "`20260505_003_rich_notifications_pharmacy_engagement.sql` sur votre projet Supabase, puis actualisez cette page."
        );
      } else {
        setEngagementNote("");
        setError(ee.message);
      }
    } else {
      setEngagementNote("");
      setEvents((ev ?? []) as EngagementRow[]);
    }

    const { count: cTotal } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("pharmacy_id", pid)
      .eq("request_type", "product_request");

    const { count: cActive } = await supabase
      .from("requests")
      .select("*", { count: "exact", head: true })
      .eq("pharmacy_id", pid)
      .eq("request_type", "product_request")
      .in("status", [...ACTIVE]);

    setDemandesTotal(cTotal ?? 0);
    setDemandesActives(cActive ?? 0);

    const { data: dir, error: de } = await supabase.rpc("pharmacist_patient_directory_for_my_pharmacy");
    if (!de && Array.isArray(dir)) {
      setClientsCount(dir.length);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const kpis = useMemo(() => {
    const views = events.filter((e) => e.event_type === "profile_view").length;
    const phones = events.filter((e) => e.event_type === "phone_click").length;
    const was = events.filter((e) => e.event_type === "whatsapp_click").length;
    return { views, phones, was, interactions: phones + was };
  }, [events]);

  const chartDaily = useMemo(() => {
    const rows: { key: string; day: string; vues: number; clics: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const key = dt.toLocaleDateString("fr-CA", { timeZone: "Africa/Casablanca" });
      const day = dt.toLocaleDateString("fr-FR", {
        timeZone: "Africa/Casablanca",
        weekday: "short",
        day: "numeric",
      });
      rows.push({ key, day, vues: 0, clics: 0 });
    }
    for (const e of events) {
      const k = dayKey(e.created_at);
      const row = rows.find((r) => r.key === k);
      if (!row) continue;
      if (e.event_type === "profile_view") {
        row.vues += 1;
      } else if (e.event_type === "phone_click" || e.event_type === "whatsapp_click") {
        row.clics += 1;
      }
    }
    return rows.map(({ day, vues, clics }) => ({ day, vues, clics }));
  }, [events]);

  const funnelData = useMemo(
    () => [
      { name: "Vues fiche", value: kpis.views, fill: "#0ea5e9" },
      { name: "Clics contact", value: kpis.interactions, fill: "#10b981" },
      { name: "Demandes actives", value: demandesActives, fill: "#8b5cf6" },
    ],
    [kpis.views, kpis.interactions, demandesActives]
  );

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-5xl" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/" className="text-xs font-medium text-emerald-900 underline">
            ← Annuaire
          </Link>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground">Tableau de bord</h1>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            {pharmacyNom}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/pharmacien/demandes"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            Demandes de produits
          </Link>
          <Link
            href="/dashboard/pharmacien/visites-interactions"
            className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold shadow-sm hover:bg-muted/40"
          >
            Visites & clics
          </Link>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {engagementNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{engagementNote}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Eye}
          label="Vues fiche (30 j)"
          value={kpis.views}
          hint="Ouvertures de votre page pharmacie"
          tone="sky"
        />
        <StatCard
          icon={Phone}
          label="Clics téléphone"
          value={kpis.phones}
          hint="Annuaire + fiche publique"
          tone="amber"
        />
        <StatCard
          icon={MousePointerClick}
          label="Clics WhatsApp"
          value={kpis.was}
          hint="Annuaire + fiche publique"
          tone="emerald"
        />
        <StatCard
          icon={Users}
          label="Patients distincts"
          value={clientsCount}
          hint="Ayant au moins une demande"
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-3">
          <h2 className="text-sm font-semibold text-foreground">Activité sur 7 jours</h2>
          <p className="text-[11px] text-muted-foreground">Vues de fiche et clics téléphone / WhatsApp agrégés par jour.</p>
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="vues" name="Vues fiche" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clics" name="Clics contact" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-foreground">Entonnoir (aperçu)</h2>
          <p className="text-[11px] text-muted-foreground">Intérêt public → prise de contact → dossiers actifs.</p>
          <div className="mt-4 h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {funnelData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-slate-50/80 to-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-700" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Demandes de produits</h2>
              <p className="text-[11px] text-muted-foreground">
                {demandesActives} active{demandesActives !== 1 ? "s" : ""} · {demandesTotal} au total
              </p>
            </div>
          </div>
          <Link href="/dashboard/pharmacien/demandes" className="text-xs font-semibold text-emerald-800 underline">
            Ouvrir le hub
          </Link>
        </div>
      </div>

    </PageShell>
  );
}
