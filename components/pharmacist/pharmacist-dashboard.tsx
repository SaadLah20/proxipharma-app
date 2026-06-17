"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { RefreshCw } from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PharmacistDashboardActionStrip } from "@/components/pharmacist/dashboard/action-strip";
import { PharmacistDashboardAnchorNav } from "@/components/pharmacist/dashboard/anchor-nav";
import { PharmacistDashboardDossiersSection } from "@/components/pharmacist/dashboard/dossiers-section";
import { PharmacistDashboardGardeBanner } from "@/components/pharmacist/dashboard/garde-banner";
import { PharmacistDashboardOperationsGrid } from "@/components/pharmacist/dashboard/operations-grid";
import { PharmacistDashboardVisibilityPanel } from "@/components/pharmacist/dashboard/visibility-panel";
import { PageShell } from "@/components/ui/compact-shell";
import {
  dashboardPeriodLabel,
  dashboardPeriodRange,
  parsePharmacistDashboardSnapshot,
  type DashboardPeriodPreset,
  type PharmacistDashboardSnapshot,
} from "@/lib/pharmacist-dashboard";
import { isPharmacyEngagementTableUnavailable } from "@/lib/pharmacy-engagement";
import { supabase } from "@/lib/supabase";

const PERIOD_OPTIONS: DashboardPeriodPreset[] = ["7d", "30d", "90d"];

function snapshotHasV2Fields(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && "operations" in (raw as Record<string, unknown>));
}

export function PharmacistDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [engagementNote, setEngagementNote] = useState("");
  const [v2Note, setV2Note] = useState("");
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
      setV2Note("");
      setSnapshot(null);
    } else {
      setEngagementNote("");
      setV2Note(
        snapshotHasV2Fields(raw)
          ? ""
          : "Indicateurs officine (commandes, garde, messages…) : appliquez la migration `20260835_001_pharmacist_dashboard_snapshot_v2.sql`."
      );
      setSnapshot(parsePharmacistDashboardSnapshot(raw));
    }

    setLoading(false);
    setRefreshing(false);
  }, [router, range.since, range.until]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

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
        aria-label="Période d’analyse visibilité"
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
    <PageShell maxWidthClass="max-w-6xl" className="space-y-5">
      <PharmacistAccountPageHeader
        eyebrow="Espace pharmacien"
        title="Tableau de bord"
        subtitle="Urgent, officine et visibilité en un coup d’œil."
        pharmacyName={pharmacyNom}
        backHref="/"
        backLabel="← Annuaire"
        trailing={periodControls}
      />

      <PharmacistDashboardAnchorNav />

      <p className="text-[11px] text-muted-foreground">
        Visibilité · <span className="font-medium text-foreground">{dashboardPeriodLabel(period)}</span>
        {snapshot?.period.since
          ? ` · du ${new Date(snapshot.period.since).toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })} au ${new Date(snapshot.period.until).toLocaleDateString("fr-FR", { timeZone: "Africa/Casablanca" })}`
          : null}
      </p>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {engagementNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{engagementNote}</p>
      ) : null}
      {v2Note && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{v2Note}</p>
      ) : null}

      {snapshot ? (
        <>
          <section id="dashboard-action" className="scroll-mt-24 space-y-3">
            <h2 className="sr-only">À faire maintenant</h2>
            <PharmacistDashboardActionStrip snapshot={snapshot} />
            <PharmacistDashboardGardeBanner snapshot={snapshot} />
          </section>

          <section id="dashboard-dossiers" className="scroll-mt-24">
            <PharmacistDashboardDossiersSection snapshot={snapshot} />
          </section>

          <section id="dashboard-officine" className="scroll-mt-24 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Mon officine</h2>
            <PharmacistDashboardOperationsGrid snapshot={snapshot} />
          </section>

          <section id="dashboard-visibilite" className="scroll-mt-24">
            <PharmacistDashboardVisibilityPanel snapshot={snapshot} period={period} />
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
