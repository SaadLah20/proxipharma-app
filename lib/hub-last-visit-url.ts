/**
 * Mémorise la dernière URL hub (pathname + query) par section pour la barre de navigation basse.
 * Session uniquement — pas de changement de comportement hors navigation footer.
 */

const STORAGE_PREFIX = "proxipharma:hub-last-url:";

export function hubLastVisitStorageKey(hubBasePath: string): string {
  return `${STORAGE_PREFIX}${hubBasePath}`;
}

/** Page hub liste (pas détail dossier /[id]). */
export function isHubRootPage(pathname: string, hubBasePath: string): boolean {
  return pathname === hubBasePath;
}

export function saveHubLastVisitUrl(hubBasePath: string, pathname: string, search: string): void {
  if (typeof window === "undefined") return;
  if (!isHubRootPage(pathname, hubBasePath)) return;
  const url = search.trim() ? `${hubBasePath}?${search.trim()}` : hubBasePath;
  try {
    sessionStorage.setItem(hubLastVisitStorageKey(hubBasePath), url);
  } catch {
    /* quota / mode privé */
  }
}

export function readHubLastVisitUrl(hubBasePath: string): string {
  if (typeof window === "undefined") return hubBasePath;
  try {
    const raw = sessionStorage.getItem(hubLastVisitStorageKey(hubBasePath));
    if (!raw || !raw.startsWith(hubBasePath)) return hubBasePath;
    const pathOnly = raw.split("?")[0] ?? raw;
    if (pathOnly !== hubBasePath) return hubBasePath;
    return raw;
  } catch {
    return hubBasePath;
  }
}
