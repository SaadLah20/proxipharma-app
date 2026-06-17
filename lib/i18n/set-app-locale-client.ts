import { LOCALE_COOKIE, type AppLocale } from "@/lib/i18n/config";

/** Persiste la locale patient (cookie) — même logique que le sélecteur header. */
export function setAppLocaleCookie(next: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;
}
