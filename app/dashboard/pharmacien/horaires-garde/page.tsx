"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarOff, CalendarRange, Clock } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { PharmacySegmentTabs } from "@/components/pharmacy/pharmacy-segment-tabs";
import {
  PharmacyWeeklyHoursTab,
  weeklyKey,
  type WeeklyDraft,
} from "@/components/pharmacy/schedule/pharmacy-weekly-hours-tab";
import { PharmacyOverridesTab } from "@/components/pharmacy/schedule/pharmacy-overrides-tab";
import { PharmacyOnCallTab } from "@/components/pharmacy/schedule/pharmacy-on-call-tab";
import { ScheduleToast, type ScheduleToastTone } from "@/components/pharmacy/schedule/schedule-toast";
import { supabase } from "@/lib/supabase";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import { todayDateIsoCasablanca } from "@/lib/pharmacy-schedule-conflicts";
import type {
  PharmacyDayOverrideRow,
  PharmacyOnCallKind,
  PharmacyOnCallPeriodRow,
  PharmacyWeeklyHourRow,
} from "@/lib/pharmacy-profile-types";

type ScheduleTab = "weekly" | "overrides" | "on_call";

const SCHEDULE_TABS = [
  { id: "weekly" as const, label: "Horaires", icon: Clock },
  { id: "overrides" as const, label: "Exceptions", icon: CalendarOff },
  { id: "on_call" as const, label: "Garde", icon: CalendarRange },
];

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

function rowsToDraft(rows: PharmacyWeeklyHourRow[]): WeeklyDraft {
  const d: WeeklyDraft = {};
  for (const w of rows) {
    d[weeklyKey(w.weekday, w.period)] = {
      opens_at: w.opens_at?.slice(0, 5) ?? "",
      closes_at: w.closes_at?.slice(0, 5) ?? "",
      is_closed: w.is_closed,
    };
  }
  for (const wd of WEEKDAYS) {
    for (const period of ["morning", "afternoon"] as const) {
      const k = weeklyKey(wd, period);
      if (!d[k]) d[k] = { opens_at: "", closes_at: "", is_closed: wd === 7 };
    }
  }
  return d;
}

