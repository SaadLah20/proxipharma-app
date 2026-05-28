/**
 * Affichage dates / heures cohérent côté FR : heures toujours en 24 h (09h05, 18h30).
 */

/** Heure Postgres (`time` / `HH:MM` / `HH:MM:SS`) → `09h05`, `18h30`. */
export function formatTime24hFr(pgTime: string | null | undefined): string {
  if (pgTime == null) return "";
  const s = String(pgTime).trim();
  if (s === "") return "";
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  const hh = Math.min(23, Math.max(0, Number.parseInt(m[1], 10)));
  const mm = m[2].slice(0, 2);
  return `${String(hh).padStart(2, "0")}h${mm}`;
}

/** `YYYY-MM-DD` (sans fuseau) → date courte lisible en local FR. */
export function formatDateShortFr(ymd: string | null | undefined, withWeekday = false): string {
  if (ymd == null) return "";
  const parts = String(ymd).trim().split("-").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return String(ymd);
  const [y, mo, d] = parts;
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return String(ymd);
  return dt.toLocaleDateString("fr-FR", {
    weekday: withWeekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Passage patient : date courte + heure 24 h si présente. */
export function formatPlannedVisitFr(dateYmd: string | null | undefined, timePg: string | null | undefined): string {
  const d = formatDateShortFr(dateYmd ?? null, true);
  const t = formatTime24hFr(timePg ?? null);
  if (!d) return "";
  return t ? `${d} · ${t}` : d;
}

/** Bandeau demande traitée : phrase complète pour le créneau de passage. */
export function patientPlannedVisitPassageLineFr(
  dateYmd: string | null | undefined,
  timePg: string | null | undefined
): string {
  const d = formatDateShortFr(dateYmd ?? null, true);
  const t = formatTime24hFr(timePg ?? null);
  if (!d) return "";
  return t ? `Votre passage est prévu le ${d} à ${t}` : `Votre passage est prévu le ${d}`;
}

function parseYmdLocal(ymd: string): Date | null {
  const parts = String(ymd).trim().split("-").map((x) => Number.parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, mo, d] = parts;
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Écart temporel lisible (passage passé ou à venir). */
export function formatRelativeToNowFr(target: Date, now = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const future = diffMs > 0;
  const minutes = Math.round(absMs / 60_000);
  if (minutes < 1) return future ? "dans un instant" : "à l'instant";
  if (minutes < 60) {
    const n = minutes;
    const unit = n === 1 ? "minute" : "minutes";
    return future ? `dans ${n} ${unit}` : `il y a ${n} ${unit}`;
  }
  const hours = Math.round(absMs / 3_600_000);
  if (hours < 24) {
    const unit = hours === 1 ? "heure" : "heures";
    return future ? `dans ${hours} ${unit}` : `il y a ${hours} ${unit}`;
  }
  const days = Math.round(absMs / 86_400_000);
  if (days < 30) {
    const unit = days === 1 ? "jour" : "jours";
    return future ? `dans ${days} ${unit}` : `il y a ${days} ${unit}`;
  }
  const months = Math.round(days / 30);
  if (months < 12) {
    const unit = months === 1 ? "mois" : "mois";
    return future ? `dans ${months} ${unit}` : `il y a ${months} ${unit}`;
  }
  const years = Math.round(days / 365);
  const unit = years === 1 ? "an" : "ans";
  return future ? `dans ${years} ${unit}` : `il y a ${years} ${unit}`;
}

/** Archives patient : rappel discret du dernier passage fixé par le patient. */
export function patientArchiveLastPlannedVisitFootnoteFr(
  dateYmd: string | null | undefined,
  timePg: string | null | undefined
): { label: string; relative: string } | null {
  const ymd = (dateYmd ?? "").trim();
  if (!ymd) return null;
  const datePart = formatDateShortFr(ymd, false);
  const timePart = formatTime24hFr(timePg ?? null);
  if (!datePart) return null;
  const whenLabel = timePart ? `${datePart} — ${timePart}` : datePart;
  const visitAt = parseYmdLocal(ymd);
  if (!visitAt) {
    return { label: `Dernière date de passage fixée par vous : ${whenLabel}`, relative: "" };
  }
  if (timePart) {
    const m = String(timePg ?? "").match(/^(\d{1,2}):(\d{2})/);
    if (m) {
      visitAt.setHours(Math.min(23, Number.parseInt(m[1], 10)), Number.parseInt(m[2], 10), 0, 0);
    }
  }
  const relative = formatRelativeToNowFr(visitAt);
  return {
    label: `Dernière date de passage fixée par vous : ${whenLabel}`,
    relative,
  };
}

/** Liste type maquette mobile : « 12 déc. 2023 10:45 » (fuseau Maroc sur le web). */
export function formatDateTimeListCasablanca(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === "") return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Instant ISO → même style date que dans l’app (« 8 mai 2026 ») + heure 24 h (« 17h58 »), fuseau Casablanca. */
export function formatDateShortCasablancaWithTime24hFr(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const datePart = d.toLocaleDateString("fr-FR", {
    timeZone: "Africa/Casablanca",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const f = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Casablanca",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = f.formatToParts(d);
  const hh = parts.find((p) => p.type === "hour")?.value.padStart(2, "0") ?? "00";
  const mm = parts.find((p) => p.type === "minute")?.value.padStart(2, "0") ?? "00";
  return `${datePart} · ${hh}h${mm}`;
}

/** Instant ISO (UTC ou local) → `03/05/2026 · 18h30` (heure locale navigateur). */
export function formatDateTimeShort24hFr(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === "") return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const datePart = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${datePart} · ${h}h${min}`;
}
