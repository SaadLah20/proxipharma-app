"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import { ON_CALL_KIND_LABEL_FR } from "@/lib/pharmacy-schedule-fr";
import type { PharmacyOnCallKind, PharmacyWeeklyHourRow } from "@/lib/pharmacy-profile-types";

const WEEKDAYS: { d: number; label: string }[] = [
  { d: 1, label: "Lundi" },
  { d: 2, label: "Mardi" },
  { d: 3, label: "Mercredi" },
  { d: 4, label: "Jeudi" },
  { d: 5, label: "Vendredi" },
  { d: 6, label: "Samedi" },
  { d: 7, label: "Dimanche" },
];

type WeeklyDraft = Record<string, { opens_at: string; closes_at: string; is_closed: boolean }>;

function key(weekday: number, period: "morning" | "afternoon") {
  return `${weekday}-${period}`;
}

function rowsToDraft(rows: PharmacyWeeklyHourRow[]): WeeklyDraft {
  const d: WeeklyDraft = {};
  for (const w of rows) {
    d[key(w.weekday, w.period)] = {
      opens_at: w.opens_at?.slice(0, 5) ?? "",
      closes_at: w.closes_at?.slice(0, 5) ?? "",
      is_closed: w.is_closed,
    };
  }
  for (const { d: wd } of WEEKDAYS) {
    for (const period of ["morning", "afternoon"] as const) {
      const k = key(wd, period);
      if (!d[k]) d[k] = { opens_at: "", closes_at: "", is_closed: wd === 7 };
    }
  }
  return d;
}