export default function PharmacienHorairesGardePage() {
  const router = useRouter();
  const todayIso = todayDateIsoCasablanca();
  const [tab, setTab] = useState<ScheduleTab>("weekly");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyDraft>({});
  const [overrideList, setOverrideList] = useState<PharmacyDayOverrideRow[]>([]);
  const [onCallList, setOnCallList] = useState<PharmacyOnCallPeriodRow[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: ScheduleToastTone }>({ message: "", tone: "info" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const showHint = useCallback((message: string, tone: ScheduleToastTone = "info") => {
    setToast({ message, tone });
  }, []);

  const load = useCallback(async () => {
    const ctx = await loadPharmacistPharmacyId();
    if (!ctx.pharmacyId) {
      showHint(ctx.error ?? "Erreur", "error");
      setLoading(false);
      return;
    }
    setPharmacyId(ctx.pharmacyId);

    const [wh, ov, oc] = await Promise.all([
      supabase
        .from("pharmacy_weekly_hours")
        .select("weekday,period,opens_at,closes_at,is_closed")
        .eq("pharmacy_id", ctx.pharmacyId),
      supabase
        .from("pharmacy_day_overrides")
        .select(
          "id,day_date,override_type,label,morning_opens_at,morning_closes_at,afternoon_opens_at,afternoon_closes_at"
        )
        .eq("pharmacy_id", ctx.pharmacyId)
        .gte("day_date", todayIso)
        .order("day_date"),
      supabase
        .from("pharmacy_on_call_periods")
        .select("id,kind,starts_at,ends_at,note")
        .eq("pharmacy_id", ctx.pharmacyId)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: false }),
    ]);

    setWeeklyDraft(rowsToDraft((wh.data ?? []) as PharmacyWeeklyHourRow[]));
    setOverrideList((ov.data ?? []) as PharmacyDayOverrideRow[]);
    setOnCallList((oc.data ?? []) as PharmacyOnCallPeriodRow[]);
    setLoading(false);
  }, [showHint, todayIso]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/pharmacien/horaires-garde");
      }
    };
    void run();
  }, [router]);

  const saveWeekly = async () => {
    if (!pharmacyId) return;
    setBusy(true);
    const rows: {
      pharmacy_id: string;
      weekday: number;
      period: string;
      opens_at: string | null;
      closes_at: string | null;
      is_closed: boolean;
    }[] = [];
    for (const wd of WEEKDAYS) {
      for (const period of ["morning", "afternoon"] as const) {
        const cell = weeklyDraft[weeklyKey(wd, period)];
        rows.push({
          pharmacy_id: pharmacyId,
          weekday: wd,
          period,
          opens_at: cell.is_closed ? null : cell.opens_at || null,
          closes_at: cell.is_closed ? null : cell.closes_at || null,
          is_closed: cell.is_closed,
        });
      }
    }
    const { error } = await supabase.from("pharmacy_weekly_hours").upsert(rows, {
      onConflict: "pharmacy_id,weekday,period",
    });
    setBusy(false);
    showHint(error ? error.message : "Horaires enregistrés.", error ? "error" : "success");
  };

  const addOverride = async (payload: {
    day_date: string;
    override_type: "closed" | "holiday" | "custom";
    label: string | null;
    morning_opens_at: string | null;
    morning_closes_at: string | null;
    afternoon_opens_at: string | null;
    afternoon_closes_at: string | null;
  }) => {
    if (!pharmacyId) return { error: "Pharmacie introuvable." };
    setBusy(true);
    const { error } = await supabase.from("pharmacy_day_overrides").upsert(
      { pharmacy_id: pharmacyId, ...payload },
      { onConflict: "pharmacy_id,day_date" }
    );
    setBusy(false);
    if (!error) void load();
    return { error: error?.message ?? null };
  };

  const deleteOverride = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("pharmacy_day_overrides").delete().eq("id", id);
    setBusy(false);
    if (!error) {
      void load();
      showHint("Exception retirée.", "success");
    } else showHint(error.message, "error");
  };

  const planOnCall = async (payload: {
    kind: PharmacyOnCallKind;
    starts_at: string;
    ends_at: string;
    note: string | null;
    overrideIdsToRemove: string[];
  }) => {
    if (!pharmacyId) return { error: "Pharmacie introuvable." };
    setBusy(true);
    if (payload.overrideIdsToRemove.length > 0) {
      const { error: delErr } = await supabase
        .from("pharmacy_day_overrides")
        .delete()
        .in("id", payload.overrideIdsToRemove);
      if (delErr) {
        setBusy(false);
        return { error: delErr.message };
      }
    }
    const { error } = await supabase.from("pharmacy_on_call_periods").insert({
      pharmacy_id: pharmacyId,
      kind: payload.kind,
      starts_at: payload.starts_at,
      ends_at: payload.ends_at,
      note: payload.note,
    });
    setBusy(false);
    if (!error) void load();
    return { error: error?.message ?? null };
  };

  const deleteOnCall = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("pharmacy_on_call_periods").delete().eq("id", id);
    setBusy(false);
    if (!error) {
      void load();
      showHint("Garde retirée.", "success");
    } else showHint(error.message, "error");
  };

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-4">
      <div>
        <Link href="/dashboard/pharmacien/ma-fiche" className="text-xs font-medium text-primary underline">
          ← Ma fiche
        </Link>
        <h1 className="mt-2 text-lg font-bold">Horaires et garde</h1>
        <p className="text-xs text-muted-foreground">
          Planning affiché sur votre fiche publique. Après enregistrement, testez sur la preview Vercel puis mergez la PR
          quand tout est bon.
        </p>
      </div>

      <ScheduleToast
        message={toast.message}
        tone={toast.tone}
        onDismiss={() => setToast({ message: "", tone: "info" })}
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <PharmacySegmentTabs tabs={SCHEDULE_TABS} active={tab} onChange={setTab} ariaLabel="Gestion horaires" />

        <div className="p-3 sm:p-4">
          {tab === "weekly" ? (
            <PharmacyWeeklyHoursTab
              draft={weeklyDraft}
              busy={busy}
              onChange={setWeeklyDraft}
              onSave={() => void saveWeekly()}
            />
          ) : null}

          {tab === "overrides" ? (
            <PharmacyOverridesTab
              todayIso={todayIso}
              overrideList={overrideList}
              onCallPeriods={onCallList}
              busy={busy}
              onAdd={addOverride}
              onDelete={deleteOverride}
              onHint={(m, t) => showHint(m, t ?? "info")}
            />
          ) : null}

          {tab === "on_call" ? (
            <PharmacyOnCallTab
              todayIso={todayIso}
              onCallList={onCallList}
              overrideList={overrideList}
              busy={busy}
              onPlan={planOnCall}
              onDelete={deleteOnCall}
              onHint={(m, t) => showHint(m, t ?? "info")}
            />
          ) : null}
        </div>
      </div>

      {pharmacyId ? (
        <Link href={`/pharmacie/${pharmacyId}`} className="inline-block text-sm font-medium text-emerald-800 underline">
          Voir la fiche publique
        </Link>
      ) : null}
    </PageShell>
  );
}
