import { normalizeOptionalUrl } from "@/lib/pharmacy-form-fields";

export type PharmacyCoords = {
  latitude: number;
  longitude: number;
};

export type ResolvedPharmacyLocation = PharmacyCoords & {
  mapsUrl: string | null;
  /** Libellé pour les recherches (nom + ville ou adresse). */
  queryLabel: string;
};

export type NavigationProviderId = "google" | "waze" | "apple" | "geo";

export type NavigationProviderLink = {
  id: NavigationProviderId;
  label: string;
  description: string;
  href: string;
};

/** Extrait lat/lng d’un lien Maps/Waze ou d’une paire « 33.57, -7.58 ». */
export function parseMapsLinkToCoords(raw: string): PharmacyCoords | null {
  const t = raw.trim();
  if (!t) return null;

  const pair = t.match(/(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (isValidCoords(lat, lng)) return { latitude: lat, longitude: lng };
  }

  try {
    const url = new URL(t.includes("://") ? t : `https://${t}`);
    const at = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (isValidCoords(lat, lng)) return { latitude: lat, longitude: lng };
    }

    const q = url.searchParams.get("q") ?? url.searchParams.get("query") ?? url.searchParams.get("ll");
    if (q) {
      const fromQ = parseMapsLinkToCoords(q);
      if (fromQ) return fromQ;
    }

    const ll = url.searchParams.get("ll");
    if (ll) {
      const fromLl = parseMapsLinkToCoords(ll);
      if (fromLl) return fromLl;
    }

    const destination = url.searchParams.get("destination");
    if (destination) {
      const fromDest = parseMapsLinkToCoords(destination);
      if (fromDest) return fromDest;
    }

    const daddr = url.searchParams.get("daddr");
    if (daddr) {
      const fromDaddr = parseMapsLinkToCoords(daddr);
      if (fromDaddr) return fromDaddr;
    }
  } catch {
    /* ignore */
  }

  return null;
}

function isValidCoords(lat: number, lng: number): boolean {
  return !Number.isNaN(lat) && !Number.isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function parsePharmacyLocationInput(raw: string): {
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  error?: string;
} {
  const t = raw.trim();
  if (!t) {
    return { mapsUrl: null, latitude: null, longitude: null };
  }

  const coords = parseMapsLinkToCoords(t);
  const mapsUrl = /^https?:\/\//i.test(t) || t.includes(".") ? normalizeOptionalUrl(t) : null;

  if (!coords && !mapsUrl) {
    return {
      mapsUrl: null,
      latitude: null,
      longitude: null,
      error: "Lien ou coordonnées non reconnus. Collez un lien Google Maps / Waze ou des coordonnées (ex. 33.57, -7.58).",
    };
  }

  return {
    mapsUrl,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  };
}

export function resolvePharmacyLocation(pharmacy: {
  nom?: string | null;
  adresse?: string | null;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
}): ResolvedPharmacyLocation | null {
  const label =
    [pharmacy.nom, pharmacy.adresse, pharmacy.ville].filter(Boolean).join(", ").trim() || "Pharmacie";

  let lat =
    pharmacy.latitude != null && !Number.isNaN(Number(pharmacy.latitude))
      ? Number(pharmacy.latitude)
      : NaN;
  let lng =
    pharmacy.longitude != null && !Number.isNaN(Number(pharmacy.longitude))
      ? Number(pharmacy.longitude)
      : NaN;

  const mapsUrl = pharmacy.maps_url?.trim() || null;

  if (!isValidCoords(lat, lng) && mapsUrl) {
    const parsed = parseMapsLinkToCoords(mapsUrl);
    if (parsed) {
      lat = parsed.latitude;
      lng = parsed.longitude;
    }
  }

  if (isValidCoords(lat, lng)) {
    return {
      latitude: lat,
      longitude: lng,
      mapsUrl,
      queryLabel: label,
    };
  }

  return null;
}

export function hasPharmacyNavigation(pharmacy: {
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
  nom?: string | null;
  adresse?: string | null;
  ville?: string | null;
}): boolean {
  return resolvePharmacyLocation(pharmacy) !== null || Boolean(pharmacy.maps_url?.trim());
}

/** Coordonnées pour tri par distance (lat/lng en base ou extraites du lien). */
export function pharmacyCoordsForDistance(pharmacy: {
  latitude?: number | null;
  longitude?: number | null;
  maps_url?: string | null;
  nom?: string | null;
  adresse?: string | null;
  ville?: string | null;
}): PharmacyCoords | null {
  const resolved = resolvePharmacyLocation(pharmacy);
  if (!resolved) return null;
  return { latitude: resolved.latitude, longitude: resolved.longitude };
}

export function buildNavigationProviderLinks(
  location: ResolvedPharmacyLocation
): NavigationProviderLink[] {
  const { latitude, longitude, queryLabel } = location;
  const q = encodeURIComponent(queryLabel);
  const ll = `${latitude},${longitude}`;

  return [
    {
      id: "google",
      label: "Google Maps",
      description: "Itinéraire dans Google Maps",
      href: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
    },
    {
      id: "waze",
      label: "Waze",
      description: "Navigation dans Waze",
      href: `https://waze.com/ul?ll=${ll}&navigate=yes`,
    },
    {
      id: "apple",
      label: "Plans (Apple)",
      description: "Ouvrir dans Plans sur iPhone / Mac",
      href: `https://maps.apple.com/?daddr=${latitude},${longitude}&q=${q}`,
    },
    {
      id: "geo",
      label: "Autre application",
      description: "Choisir une app installée (Android / iOS)",
      href: `geo:${latitude},${longitude}?q=${q}`,
    },
  ];
}
