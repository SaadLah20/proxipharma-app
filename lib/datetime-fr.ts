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
