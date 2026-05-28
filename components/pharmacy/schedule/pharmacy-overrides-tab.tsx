"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { CalendarOff, Clock3 } from "lucide-react";
import { PharmacyCompactTimeRange } from "@/components/pharmacy/schedule/pharmacy-compact-time-range";
import { OVERRIDE_TYPE_LABEL_FR } from "@/lib/pharmacy-schedule-fr";
import { findMoroccoHolidayOnDate, moroccoPublicHolidaysFromDate } from "@/lib/morocco-public-holidays";
import { canPlanOverrideOnDate } from "@/lib/pharmacy-schedule-conflicts";
import type { PharmacyDayOverrideRow, PharmacyOnCallPeriodRow } from "@/lib/pharmacy-profile-types";
import { pharmacyClosedTextClass } from "@/lib/pharmacy-open-status-ui";

function formatOverrideDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

const TYPE_OPTIONS = [
  {
    id: "closed" as const,
    label: "Fermeture",
    hint: "Fermé exceptionnellement ce jour (en plus des fériés nationaux).",
    icon: CalendarOff,
  },
  {
    id: "custom" as const,
    label: "Horaires spéciaux",
    hint: "Remplace les horaires habituels pour cette date seulement.",
    icon: Clock3,
  },
] as const;

export function PharmacyOverridesTab({
  todayIso,
  overrideList,
  onCallPeriods,
  busy,
  onAdd,
  onDelete,
  onHint,
}: {
  todayIso: string;
  overrideList: PharmacyDayOverrideRow[];
  onCallPeriods: Pick<PharmacyOnCallPeriodRow, "starts_at" | "ends_at">[];
  busy: boolean;
  onAdd: (payload: {
    day_date: string;
    override_type: "closed" | "custom";
    label: string | null;
    morning_opens_at: string | null;
    morning_closes_at: string | null;
    afternoon_opens_at: string | null;
    afternoon_closes_at: string | null;
  }) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<void>;
  onHint: (message: string, tone?: "info" | "warning" | "error" | "success") => void;
}) {
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideType, setOverrideType] = useState<"closed" | "custom">("closed");
  const [customMorningOpen, setCustomMorningOpen] = useState("09:00");
  const [customMorningClose, setCustomMorningClose] = useState("13:00");
  const [customAfternoonOpen, setCustomAfternoonOpen] = useState("15:00");
  const [customAfternoonClose, setCustomAfternoonClose] = useState("21:00");
  const [customMorningClosed, setCustomMorningClosed] = useState(false);
  const [customAfternoonClosed, setCustomAfternoonClosed] = useState(false);

  const upcomingHolidays = useMemo(() => moroccoPublicHolidaysFromDate(todayIso).slice(0, 12), [todayIso]);

  const dateConflict = overrideDate ? canPlanOverrideOnDate(onCallPeriods, overrideDate) : { ok: true as const };
  const holidayOnDate = overrideDate ? findMoroccoHolidayOnDate(overrideDate) : undefined;

  const submit = async () => {
    if (!overrideDate) {
      onHint("Choisissez une date.", "warning");
      return;
    }
    if (overrideDate < todayIso) {
      onHint("Impossible de planifier une date passée.", "error");
      return;
    }
    if (!dateConflict.ok) {
      onHint(dateConflict.reason, "error");
      return;
    }

    if (overrideType === "closed" && holidayOnDate) {
      onHint(
        `${holidayOnDate.labelFr} est déjà un jour férié (fermé automatiquement). Utilisez « Horaires spéciaux » si vous ouvrez quand même.`,
        "warning"
      );
      return;
    }

    let morning_opens_at: string | null = null;
    let morning_closes_at: string | null = null;
    let afternoon_opens_at: string | null = null;
    let afternoon_closes_at: string | null = null;

    if (overrideType === "custom") {
      if (!customMorningClosed && (!customMorningOpen || !customMorningClose)) {
        onHint("Renseignez le matin ou cochez Matin fermé.", "warning");
        return;
      }
      if (!customAfternoonClosed && (!customAfternoonOpen || !customAfternoonClose)) {
        onHint("Renseignez l'après-midi ou cochez Après-midi fermé.", "warning");
        return;
      }
      morning_opens_at = customMorningClosed ? null : customMorningOpen;
      morning_closes_at = customMorningClosed ? null : customMorningClose;
      afternoon_opens_at = customAfternoonClosed ? null : customAfternoonOpen;
      afternoon_closes_at = customAfternoonClosed ? null : customAfternoonClose;
      if (customMorningClosed && customAfternoonClosed) {
        onHint("Indiquez au moins un créneau ouvert.", "warning");
        return;
      }
    }

    const { error } = await onAdd({
      day_date: overrideDate,
      override_type: overrideType,
      label: overrideType === "custom" && holidayOnDate ? holidayOnDate.labelFr : null,
      morning_opens_at: overrideType === "custom" ? morning_opens_at : null,
      morning_closes_at: overrideType === "custom" ? morning_closes_at : null,
      afternoon_opens_at: overrideType === "custom" ? afternoon_opens_at : null,
      afternoon_closes_at: overrideType === "custom" ? afternoon_closes_at : null,
    });

    if (!error) {
      setOverrideDate("");
      onHint("Exception enregistrée.", "success");
    } else {
      onHint(error, "error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-violet-200/70 bg-violet-50/40 px-3 py-2.5">
        <p className="text-xs font-bold text-violet-950">Jours fériés Maroc (automatiques)</p>
        <p className="mt-1 text-[11px] leading-snug text-violet-900/90">
          Pas besoin de les saisir : l&apos;officine est <strong>fermée</strong> ces jours sur la fiche publique, sauf si
          vous êtes de garde. Les Aid et fêtes mobiles utilisent la <strong>première date annoncée</strong> jusqu&apos;à
          validation admin chaque année.
        </p>
        <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[10px] text-violet-950/90">
          {upcomingHolidays.map((h) => (
            <li key={h.id} className="flex justify-between gap-2 border-b border-violet-200/40 pb-0.5 last:border-0">
              <span>
                {formatShortDate(h.dateIso)} — {h.labelFr}
                {h.uncertainDate ? (
                  <span className="text-violet-700/80"> (date estimée)</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        Ajoutez seulement une <strong>fermeture exceptionnelle</strong> ou des <strong>horaires spéciaux</strong>. Interdit
        sur un jour déjà en garde.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = overrideType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={clsx(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold",
                active ? "border-primary bg-primary/5 text-primary" : "border-border bg-card"
              )}
              onClick={() => {
                setOverrideType(opt.id);
                onHint(opt.hint, "info");
              }}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-2.5 space-y-2">
        <label className="block text-[11px] font-bold">
          Date
          <input
            type="date"
            min={todayIso}
            className="mt-1 h-10 w-full rounded-lg border px-2 text-sm"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
          />
        </label>

        {holidayOnDate && overrideType === "closed" ? (
          <p className="text-[11px] font-medium text-amber-800">
            Férié automatique : {holidayOnDate.labelFr}. Choisissez « Horaires spéciaux » pour ouvrir ce jour.
          </p>
        ) : null}

        {!dateConflict.ok && overrideDate ? (
          <p className="text-[11px] font-medium text-red-700">{dateConflict.reason}</p>
        ) : null}

        {overrideType === "custom" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <PharmacyCompactTimeRange
              periodLabel="Matin"
              closed={customMorningClosed}
              opensAt={customMorningOpen}
              closesAt={customMorningClose}
              onClosedChange={setCustomMorningClosed}
              onOpensChange={setCustomMorningOpen}
              onClosesChange={setCustomMorningClose}
            />
            <PharmacyCompactTimeRange
              periodLabel="Après-m."
              closed={customAfternoonClosed}
              opensAt={customAfternoonOpen}
              closesAt={customAfternoonClose}
              onClosedChange={setCustomAfternoonClosed}
              onOpensChange={setCustomAfternoonOpen}
              onClosesChange={setCustomAfternoonClose}
            />
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy || !overrideDate || !dateConflict.ok}
        onClick={() => void submit()}
        className="w-full rounded-xl border-2 border-primary bg-primary/5 px-4 py-2.5 text-sm font-bold disabled:opacity-50 sm:w-auto"
      >
        Ajouter
      </button>

      {overrideList.length > 0 ? (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Vos exceptions planifiées
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {overrideList.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 rounded-lg border bg-muted/10 px-2.5 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-bold">{formatOverrideDate(o.day_date)}</p>
                  <p className="text-muted-foreground">
                    {o.override_type === "closed" ? (
                      <span className={pharmacyClosedTextClass}>{OVERRIDE_TYPE_LABEL_FR.closed}</span>
                    ) : (
                      OVERRIDE_TYPE_LABEL_FR[o.override_type]
                    )}
                    {o.override_type === "custom" ? (
                      <>
                        {" · "}
                        {o.morning_opens_at ? (
                          `M ${o.morning_opens_at.slice(0, 5)}–${o.morning_closes_at?.slice(0, 5)}`
                        ) : (
                          <>
                            M <span className={pharmacyClosedTextClass}>fermé</span>
                          </>
                        )}
                        {" / "}
                        {o.afternoon_opens_at ? (
                          `AM ${o.afternoon_opens_at.slice(0, 5)}–${o.afternoon_closes_at?.slice(0, 5)}`
                        ) : (
                          <>
                            AM <span className={pharmacyClosedTextClass}>fermé</span>
                          </>
                        )}
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[11px] font-semibold text-destructive underline"
                  disabled={busy}
                  onClick={() => void onDelete(o.id)}
                >
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Aucune exception manuelle.</p>
      )}
    </div>
  );
}
