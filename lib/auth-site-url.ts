/**
 * URL publique pour les liens Auth Supabase (récupération MDP, confirmation e-mail).
 * Éviter localhost dans les e-mails : définir APP_BASE_URL (serveur) et
 * NEXT_PUBLIC_APP_BASE_URL (navigateur) sur l’URL Vercel / domaine de prod.
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

function isLocalhostHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

export function isLocalhostUrl(url: string): boolean {
  try {
    return isLocalhostHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Origine publique du site (sans slash final). */
export function resolvePublicAppBaseUrl(fallbackOrigin?: string): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    process.env.APP_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    fallbackOrigin,
  ].filter((v): v is string => Boolean(v?.trim()));

  for (const raw of candidates) {
    const base = stripTrailingSlash(raw.trim());
    try {
      const u = new URL(base);
      if (!isLocalhostHost(u.hostname)) return base;
    } catch {
      continue;
    }
  }

  for (const raw of candidates) {
    try {
      return stripTrailingSlash(raw.trim());
    } catch {
      continue;
    }
  }

  return "http://localhost:3000";
}

/** URL absolue pour `emailRedirectTo` / `redirectTo` Auth. */
export function authEmailRedirectUrl(path: string, fallbackOrigin?: string): string {
  const base = resolvePublicAppBaseUrl(fallbackOrigin);
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** Côté navigateur : préfère l’env public, sinon l’origine courante si ce n’est pas localhost. */
export function resolveClientAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_BASE_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);
  if (typeof window !== "undefined") {
    const origin = window.location.origin;
    if (!isLocalhostUrl(origin)) return origin;
  }
  return resolvePublicAppBaseUrl();
}
