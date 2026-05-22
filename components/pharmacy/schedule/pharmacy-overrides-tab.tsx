"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { CalendarOff, PartyPopper, Clock3 } from "lucide-react";
import { PharmacySimpleTimeInput } from "@/components/pharmacy/schedule/pharmacy-simple-time-input";
import { OVERRIDE_TYPE_LABEL_FR } from "@/lib/pharmacy-schedule-fr";
import {
  findMoroccoHolidayById,
  moroccoPublicHolidaysFromDate,
} from "@/lib/morocco-public-holidays";
import { canPlanOverrideOnDate } from "@/lib/pharmacy-schedule-conflicts";
import type { PharmacyDayOverrideRow, PharmacyOnCallPeriodRow } from "@/lib/pharmacy-profile-types";

function formatOverrideDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TYPE_OPTIONS = [
  {
    id: "closed" as const,
    label: "Fermeture exceptionnelle",
    hint: "La pharmacie sera fermée ce jour-là sur la fiche publique.",
    icon: CalendarOff,
  },
  {
    id: "holiday" as const,
    label: "Jour férié",
    hint: "Choisissez la fête dans la liste (dates Maroc).",
    icon: PartyPopper,
  },
  {
    id: "custom" as const,
    label: "Horaires spécifiques",
    hint: "Remplace les horaires habituels de ce jour uniquement.",
    icon: Clock3,
  },
];

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
    override_type: "closed" | "holiday" | "custom";
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
  const [overrideType, setOverrideType] = useState<"closed" | "holiday" | "custom">("closed");
  const [holidayId, setHolidayId] = useState("");
  const [customMorningOpen, setCustomMorningOpen] = useState("09:00");
  const [customMorningClose, setCustomMorningClose] = useState("13:00");
  const [customAfternoonOpen, setCustomAfternoonOpen] = useState("15:00");
  const [customAfternoonClose, setCustomAfternoonClose] = useState("21:00");
  const [customMorningClosed, setCustomMorningClosed] = useState(false);
  const [customAfternoonClosed, setCustomAfternoonClosed] = useState(false);

  const holidays = useMemo(() => moroccoPublicHolidaysFromDate(todayIso), [todayIso]);

  const dateConflict = overrideDate ? canPlanOverrideOnDate(onCallPeriods, overrideDate) : { ok: true as const };

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

    let label: string | null = null;
    let morning_opens_at: string | null = null;
    let morning_closes_at: string | null = null;
    let afternoon_opens_at: string | null = null;
    let afternoon_closes_at: string | null = null;

    if (overrideType === "holiday") {
      const h = findMoroccoHolidayById(holidayId);
      if (!h) {
        onHint("Choisissez un jour férié dans la liste.", "warning");
        return;
      }
      if (h.dateIso !== overrideDate) setOverrideDate(h.dateIso);
      label = h.labelFr;
    } else if (overrideType === "custom") {
      if (!customMorningClosed && (!customMorningOpen || !customMorningClose)) {
        onHint("Renseignez les horaires du matin ou cochez « Matin fermé ».", "warning");
        return;
      }
      if (!customAfternoonClosed && (!customAfternoonOpen || !customAfternoonClose)) {
        onHint("Renseignez les horaires de l'après-midi ou cochez « Après-midi fermé ».", "warning");
        return;
      }
      morning_opens_at = customMorningClosed ? null : customMorningOpen;
      morning_closes_at = customMorningClosed ? null : customMorningClose;
      afternoon_opens_at = customAfternoonClosed ? null : customAfternoonOpen;
      afternoon_closes_at = customAfternoonClosed ? null : customAfternoonClose;
      if (customMorningClosed && customAfternoonClosed) {
        onHint("Indiquez au moins un créneau ouvert pour des horaires spécifiques.", "warning");
        return;
      }
    }

    const day_date = overrideType === "holiday" && holidayId ? findMoroccoHolidayById(holidayId)!.dateIso : overrideDate;

    const { error } = await onAdd({
      day_date,
      override_type: overrideType,
      label,
      morning_opens_at: overrideType === "custom" ? morning_opens_at : null,
      morning_closes_at: overrideType === "custom" ? morning_closes_at : null,
      afternoon_opens_at: overrideType === "custom" ? afternoon_opens_at : null,
      afternoon_closes_at: overrideType === "custom" ? afternoon_closes_at : null,
    });

    if (!error) {
      setOverrideDate("");
      setHolidayId("");
      onHint("Exception enregistrée — visible sur la fiche publique.", "success");
    } else {
      onHint(error, "error");
    }
  };

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] leading-snug text-muted-foreground">
        Prioritaire sur les horaires habituels. <strong>Interdit</strong> sur un jour déjà en garde — planifiez
        d&apos;abord la garde (elle peut remplacer une exception existante).
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {TYPE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = overrideType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={clsx(
                "rounded-xl border p-2.5 text-left transition",
                active ? "border-primary bg-primary/5 ring-1 ring-primary/40" : "border-border bg-card"
              )}
              onClick={() => {
                setOverrideType(opt.id);
                onHint(opt.hint, "info");
              }}
            >
              <Icon className="mb-1 size-4 text-primary" />
              <p className="text-xs font-bold leading-tight">{opt.label}</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-3 space-y-3">
        <label className="block text-xs font-bold">
          Date
          <input
            type="date"
            min={todayIso}
            className="mt-1 h-11 w-full rounded-lg border px-2 text-sm"
            value={overrideDate}
            onChange={(e) => setOverrideDate(e.target.value)}
          />
        </label>

        {!dateConflict.ok && overrideDate ? (
          <p className="text-xs font-medium text-red-700">{dateConflict.reason}</p>
        ) : null}

        {overrideType === "holiday" ? (
          <label className="block text-xs font-bold">
            Fête (Maroc)
            <select
              className="mt-1 h-11 w-full rounded-lg border px-2 text-sm"
              value={holidayId}
              onChange={(e) => {
                setHolidayId(e.target.value);
                const h = findMoroccoHolidayById(e.target.value);
                if (h) setOverrideDate(h.dateIso);
              }}
            >
              <option value="">— Choisir une fête —</option>
              {holidays.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.dateIso.split("-").reverse().join("/")} — {h.labelFr}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] font-normal text-muted-foreground">
              Liste pilote ; les dates seront gérées par l&apos;admin plus tard.
            </span>
          </label>
        ) : null}

        {overrideType === "custom" ? (
          <div className="space-y-3 rounded-lg bg-muted/20 p-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground">
              Horaires affichés sur la fiche publique pour ce jour
            </p>
            <div className="rounded-lg border border-border/70 bg-card p-2">
              <label className="mb-2 flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={customMorningClosed}
                  onChange={(e) => setCustomMorningClosed(e.target.checked)}
                />
                Matin fermé
              </label>
              {!customMorningClosed ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <PharmacySimpleTimeInput label="Ouverture matin" value={customMorningOpen} onChange={setCustomMorningOpen} />
                  <PharmacySimpleTimeInput label="Fermeture matin" value={customMorningClose} onChange={setCustomMorningClose} />
                </div>
              ) : null}
            </div>
            <div className="rounded-lg border border-border/70 bg-card p-2">
              <label className="mb-2 flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={customAfternoonClosed}
                  onChange={(e) => setCustomAfternoonClosed(e.target.checked)}
                />
                Après-midi fermé
              </label>
              {!customAfternoonClosed ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <PharmacySimpleTimeInput
                    label="Ouverture après-midi"
                    value={customAfternoonOpen}
                    onChange={setCustomAfternoonOpen}
                  />
                  <PharmacySimpleTimeInput
                    label="Fermeture après-midi"
                    value={customAfternoonClose}
                    onChange={setCustomAfternoonClose}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy || !overrideDate || !dateConflict.ok}
        onClick={() => void submit()}
        className="w-full rounded-xl border-2 border-primary bg-primary/5 px-4 py-3 text-sm font-bold disabled:opacity-50 sm:w-auto"
      >
        Ajouter l&apos;exception
      </button>

      {overrideList.length > 0 ? (
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">À venir</h3>
          <ul className="mt-2 space-y-2">
            {overrideList.map((o) => (
              <li
                key={o.id}
                className="flex items-start justify-between gap-2 rounded-xl border bg-muted/10 p-3 text-xs"
              >
                <div>
                  <p className="font-bold">{formatOverrideDate(o.day_date)}</p>
                  <p className="text-muted-foreground">{OVERRIDE_TYPE_LABEL_FR[o.override_type]}</p>
                  {o.label?.trim() ? <p className="mt-0.5">{o.label.trim()}</p> : null}
                  {o.override_type === "custom" ? (
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {o.morning_opens_at ? `Matin ${o.morning_opens_at.slice(0, 5)}–${o.morning_closes_at?.slice(0, 5)}` : "Matin fermé"}
                      {" · "}
                      {o.afternoon_opens_at
                        ? `AM ${o.afternoon_opens_at.slice(0, 5)}–${o.afternoon_closes_at?.slice(0, 5)}`
                        : "Après-midi fermé"}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="shrink-0 font-semibold text-destructive underline"
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
        <p className="text-[11px] text-muted-foreground">Aucune exception planifiée.</p>
      )}
    </div>
  );
}