export default function PharmacienHorairesGardePage() {
  const router = useRouter();
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyDraft>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [overrideDate, setOverrideDate] = useState("");
  const [overrideType, setOverrideType] = useState<"closed" | "holiday" | "custom">("closed");
  const [overrideLabel, setOverrideLabel] = useState("");

  const [onCallKind, setOnCallKind] = useState<PharmacyOnCallKind>("weekday_24h");
  const [onCallStart, setOnCallStart] = useState("");
  const [onCallEnd, setOnCallEnd] = useState("");
  const [onCallNote, setOnCallNote] = useState("");
  const [onCallList, setOnCallList] = useState<
    { id: string; kind: string; starts_at: string; ends_at: string; note: string | null }[]
  >([]);

  const load = useCallback(async () => {
    setMessage("");
    const ctx = await loadPharmacistPharmacyId();
    if (!ctx.pharmacyId) {
      setMessage(ctx.error ?? "Erreur");
      setLoading(false);
      return;
    }
    setPharmacyId(ctx.pharmacyId);

    const [wh, oc] = await Promise.all([
      supabase
        .from("pharmacy_weekly_hours")
        .select("weekday,period,opens_at,closes_at,is_closed")
        .eq("pharmacy_id", ctx.pharmacyId),
      supabase
        .from("pharmacy_on_call_periods")
        .select("id,kind,starts_at,ends_at,note")
        .eq("pharmacy_id", ctx.pharmacyId)
        .order("starts_at", { ascending: false })
        .limit(20),
    ]);

    setWeeklyDraft(rowsToDraft((wh.data ?? []) as PharmacyWeeklyHourRow[]));
    setOnCallList((oc.data ?? []) as typeof onCallList);
    setLoading(false);
  }, []);

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
    setMessage("");
    const rows: {
      pharmacy_id: string;
      weekday: number;
      period: string;
      opens_at: string | null;
      closes_at: string | null;
      is_closed: boolean;
    }[] = [];
    for (const { d: wd } of WEEKDAYS) {
      for (const period of ["morning", "afternoon"] as const) {
        const cell = weeklyDraft[key(wd, period)];
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
    setMessage(error ? error.message : "Horaires enregistrés.");
  };

  const addOverride = async () => {
    if (!pharmacyId || !overrideDate) return;
    setBusy(true);
    const { error } = await supabase.from("pharmacy_day_overrides").upsert(
      {
        pharmacy_id: pharmacyId,
        day_date: overrideDate,
        override_type: overrideType,
        label: overrideLabel.trim() || null,
      },
      { onConflict: "pharmacy_id,day_date" }
    );
    setBusy(false);
    setMessage(error ? error.message : "Exception enregistrée.");
    setOverrideDate("");
    setOverrideLabel("");
  };

  const addOnCall = async () => {
    if (!pharmacyId || !onCallStart || !onCallEnd) return;
    setBusy(true);
    const { error } = await supabase.from("pharmacy_on_call_periods").insert({
      pharmacy_id: pharmacyId,
      kind: onCallKind,
      starts_at: new Date(onCallStart).toISOString(),
      ends_at: new Date(onCallEnd).toISOString(),
      note: onCallNote.trim() || null,
    });
    setBusy(false);
    if (error) setMessage(error.message);
    else {
      setMessage("Garde planifiée.");
      setOnCallStart("");
      setOnCallEnd("");
      setOnCallNote("");
      void load();
    }
  };

  const deleteOnCall = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("pharmacy_on_call_periods").delete().eq("id", id);
    setBusy(false);
    if (!error) void load();
    else setMessage(error.message);
  };

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-5">
      <div>
        <Link href="/dashboard/pharmacien/ma-fiche" className="text-xs font-medium text-primary underline">
          ← Ma fiche
        </Link>
        <h1 className="mt-2 text-lg font-bold">Horaires et garde</h1>
        <p className="text-xs text-muted-foreground">
          Modèle Maroc par défaut (lun–ven 9h–13h / 15h–21h, sam 9h–13h). Le public voit la semaine en cours et si vous
          êtes de garde aujourd&apos;hui.
        </p>
      </div>

      {message ? <p className="rounded-lg bg-sky-50 p-2 text-sm text-sky-950">{message}</p> : null}

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Horaires habituels</h2>
        <div className="mt-3 space-y-3">
          {WEEKDAYS.map(({ d, label }) => (
            <div key={d} className="rounded-md border border-border/70 p-2">
              <p className="text-[11px] font-bold">{label}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {(["morning", "afternoon"] as const).map((period) => {
                  const k = key(d, period);
                  const cell = weeklyDraft[k];
                  return (
                    <div key={period} className="space-y-1">
                      <p className="text-[10px] uppercase text-muted-foreground">
                        {period === "morning" ? "Matin" : "Après-midi"}
                      </p>
                      <label className="flex items-center gap-2 text-[11px]">
                        <input
                          type="checkbox"
                          checked={cell.is_closed}
                          onChange={(e) =>
                            setWeeklyDraft((p) => ({
                              ...p,
                              [k]: { ...p[k], is_closed: e.target.checked },
                            }))
                          }
                        />
                        Fermé
                      </label>
                      {!cell.is_closed ? (
                        <div className="flex gap-1">
                          <input
                            type="time"
                            className="w-full rounded border px-1 py-1 text-xs"
                            value={cell.opens_at}
                            onChange={(e) =>
                              setWeeklyDraft((p) => ({ ...p, [k]: { ...p[k], opens_at: e.target.value } }))
                            }
                          />
                          <input
                            type="time"
                            className="w-full rounded border px-1 py-1 text-xs"
                            value={cell.closes_at}
                            onChange={(e) =>
                              setWeeklyDraft((p) => ({ ...p, [k]: { ...p[k], closes_at: e.target.value } }))
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveWeekly()}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Enregistrer les horaires
        </button>
      </section>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-bold">Exception (fermeture ou férié)</h2>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-xs">
            Date
            <input
              type="date"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Type
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={overrideType}
              onChange={(e) => setOverrideType(e.target.value as typeof overrideType)}
            >
              <option value="closed">Fermeture exceptionnelle</option>
              <option value="holiday">Jour férié</option>
              <option value="custom">Horaires spécifiques</option>
            </select>
          </label>
          <label className="text-xs sm:col-span-2">
            Libellé (optionnel)
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={overrideLabel}
              onChange={(e) => setOverrideLabel(e.target.value)}
              placeholder="Ex. Aid el-Fitr"
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !overrideDate}
          onClick={() => void addOverride()}
          className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Ajouter l&apos;exception
        </button>
      </section>

      <section className="rounded-lg border border-amber-200/80 bg-amber-50/30 p-4 shadow-sm">
        <h2 className="text-sm font-bold text-amber-950">Planning de garde</h2>
        <p className="mt-1 text-[11px] text-amber-900/90">
          Garde 24 h : ouverture continue de l&apos;heure de début à l&apos;heure de fin (ex. 15 mai 9h → 16 mai 9h).
          Garde 48 h week-end : typiquement samedi 9h → dimanche 9h.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs sm:col-span-2">
            Type
            <select
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={onCallKind}
              onChange={(e) => setOnCallKind(e.target.value as PharmacyOnCallKind)}
            >
              {Object.entries(ON_CALL_KIND_LABEL_FR).map(([k, lab]) => (
                <option key={k} value={k}>
                  {lab}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Début
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={onCallStart}
              onChange={(e) => setOnCallStart(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Fin
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={onCallEnd}
              onChange={(e) => setOnCallEnd(e.target.value)}
            />
          </label>
          <label className="text-xs sm:col-span-2">
            Note
            <input
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
              value={onCallNote}
              onChange={(e) => setOnCallNote(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={busy || !onCallStart || !onCallEnd}
          onClick={() => void addOnCall()}
          className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Planifier une garde
        </button>

        {onCallList.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {onCallList.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-2 rounded border bg-white p-2 text-xs">
                <div>
                  <p className="font-semibold">{ON_CALL_KIND_LABEL_FR[p.kind] ?? p.kind}</p>
                  <p className="text-muted-foreground">
                    {new Date(p.starts_at).toLocaleString("fr-FR")} → {new Date(p.ends_at).toLocaleString("fr-FR")}
                  </p>
                  {p.note ? <p>{p.note}</p> : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 text-destructive underline"
                  disabled={busy}
                  onClick={() => void deleteOnCall(p.id)}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {pharmacyId ? (
        <Link href={`/pharmacie/${pharmacyId}`} className="inline-block text-sm font-medium text-emerald-800 underline">
          Voir la fiche publique
        </Link>
      ) : null}
    </PageShell>
  );
}
