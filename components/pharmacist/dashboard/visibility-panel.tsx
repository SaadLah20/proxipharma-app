"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CollapsibleDetails } from "@/components/ui/collapsible-details";
import {
  dashboardPeriodLabel,
  formatChartDayFr,
  requestTypeHubPath,
  requestTypeLabelFr,
  type DashboardPeriodPreset,
  type PharmacistDashboardSnapshot,
} from "@/lib/pharmacist-dashboard";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";

export function PharmacistDashboardVisibilityPanel({
  snapshot,
  period,
}: {
  snapshot: PharmacistDashboardSnapshot;
  period: DashboardPeriodPreset;
}) {
  const contactClicks = snapshot.engagement.phone_clicks + snapshot.engagement.whatsapp_clicks;

  const chartEvolution = useMemo(() => {
    const reqByDay = new Map(snapshot.requests.daily.map((d) => [d.day, d.total]));
    return snapshot.engagement.daily.map((e) => ({
      day: formatChartDayFr(e.day),
      vues: e.profile_views,
      clics: e.contact_clicks,
      demandes: reqByDay.get(e.day) ?? 0,
    }));
  }, [snapshot.engagement.daily, snapshot.requests.daily]);

  const chartRequestsByType = useMemo(() => {
    const t = snapshot.requests.by_type;
    return [
      { name: "Produits", value: t.product_request ?? 0, fill: "#0ea5e9" },
      { name: "Ordonnances", value: t.prescription ?? 0, fill: "#8b5cf6" },
      { name: "Consultations", value: t.free_consultation ?? 0, fill: "#10b981" },
    ].filter((x) => x.value > 0);
  }, [snapshot.requests.by_type]);

  const periodLabel = dashboardPeriodLabel(period).toLowerCase();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Visibilité</h2>
          <p className="text-[11px] text-muted-foreground">Audience annuaire · {periodLabel}</p>
        </div>
        <Link href="/dashboard/pharmacien/visites-interactions" className={chrome.linkInline}>
          Journal complet →
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
          <p className={chrome.statLabel}>Vues fiche</p>
          <p className={chrome.statValue}>{snapshot.engagement.profile_views}</p>
        </div>
        <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
          <p className={chrome.statLabel}>Clics contact</p>
          <p className={chrome.statValue}>{contactClicks}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Tél. {snapshot.engagement.phone_clicks} · WhatsApp {snapshot.engagement.whatsapp_clicks}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
        <p className="text-xs font-semibold text-foreground">Évolution</p>
        <p className="text-[11px] text-muted-foreground">Vues et clics contact par jour</p>
        <div className="mt-2 h-[7.5rem] w-full min-w-0">
          {chartEvolution.length === 0 ? (
            <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Aucune donnée sur la période.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartEvolution} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 9 }} interval="preserveStartEnd" hide />
                <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={24} />
                <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11 }} />
                <Line type="monotone" dataKey="vues" name="Vues" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clics" name="Clics" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <CollapsibleDetails title="Analyse détaillée" variant="card">
        <div className="space-y-4 pt-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Entonnoir audience</p>
            <ul className="mt-2 space-y-2">
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

          <div>
            <p className="text-xs font-semibold text-foreground">Demandes créées par type</p>
            <p className="text-[11px] text-muted-foreground">{periodLabel}</p>
            <div className="mt-2 h-36 w-full min-w-0">
              {chartRequestsByType.length === 0 ? (
                <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Aucune demande créée.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartRequestsByType}
                    layout="vertical"
                    margin={{ top: 4, right: 8, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ borderRadius: 10, fontSize: 11 }} />
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
        </div>
      </CollapsibleDetails>
    </div>
  );
}
