"use client";

import { clsx } from "clsx";
import { PharmacyCompactTimeRange } from "@/components/pharmacy/schedule/pharmacy-compact-time-range";

const WEEKDAYS: { d: number; label: string }[] = [
  { d: 1, label: "Lun" },
  { d: 2, label: "Mar" },
  { d: 3, label: "Mer" },
  { d: 4, label: "Jeu" },
  { d: 5, label: "Ven" },
  { d: 6, label: "Sam" },
  { d: 7, label: "Dim" },
];

/** Teintes alternées pour distinguer les jours sans surcharger l’écran. */
const DAY_BLOCK_TINTS: Record<number, string> = {
  1: "border-sky-200/70 bg-sky-50/50",
  2: "border-emerald-200/70 bg-emerald-50/45",
  3: "border-violet-200/70 bg-violet-50/45",
  4: "border-amber-200/70 bg-amber-50/40",
  5: "border-rose-200/70 bg-rose-50/40",
  6: "border-teal-200/70 bg-teal-50/45",
  7: "border-slate-200/80 bg-slate-50/60",
};

export type WeeklyDraft = Record<string, { opens_at: string; closes_at: string; is_closed: boolean }>;

export function weeklyKey(weekday: number, period: "morning" | "afternoon") {
  return `${weekday}-${period}`;
}

function DayRow({
  weekday,
  label,
  draft,
  onChange,
}: {
  weekday: number;
  label: string;
  draft: WeeklyDraft;
  onChange: (next: WeeklyDraft) => void;
}) {
  const morningKey = weeklyKey(weekday, "morning");
  const afternoonKey = weeklyKey(weekday, "afternoon");
  const morning = draft[morningKey];
  const afternoon = draft[afternoonKey];
  const allClosed = morning?.is_closed && afternoon?.is_closed;

  const setPeriod = (period: "morning" | "afternoon", patch: Partial<WeeklyDraft[string]>) => {
    const k = weeklyKey(weekday, period);
    onChange({ ...draft, [k]: { ...draft[k], ...patch } });
  };

  const closeWholeDay = (closed: boolean) => {
    onChange({
      ...draft,
      [morningKey]: { ...morning, is_closed: closed, opens_at: morning.opens_at, closes_at: morning.closes_at },
      [afternoonKey]: {
        ...afternoon,
        is_closed: closed,
        opens_at: afternoon.opens_at,
        closes_at: afternoon.closes_at,
      },
    });
  };

  return (
    <div
      className={clsx(
        "grid grid-cols-[2.75rem_1fr] grid-rows-2 gap-x-2 gap-y-1.5 rounded-xl border px-2 py-2 sm:grid-cols-[2.75rem_1fr_1fr] sm:grid-rows-1",
        DAY_BLOCK_TINTS[weekday] ?? "border-border/70 bg-card",
        allClosed && "opacity-75 saturate-50"
      )}
    >
      <div className="row-span-2 flex flex-col justify-center sm:row-span-1">
        <span className="text-xs font-bold text-foreground">{label}</span>
        <label className="mt-1 flex items-center gap-0.5 text-[9px] font-semibold text-muted-foreground">
          <input
            type="checkbox"
            className="size-3 rounded"
            checked={allClosed}
            onChange={(e) => closeWholeDay(e.target.checked)}
          />
          Jour off
        </label>
      </div>

      <PharmacyCompactTimeRange
        className="col-start-2 row-start-1 sm:col-start-2"
        periodLabel="Matin"
        closed={morning.is_closed}
        opensAt={morning.opens_at}
        closesAt={morning.closes_at}
        onClosedChange={(c) => setPeriod("morning", { is_closed: c })}
        onOpensChange={(v) => setPeriod("morning", { opens_at: v })}
        onClosesChange={(v) => setPeriod("morning", { closes_at: v })}
      />

      <PharmacyCompactTimeRange
        className="col-start-2 row-start-2 sm:col-start-3 sm:row-start-1"
        periodLabel="Après-midi"
        closed={afternoon.is_closed}
        opensAt={afternoon.opens_at}
        closesAt={afternoon.closes_at}
        onClosedChange={(c) => setPeriod("afternoon", { is_closed: c })}
        onOpensChange={(v) => setPeriod("afternoon", { opens_at: v })}
        onClosesChange={(v) => setPeriod("afternoon", { closes_at: v })}
      />
    </div>
  );
}

export function PharmacyWeeklyHoursTab({
  draft,
  busy,
  onChange,
  onSave,
}: {
  draft: WeeklyDraft;
  busy: boolean;
  onChange: (next: WeeklyDraft) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-snug text-muted-foreground">
        Horaires habituels de la semaine. Modifiez directement chaque jour — les jours fériés nationaux ferment
        automatiquement l&apos;officine (sauf garde).
      </p>

      <div className="space-y-1.5">
        {WEEKDAYS.map(({ d, label }) => (
          <DayRow key={d} weekday={d} label={label} draft={draft} onChange={onChange} />
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50 sm:w-auto"
      >
        Enregistrer les horaires
      </button>
    </div>
  );
}
