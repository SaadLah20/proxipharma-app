import type { AppLocale } from "@/lib/i18n/config";
import { localeToBcp47 } from "@/lib/i18n/config";

export { localeToBcp47 };

export function formatDateForLocale(
  iso: string | Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(localeToBcp47(locale), options);
}

export function formatDateTimeForLocale(
  iso: string | Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(localeToBcp47(locale), options);
}

/** Hub / liste patient : `03/05/2026 · 18h30` (FR) ou équivalent locale. */
export function formatDateTimeShortForLocale(iso: string | null | undefined, locale: AppLocale): string {
  if (iso == null || String(iso).trim() === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (locale === "fr") {
    const datePart = d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${datePart} · ${h}h${min}`;
  }
  return d.toLocaleString(localeToBcp47(locale), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export function collatorForLocale(locale: AppLocale): Intl.Collator {
  return new Intl.Collator(localeToBcp47(locale));
}

/** Minutes depuis minuit → `09h05` (FR) ou `09:05` (AR). */
export function formatMinutesForLocale(min: number, locale: AppLocale): string {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  if (locale === "fr") {
    return `${String(h).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
  }
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Heure Postgres (`time` / `HH:MM`) → `09h05` (FR) ou équivalent 24 h. */
export function formatTimePgForLocale(pgTime: string | null | undefined, locale: AppLocale): string {
  if (pgTime == null) return "";
  const s = String(pgTime).trim();
  if (s === "") return "";
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  const hh = Math.min(23, Math.max(0, Number.parseInt(m[1], 10)));
  const mm = m[2].slice(0, 2);
  if (locale === "fr") {
    return `${String(hh).padStart(2, "0")}h${mm}`;
  }
  return `${String(hh).padStart(2, "0")}:${mm}`;
}

/** `YYYY-MM-DD` → date courte locale. */
export function formatDateShortYmdForLocale(
  ymd: string | null | undefined,
  locale: AppLocale,
  withWeekday = false,
): string {
  if (ymd == null) return "";
  const parts = String(ymd).trim().split("-").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return String(ymd);
  const [y, mo, d] = parts;
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return String(ymd);
  return dt.toLocaleDateString(localeToBcp47(locale), {
    weekday: withWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Passage patient : date courte + heure si présente. */
export function formatPlannedVisitForLocale(
  dateYmd: string | null | undefined,
  timePg: string | null | undefined,
  locale: AppLocale,
): string {
  const d = formatDateShortYmdForLocale(dateYmd ?? null, locale, true);
  const t = formatTimePgForLocale(timePg ?? null, locale);
  if (!d) return "";
  return t ? `${d} · ${t}` : d;
}

/** Bandeau dossier : `01/06/26 - 16h22` (fuseau Casablanca). */
export function formatDossierSentAtCompactForLocale(
  iso: string | null | undefined,
  locale: AppLocale,
): string {
  if (iso == null || String(iso).trim() === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const bcp47 = localeToBcp47(locale);
  const datePart = d.toLocaleDateString(bcp47, {
    timeZone: "Africa/Casablanca",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
  const f = new Intl.DateTimeFormat(bcp47, {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = f.formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value.padStart(2, "0") ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value.padStart(2, "0") ?? "00";
  const timePart = locale === "fr" ? `${hh}h${mm}` : `${hh}:${mm}`;
  return `${datePart} - ${timePart}`;
}

function parseYmdLocal(ymd: string): Date | null {
  const parts = String(ymd).trim().split("-").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = parts;
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Écart temporel lisible (passage passé ou à venir). */
export function formatRelativeToNowForLocale(target: Date, locale: AppLocale, now = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const future = diffMs > 0;
  const rtf = new Intl.RelativeTimeFormat(localeToBcp47(locale), { numeric: "auto" });
  const minutes = Math.round(absMs / 60_000);
  if (minutes < 1) return future ? rtf.format(0, "second") : rtf.format(0, "second");
  if (minutes < 60) return rtf.format(future ? minutes : -minutes, "minute");
  const hours = Math.round(absMs / 3_600_000);
  if (hours < 24) return rtf.format(future ? hours : -hours, "hour");
  const days = Math.round(absMs / 86_400_000);
  if (days < 30) return rtf.format(future ? days : -days, "day");
  const months = Math.round(days / 30);
  if (months < 12) return rtf.format(future ? months : -months, "month");
  const years = Math.round(days / 365);
  return rtf.format(future ? years : -years, "year");
}

/** Instant ISO → date courte + heure 24 h, fuseau Casablanca. */
export function formatDateShortCasablancaWithTimeForLocale(
  iso: string | null | undefined,
  locale: AppLocale,
): string {
  if (iso == null || String(iso).trim() === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const bcp47 = localeToBcp47(locale);
  const datePart = d.toLocaleDateString(bcp47, {
    timeZone: "Africa/Casablanca",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const f = new Intl.DateTimeFormat(bcp47, {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = f.formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value.padStart(2, "0") ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value.padStart(2, "0") ?? "00";
  const timePart = locale === "fr" ? `${hh}h${mm}` : `${hh}:${mm}`;
  return `${datePart} · ${timePart}`;
}

export function archiveTerminalFootnoteForLocale(
  iso: string | null | undefined,
  locale: AppLocale,
  labelPrefix: string,
): { label: string; relative: string } | null {
  if (iso == null || String(iso).trim() === "") return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const absolute = formatDateShortCasablancaWithTimeForLocale(iso, locale);
  if (!absolute) return null;
  const relative = formatRelativeToNowForLocale(d, locale);
  return {
    label: `${labelPrefix} ${absolute}`,
    relative,
  };
}

export function patientArchiveLastPlannedVisitFootnoteForLocale(
  dateYmd: string | null | undefined,
  timePg: string | null | undefined,
  locale: AppLocale,
  labels: { indicative: string; indicativeRelative: (relative: string) => string },
): { label: string; relative: string } | null {
  const ymd = (dateYmd ?? "").trim();
  if (!ymd) return null;
  const datePart = formatDateShortYmdForLocale(ymd, locale, false);
  const timePart = formatTimePgForLocale(timePg ?? null, locale);
  if (!datePart) return null;
  const whenLabel = timePart ? `${datePart} — ${timePart}` : datePart;
  const visitAt = parseYmdLocal(ymd);
  if (!visitAt) {
    return { label: labels.indicative, relative: whenLabel };
  }
  if (timePart) {
    const m = String(timePg ?? "").match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      visitAt.setHours(Math.min(23, Number.parseInt(m[1], 10)), Number.parseInt(m[2], 10), 0, 0);
    }
  }
  const relative = formatRelativeToNowForLocale(visitAt, locale);
  return {
    label: relative ? labels.indicativeRelative(relative) : labels.indicative,
    relative: whenLabel,
  };
}

export function plannedVisitPassageLineForLocale(
  dateYmd: string | null | undefined,
  timePg: string | null | undefined,
  locale: AppLocale,
  labels: { withTime: (date: string, time: string) => string; dateOnly: (date: string) => string },
): string {
  const d = formatDateShortYmdForLocale(dateYmd ?? null, locale, true);
  const t = formatTimePgForLocale(timePg ?? null, locale);
  if (!d) return "";
  return t ? labels.withTime(d, t) : labels.dateOnly(d);
}
