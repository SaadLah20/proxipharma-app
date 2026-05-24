import { isPlausibleMoroccoCoords } from "@/lib/annuaire/geo";

/** Bornes GPS pilote ProxiPharma (alignées annuaire « près de moi »). */
export const MOROCCO_LAT_MIN = 20.5;
export const MOROCCO_LAT_MAX = 36.5;
export const MOROCCO_LNG_MIN = -17.5;
export const MOROCCO_LNG_MAX = -0.5;

export type ParsedPharmacyCoords =
  | { ok: true; latitude: number; longitude: number }
  | { ok: true; latitude: null; longitude: null }
  | { ok: false; error: string };

/** Valide et normalise une paire lat/lng saisie par l’admin (Maroc uniquement). */
export function parseAdminPharmacyCoords(
  latitudeRaw: string,
  longitudeRaw: string,
  options?: { required?: boolean }
): ParsedPharmacyCoords {
  const required = options?.required !== false;
  const latStr = latitudeRaw.trim();
  const lngStr = longitudeRaw.trim();

  if (!latStr && !lngStr) {
    if (!required) return { ok: true, latitude: null, longitude: null };
    return { ok: false, error: "Latitude et longitude sont requises (copiez-les depuis Google Maps)." };
  }

  if (!latStr || !lngStr) {
    return { ok: false, error: "Renseignez la latitude et la longitude." };
  }

  const lat = Number(latStr.replace(",", "."));
  const lng = Number(lngStr.replace(",", "."));

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { ok: false, error: "Latitude et longitude doivent être des nombres (ex. 33.5731 et -7.5898)." };
  }

  if (lat < -90 || lat > 90) {
    return { ok: false, error: "Latitude hors limites (-90 à 90)." };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, error: "Longitude hors limites (-180 à 180)." };
  }

  if (!isPlausibleMoroccoCoords(lat, lng)) {
    return {
      ok: false,
      error: `Coordonnées hors zone Maroc (pilote). Attendu : latitude ${MOROCCO_LAT_MIN}–${MOROCCO_LAT_MAX}, longitude ${MOROCCO_LNG_MIN}–${MOROCCO_LNG_MAX}.`,
    };
  }

  return {
    ok: true,
    latitude: roundCoord(lat),
    longitude: roundCoord(lng),
  };
}

function roundCoord(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Aperçu Google Maps (nouvel onglet) pour vérifier l’épingle avant création. */
export function googleMapsPreviewUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=18`;
}

export function openGoogleMapsPreview(latitude: number, longitude: number): void {
  if (typeof window === "undefined") return;
  window.open(googleMapsPreviewUrl(latitude, longitude), "_blank", "noopener,noreferrer");
}

export function adminPharmacyCoordsFromBody(
  latitudeRaw: unknown,
  longitudeRaw: unknown,
  options?: { required?: boolean }
): { latitude: number | null; longitude: number | null } | { error: string } {
  const parsed = parseAdminPharmacyCoords(String(latitudeRaw ?? ""), String(longitudeRaw ?? ""), options);
  if (!parsed.ok) return { error: parsed.error };
  return { latitude: parsed.latitude, longitude: parsed.longitude };
}
