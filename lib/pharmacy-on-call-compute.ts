import type { PharmacyOnCallKind } from "@/lib/pharmacy-profile-types";

/** Heure de début par défaut des gardes (modèle Maroc pilote). */
export const ON_CALL_DEFAULT_START_TIME = "09:00";

export type ComputedOnCallPeriod = {
  startsAtIso: string;
  endsAtIso: string;
  startDateIso: string;
  endDateIso: string;
  durationHours: number;
};

function parseDateIso(dateIso: string): { y: number; m: number; d: number } {
  const [y, m, d] = dateIso.split("-").map(Number);
  return { y, m, d };
}

function dateIsoFromLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateTimeFromParts(dateIso: string, timeHHMM: string): Date {
  const { y, m, d } = parseDateIso(dateIso);
  const [hh, mm] = timeHHMM.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm ?? 0, 0, 0);
}

function durationHoursForKind(kind: PharmacyOnCallKind): number {
  switch (kind) {
    case "weekend_48h":
      return 48;
    case "weekday_24h":
    case "holiday_24h":
      return 24;
    default:
      return 24;
  }
}

/** Calcule starts_at / ends_at et dates calendaires à partir du type et du jour de début. */
export function computeOnCallPeriod(
  kind: PharmacyOnCallKind,
  startDateIso: string,
  startTimeHHMM: string = ON_CALL_DEFAULT_START_TIME
): ComputedOnCallPeriod {
  const hours = durationHoursForKind(kind);
  const startsAt = localDateTimeFromParts(startDateIso, startTimeHHMM);
  const endsAt = new Date(startsAt.getTime() + hours * 60 * 60 * 1000);
  const endDateIso = dateIsoFromLocalDate(new Date(endsAt.getTime() - 1));

  return {
    startsAtIso: startsAt.toISOString(),
    endsAtIso: endsAt.toISOString(),
    startDateIso: dateIsoFromLocalDate(startsAt),
    endDateIso,
    durationHours: hours,
  };
}

export function formatOnCallEndLabel(kind: PharmacyOnCallKind, endDateIso: string): string {
  const d = new Date(`${endDateIso}T12:00:00`);
  const label = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return kind === "weekend_48h"
    ? `Fin automatique : ${label} à ${ON_CALL_DEFAULT_START_TIME.replace(":", "h")} (48 h après le début)`
    : `Fin automatique : ${label} à ${ON_CALL_DEFAULT_START_TIME.replace(":", "h")} (24 h après le début)`;
}
