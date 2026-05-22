"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { PharmacySimpleTimeInput } from "@/components/pharmacy/schedule/pharmacy-simple-time-input";

const WEEKDAYS: { d: number; label: string; short: string }[] = [
  { d: 1, label: "Lundi", short: "Lun" },
  { d: 2, label: "Mardi", short: "Mar" },
  { d: 3, label: "Mercredi", short: "Mer" },
  { d: 4, label: "Jeudi", short: "Jeu" },
  { d: 5, label: "Vendredi", short: "Ven" },
  { d: 6, label: "Samedi", short: "Sam" },
  { d: 7, label: "Dimanche", short: "Dim" },
];

export type WeeklyDraft = Record<string, { opens_at: string; closes_at: string; is_closed: boolean }>;

export function weeklyKey(weekday: number, period: "morning" | "afternoon") {
  return `${weekday}-${period}`;
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
  const [openDay, setOpenDay] = useState<number>(() => {
    const js = new Date().getDay();
    return js === 0 ? 7 : js;
  });

  const applyPreset = (weekday: number, preset: "weekday" | "saturday" | "closed") => {
    const next = { ...draft };
    if (preset === "closed") {
      for (const period of ["morning", "afternoon"] as const) {
        const k = weeklyKey(weekday, period);
        next[k] = { opens_at: "", closes_at: "", is_closed: true };
      }
      onChange(next);
      return;
    }
    if (preset === "saturday") {
      next[weeklyKey(weekday, "morning")] = { opens_at: "09:00", closes_at: "13:00", is_closed: false };
      next[weeklyKey(weekday, "afternoon")] = { opens_at: "", closes_at: "", is_closed: true };
      onChange(next);
      return;
    }
    next[weeklyKey(weekday, "morning")] = { opens_at: "09:00", closes_at: "13:00", is_closed: false };
    next[weeklyKey(weekday, "afternoon")] = { opens_at: "15:00", closes_at: "21:00", is_closed: false };
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-muted/40 px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
        Touchez un jour pour modifier. Utilisez les boutons d&apos;heure (9h, 13h…) — plus simple que la saisie
        clavier sur téléphone.
      </p>

      <div className="flex gap-1 overflow-x-auto pb-1 sm:hidden">
        {WEEKDAYS.map(({ d, short }) => (
          <button
            key={d}
            type="button"
            className={clsx(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
              openDay === d ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
            )}
            onClick={() => setOpenDay(d)}
          >
            {short}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {WEEKDAYS.map(({ d, label }) => {
          const isOpen = openDay === d;
          const morning = draft[weeklyKey(d, "morning")];
          const afternoon = draft[weeklyKey(d, "afternoon")];
          const summary =
            morning?.is_closed && afternoon?.is_closed
              ? "Fermé"
              : [
                  !morning?.is_closed && morning?.opens_at
                    ? `M ${morning.opens_at.slice(0, 5)}–${morning.closes_at?.slice(0, 5) ?? "?"}`
                    : morning?.is_closed
                      ? "M fermé"
                      : null,
                  !afternoon?.is_closed && afternoon?.opens_at
                    ? `AM ${afternoon.opens_at.slice(0, 5)}–${afternoon.closes_at?.slice(0, 5) ?? "?"}`
                    : afternoon?.is_closed
                      ? "AM fermé"
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

          return (
            <div
              key={d}
              className={clsx(
                "overflow-hidden rounded-xl border border-border/80 bg-muted/20",
                isOpen && "ring-1 ring-primary/30"
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
                onClick={() => setOpenDay(isOpen ? 0 : d)}
              >
                <div>
                  <p className="text-sm font-bold">{label}</p>
                  <p className="text-[11px] text-muted-foreground">{summary || "—"}</p>
                </div>
                <ChevronDown className={clsx("size-4 shrink-0 transition", isOpen && "rotate-180")} />
              </button>

              {isOpen ? (
                <div className="space-y-3 border-t border-border/60 bg-card px-3 pb-3 pt-2">
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[10px] font-semibold"
                      onClick={() => applyPreset(d, "weekday")}
                    >
                      Lun–ven 9h–13h / 15h–21h
                    </button>
                    {d === 6 ? (
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1 text-[10px] font-semibold"
                        onClick={() => applyPreset(d, "saturday")}
                      >
                        Sam. 9h–13h
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-[10px] font-semibold text-destructive"
                      onClick={() => applyPreset(d, "closed")}
                    >
                      Jour fermé
                    </button>
                  </div>

                  {(["morning", "afternoon"] as const).map((period) => {
                    const k = weeklyKey(d, period);
                    const cell = draft[k];
                    const periodLabel = period === "morning" ? "Matin" : "Après-midi";
                    return (
                      <div key={period} className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-bold">{periodLabel}</p>
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={cell.is_closed}
                              onChange={(e) =>
                                onChange({
                                  ...draft,
                                  [k]: { ...cell, is_closed: e.target.checked },
                                })
                              }
                            />
                            Fermé
                          </label>
                        </div>
                        {!cell.is_closed ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <PharmacySimpleTimeInput
                              label="Ouverture"
                              value={cell.opens_at}
                              onChange={(v) => onChange({ ...draft, [k]: { ...cell, opens_at: v } })}
                            />
                            <PharmacySimpleTimeInput
                              label="Fermeture"
                              value={cell.closes_at}
                              onChange={(v) => onChange({ ...draft, [k]: { ...cell, closes_at: v } })}
                            />
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
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
